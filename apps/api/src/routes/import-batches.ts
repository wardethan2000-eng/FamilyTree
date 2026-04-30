import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import {
  extForMimeType,
  getPresignedUploadUrl,
  isAllowedMimeType,
  mediaUrl,
} from "../lib/storage.js";
import { checkTreeCanAdd } from "../lib/tree-usage-service.js";
import { createMemoryWithPrimaryTag } from "../lib/cross-tree-write-service.js";
import { enqueueMemoryTranscription } from "../lib/transcription.js";

const CreateBatchBody = z.object({
  label: z.string().min(1).max(200),
  defaultPersonId: z.string().uuid(),
  sourceKind: z.enum(["multi_file_upload", "zip_upload"]).default("multi_file_upload"),
});

const PresignItemsBody = z.object({
  items: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255),
        sizeBytes: z.number().int().positive().max(200 * 1024 * 1024),
        lastModified: z.number().int().positive().optional(),
      }),
    )
    .min(1)
    .max(100),
});

const CompleteBatchBody = z.object({
  createMemories: z.boolean().default(true),
});

const PresignZipBody = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.literal("application/zip"),
  sizeBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
});

function canImport(role: string): boolean {
  return role === "founder" || role === "steward" || role === "contributor";
}

function deriveMemoryKind(contentType: string): "photo" | "voice" | "document" | "other" {
  if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
    return "photo";
  }
  if (contentType.startsWith("audio/")) {
    return "voice";
  }
  if (
    contentType === "application/pdf" ||
    contentType.includes("word") ||
    contentType.includes("document")
  ) {
    return "document";
  }
  return "other";
}

function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return (withoutExtension || filename).slice(0, 200);
}

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (membership, { and, eq }) =>
      and(eq(membership.treeId, treeId), eq(membership.userId, userId)),
  });
}

async function verifyPersonInTreeScope(treeId: string, personId: string) {
  const person = await db.query.people.findFirst({
    where: (candidate, { eq }) => eq(candidate.id, personId),
    columns: { id: true, treeId: true },
  });
  if (!person) return false;
  if (person.treeId === treeId) return true;
  const scoped = await db.query.treePersonScope.findFirst({
    where: (scope, { and, eq }) =>
      and(eq(scope.treeId, treeId), eq(scope.personId, personId)),
    columns: { personId: true },
  });
  return Boolean(scoped);
}

async function verifyBatch(treeId: string, batchId: string) {
  return db.query.importBatches.findFirst({
    where: (batch, { and, eq }) =>
      and(eq(batch.id, batchId), eq(batch.treeId, treeId)),
  });
}

export async function importBatchesPlugin(app: FastifyInstance): Promise<void> {
  app.get("/api/trees/:treeId/import-batches", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const batches = await db.query.importBatches.findMany({
      where: (batch, { eq }) => eq(batch.treeId, treeId),
      with: {
        defaultPerson: {
          columns: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: (batch, { desc }) => [desc(batch.createdAt)],
      limit: 30,
    });

    return reply.send({
      batches: batches.map((batch) => ({
        id: batch.id,
        label: batch.label,
        status: batch.status,
        totalItems: batch.totalItems,
        processedItems: batch.processedItems,
        failedItems: batch.failedItems,
        defaultPerson: batch.defaultPerson
          ? {
              id: batch.defaultPerson.id,
              name: batch.defaultPerson.displayName,
            }
          : null,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      })),
    });
  });

  app.get("/api/trees/:treeId/import-batches/:batchId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, batchId } = request.params as {
      treeId: string;
      batchId: string;
    };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const batch = await db.query.importBatches.findFirst({
      where: (candidate, { and, eq }) =>
        and(eq(candidate.id, batchId), eq(candidate.treeId, treeId)),
      with: {
        defaultPerson: {
          columns: { id: true, displayName: true },
        },
        items: {
          with: {
            media: {
              columns: {
                objectKey: true,
                mimeType: true,
              },
            },
            memory: {
              columns: {
                id: true,
                title: true,
                kind: true,
                dateOfEventText: true,
                placeLabelOverride: true,
              },
            },
          },
          orderBy: (item, { desc }) => [desc(item.createdAt)],
        },
      },
    });

    if (!batch) return reply.status(404).send({ error: "Batch not found" });

    return reply.send({
      id: batch.id,
      label: batch.label,
      status: batch.status,
      totalItems: batch.totalItems,
      processedItems: batch.processedItems,
      failedItems: batch.failedItems,
      defaultPerson: batch.defaultPerson
        ? { id: batch.defaultPerson.id, name: batch.defaultPerson.displayName }
        : null,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      items: batch.items.map((item) => ({
        id: item.id,
        originalFilename: item.originalFilename,
        detectedMimeType: item.detectedMimeType,
        sizeBytes: item.sizeBytes,
        status: item.status,
        reviewState: item.reviewState,
        errorMessage: item.errorMessage,
        mediaUrl: item.media ? mediaUrl(item.media.objectKey) : null,
        memory: item.memory,
        createdAt: item.createdAt,
      })),
    });
  });

  app.post("/api/trees/:treeId/import-batches", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canImport(membership.role)) {
      return reply.status(403).send({ error: "Viewers cannot import memories" });
    }

    const parsed = CreateBatchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const personInScope = await verifyPersonInTreeScope(
      treeId,
      parsed.data.defaultPersonId,
    );
    if (!personInScope) {
      return reply.status(400).send({ error: "Person not found in this tree" });
    }

    const [batch] = await db
      .insert(schema.importBatches)
      .values({
        treeId,
        createdByUserId: session.user.id,
        label: parsed.data.label,
        defaultPersonId: parsed.data.defaultPersonId,
        sourceKind: parsed.data.sourceKind,
      })
      .returning();

    if (!batch) return reply.status(500).send({ error: "Failed to create batch" });
    return reply.status(201).send(batch);
  });

  app.post(
    "/api/trees/:treeId/import-batches/:batchId/items/presign",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, batchId } = request.params as {
        treeId: string;
        batchId: string;
      };
      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!canImport(membership.role)) {
        return reply.status(403).send({ error: "Viewers cannot import memories" });
      }

      const batch = await verifyBatch(treeId, batchId);
      if (!batch) return reply.status(404).send({ error: "Batch not found" });

      const parsed = PresignItemsBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      const prepared: Array<{
        itemId: string;
        mediaId: string;
        uploadUrl: string;
        objectKey: string;
        filename: string;
      }> = [];

      for (const item of parsed.data.items) {
        if (!isAllowedMimeType(item.contentType)) {
          return reply.status(415).send({
            error: `Unsupported media type for ${item.filename}`,
          });
        }
        const capacity = await checkTreeCanAdd(treeId, "media", item.sizeBytes);
        if (!capacity.allowed) {
          return reply.status(capacity.status).send({ error: capacity.reason });
        }
      }

      for (const item of parsed.data.items) {
        const ext = extForMimeType(item.contentType);
        const objectKey = `trees/${treeId}/imports/${batchId}/${randomUUID()}.${ext}`;
        const uploadUrl = await getPresignedUploadUrl(objectKey, item.contentType);

        const [mediaRecord] = await db
          .insert(schema.media)
          .values({
            treeId,
            contributingTreeId: treeId,
            uploadedByUserId: session.user.id,
            objectKey,
            originalFilename: item.filename,
            mimeType: item.contentType,
            sizeBytes: item.sizeBytes,
            storageProvider: "minio",
          })
          .returning();

        if (!mediaRecord) {
          return reply.status(500).send({ error: "Failed to create media record" });
        }

        const [batchItem] = await db
          .insert(schema.importBatchItems)
          .values({
            batchId,
            treeId,
            mediaId: mediaRecord.id,
            originalFilename: item.filename,
            detectedMimeType: item.contentType,
            sizeBytes: item.sizeBytes,
            capturedAt: item.lastModified ? new Date(item.lastModified) : null,
            metadata: item.lastModified
              ? { lastModified: new Date(item.lastModified).toISOString() }
              : null,
          })
          .returning();

        if (!batchItem) {
          return reply.status(500).send({ error: "Failed to create batch item" });
        }

        prepared.push({
          itemId: batchItem.id,
          mediaId: mediaRecord.id,
          uploadUrl,
          objectKey,
          filename: item.filename,
        });
      }

      await db
        .update(schema.importBatches)
        .set({
          totalItems: sql`${schema.importBatches.totalItems} + ${prepared.length}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.importBatches.id, batchId));

      return reply.status(201).send({ items: prepared });
    },
  );

  app.post(
    "/api/trees/:treeId/import-batches/:batchId/complete",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, batchId } = request.params as {
        treeId: string;
        batchId: string;
      };
      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!canImport(membership.role)) {
        return reply.status(403).send({ error: "Viewers cannot import memories" });
      }

      const parsed = CompleteBatchBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      const batch = await verifyBatch(treeId, batchId);
      if (!batch) return reply.status(404).send({ error: "Batch not found" });
      if (batch.status === "completed" || batch.status === "failed") {
        return reply.status(409).send({ error: "Batch has already been completed" });
      }
      if (!batch.defaultPersonId) {
        return reply.status(400).send({
          error: "This import needs a default person before memories can be created",
        });
      }

      const items = await db.query.importBatchItems.findMany({
        where: (item, { and, eq, isNull }) =>
          and(
            eq(item.batchId, batchId),
            eq(item.treeId, treeId),
            eq(item.status, "uploaded"),
            isNull(item.memoryId),
          ),
        with: {
          media: true,
        },
      });

      if (!parsed.data.createMemories || items.length === 0) {
        await db
          .update(schema.importBatches)
          .set({ status: "needs_review", updatedAt: new Date() })
          .where(eq(schema.importBatches.id, batchId));
        return reply.send({ created: 0, failed: 0 });
      }

      let created = 0;
      let failed = 0;
      const voiceMemoryIds: string[] = [];

      for (const item of items) {
        if (!item.media) {
          failed += 1;
          await db
            .update(schema.importBatchItems)
            .set({
              status: "failed",
              reviewState: "needs_review",
              errorMessage: "Media record missing",
              updatedAt: new Date(),
            })
            .where(eq(schema.importBatchItems.id, item.id));
          continue;
        }

        try {
          const kind = deriveMemoryKind(item.media.mimeType);
          const memory = await db.transaction(async (tx) => {
            const createdMemory = await createMemoryWithPrimaryTag(tx, {
              treeId,
              primaryPersonId: batch.defaultPersonId!,
              contributorUserId: session.user.id,
              kind,
              title: titleFromFilename(item.originalFilename),
              body: undefined,
              mediaId: item.mediaId,
              mediaIds: item.mediaId ? [item.mediaId] : [],
            });
            await tx
              .update(schema.memories)
              .set({
                sourceBatchId: batchId,
                sourceFilename: item.originalFilename,
              })
              .where(eq(schema.memories.id, createdMemory.id));
            await tx
              .update(schema.importBatchItems)
              .set({
                memoryId: createdMemory.id,
                status: "imported",
                reviewState: "needs_date",
                updatedAt: new Date(),
              })
              .where(eq(schema.importBatchItems.id, item.id));
            return createdMemory;
          });
          if (kind === "voice") voiceMemoryIds.push(memory.id);
          created += 1;
        } catch (error) {
          failed += 1;
          request.log.error({ error, itemId: item.id }, "Import item failed");
          await db
            .update(schema.importBatchItems)
            .set({
              status: "failed",
              reviewState: "needs_review",
              errorMessage: "Could not create memory",
              updatedAt: new Date(),
            })
            .where(eq(schema.importBatchItems.id, item.id));
        }
      }

      for (const memoryId of voiceMemoryIds) {
        await enqueueMemoryTranscription(memoryId, treeId);
      }

      await db
        .update(schema.importBatches)
        .set({
          status: failed > 0 ? "needs_review" : "completed",
          processedItems: sql`${schema.importBatches.processedItems} + ${created}`,
          failedItems: sql`${schema.importBatches.failedItems} + ${failed}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.importBatches.id, batchId));

      return reply.send({ created, failed });
    },
  );

  app.post(
    "/api/trees/:treeId/import-batches/:batchId/zip-presign",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, batchId } = request.params as {
        treeId: string;
        batchId: string;
      };
      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!canImport(membership.role)) {
        return reply.status(403).send({ error: "Viewers cannot import memories" });
      }

      const batch = await verifyBatch(treeId, batchId);
      if (!batch) return reply.status(404).send({ error: "Batch not found" });
      if (batch.sourceKind !== "zip_upload") {
        return reply.status(400).send({ error: "Batch is not a ZIP import" });
      }

      const parsed = PresignZipBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      const objectKey = `trees/${treeId}/imports/${batchId}/${randomUUID()}.zip`;
      const uploadUrl = await getPresignedUploadUrl(objectKey, "application/zip");

      const capacity = await checkTreeCanAdd(treeId, "media", parsed.data.sizeBytes);
      if (!capacity.allowed) {
        return reply.status(capacity.status).send({ error: capacity.reason });
      }

      const [mediaRecord] = await db
        .insert(schema.media)
        .values({
          treeId,
          contributingTreeId: treeId,
          uploadedByUserId: session.user.id,
          objectKey,
          originalFilename: parsed.data.filename,
          mimeType: "application/zip",
          sizeBytes: parsed.data.sizeBytes,
          storageProvider: "minio",
        })
        .returning();

      if (!mediaRecord) {
        return reply.status(500).send({ error: "Failed to create media record" });
      }

      const [batchItem] = await db
        .insert(schema.importBatchItems)
        .values({
          batchId,
          treeId,
          mediaId: mediaRecord.id,
          originalFilename: parsed.data.filename,
          relativePath: "__archive__",
          detectedMimeType: "application/zip",
          sizeBytes: parsed.data.sizeBytes,
        })
        .returning();

      if (!batchItem) {
        return reply.status(500).send({ error: "Failed to create batch item" });
      }

      await db
        .update(schema.importBatches)
        .set({
          totalItems: sql`${schema.importBatches.totalItems} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.importBatches.id, batchId));

      return reply.status(201).send({
        itemId: batchItem.id,
        mediaId: mediaRecord.id,
        uploadUrl,
        objectKey,
      });
    },
  );

  app.post(
    "/api/trees/:treeId/import-batches/:batchId/extract-zip",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, batchId } = request.params as {
        treeId: string;
        batchId: string;
      };
      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) return reply.status(403).send({ error: "Not a member" });
      if (!canImport(membership.role)) {
        return reply.status(403).send({ error: "Viewers cannot import memories" });
      }

      const batch = await verifyBatch(treeId, batchId);
      if (!batch) return reply.status(404).send({ error: "Batch not found" });
      if (batch.sourceKind !== "zip_upload") {
        return reply.status(400).send({ error: "Batch is not a ZIP import" });
      }

      await db
        .update(schema.importBatches)
        .set({ status: "awaiting_extraction", updatedAt: new Date() })
        .where(eq(schema.importBatches.id, batchId));

      return reply.send({ status: "awaiting_extraction" });
    },
  );

  const BulkReviewAction = z.object({
    itemIds: z.array(z.string().uuid()).min(1).max(200),
    action: z.enum([
      "mark_reviewed",
      "mark_duplicate",
      "mark_not_duplicate",
      "skip",
      "reassign_person",
    ]),
    personId: z.string().uuid().optional(),
  });

  app.patch("/api/trees/:treeId/import-batches/:batchId/items", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, batchId } = request.params as {
      treeId: string;
      batchId: string;
    };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canImport(membership.role)) {
      return reply.status(403).send({ error: "Viewers cannot review imports" });
    }

    const batch = await verifyBatch(treeId, batchId);
    if (!batch) return reply.status(404).send({ error: "Batch not found" });

    const parsed = BulkReviewAction.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const { itemIds, action, personId } = parsed.data;

    const items = await db.query.importBatchItems.findMany({
      where: (item, { and, eq, inArray: inArr }) =>
        and(eq(item.batchId, batchId), eq(item.treeId, treeId), inArr(item.id, itemIds)),
      columns: { id: true, memoryId: true, reviewState: true },
    });

    if (items.length === 0) {
      return reply.status(404).send({ error: "No matching items found" });
    }

    const validIds = items.map((i) => i.id);
    let applied = 0;

    switch (action) {
      case "mark_reviewed": {
        await db
          .update(schema.importBatchItems)
          .set({ reviewState: "done", updatedAt: new Date() })
          .where(
            and(
              eq(schema.importBatchItems.batchId, batchId),
              inArray(schema.importBatchItems.id, validIds),
            ),
          );
        applied = validIds.length;
        break;
      }

      case "mark_duplicate": {
        await db
          .update(schema.importBatchItems)
          .set({ reviewState: "needs_duplicate_review", updatedAt: new Date() })
          .where(
            and(
              eq(schema.importBatchItems.batchId, batchId),
              inArray(schema.importBatchItems.id, validIds),
            ),
          );
        applied = validIds.length;
        break;
      }

      case "mark_not_duplicate": {
        const dedupedItems = items.filter((i) => i.reviewState === "needs_duplicate_review");
        if (dedupedItems.length > 0) {
          await db
            .update(schema.importBatchItems)
            .set({ reviewState: "needs_date", updatedAt: new Date() })
            .where(
              and(
                eq(schema.importBatchItems.batchId, batchId),
                inArray(
                  schema.importBatchItems.id,
                  dedupedItems.map((i) => i.id),
                ),
              ),
            );
        }
        applied = dedupedItems.length;
        break;
      }

      case "skip": {
        await db
          .update(schema.importBatchItems)
          .set({ status: "skipped", reviewState: "done", updatedAt: new Date() })
          .where(
            and(
              eq(schema.importBatchItems.batchId, batchId),
              inArray(schema.importBatchItems.id, validIds),
            ),
          );
        applied = validIds.length;
        break;
      }

      case "reassign_person": {
        if (!personId) {
          return reply.status(400).send({ error: "personId is required for reassign_person" });
        }
        const personInScope = await verifyPersonInTreeScope(treeId, personId);
        if (!personInScope) {
          return reply.status(400).send({ error: "Person not found in this tree" });
        }
        const itemsWithMemory = items.filter((i) => i.memoryId);
        for (const item of itemsWithMemory) {
          await db
            .update(schema.memories)
            .set({ primaryPersonId: personId, updatedAt: new Date() })
            .where(eq(schema.memories.id, item.memoryId!));
        }
        if (validIds.length > 0) {
          await db
            .update(schema.importBatchItems)
            .set({ reviewState: "needs_date", updatedAt: new Date() })
            .where(
              and(
                eq(schema.importBatchItems.batchId, batchId),
                inArray(schema.importBatchItems.id, validIds),
              ),
            );
        }
        applied = itemsWithMemory.length;
        break;
      }
    }

    return reply.send({ applied });
  });

  app.get(
    "/api/trees/:treeId/import-batches/:batchId/duplicates",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, batchId } = request.params as {
        treeId: string;
        batchId: string;
      };
      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) return reply.status(403).send({ error: "Not a member" });

      const batch = await verifyBatch(treeId, batchId);
      if (!batch) return reply.status(404).send({ error: "Batch not found" });

      const dupItems = await db.query.importBatchItems.findMany({
        where: (item, { and, eq }) =>
          and(eq(item.batchId, batchId), eq(item.treeId, treeId), eq(item.reviewState, "needs_duplicate_review")),
        with: {
          media: {
            columns: { id: true, objectKey: true, mimeType: true },
          },
          memory: {
            columns: { id: true, title: true, kind: true },
          },
        },
        orderBy: (item, { asc }) => [asc(item.createdAt)],
      });

      const groups: Array<{
        checksum: string | null;
        perceptualHash: string | null;
        items: Array<{
          id: string;
          originalFilename: string;
          mediaUrl: string | null;
          memoryId: string | null;
          memoryTitle: string | null;
        }>;
      }> = [];

      const byChecksum = new Map<string, typeof dupItems>();
      const byPhash = new Map<string, typeof dupItems>();
      const assigned = new Set<string>();

      for (const item of dupItems) {
        if (assigned.has(item.id)) continue;
        if (item.checksum) {
          const group = byChecksum.get(item.checksum) ?? [];
          group.push(item);
          byChecksum.set(item.checksum, group);
        }
        if (item.perceptualHash) {
          const group = byPhash.get(item.perceptualHash) ?? [];
          group.push(item);
          byPhash.set(item.perceptualHash, group);
        }
      }

      for (const [checksum, items] of byChecksum) {
        if (items.length < 2) continue;
        const groupItems = items.map((item) => ({
          id: item.id,
          originalFilename: item.originalFilename,
          mediaUrl: item.media ? mediaUrl(item.media.objectKey) : null,
          memoryId: item.memoryId,
          memoryTitle: item.memory?.title ?? null,
        }));
        for (const item of items) assigned.add(item.id);
        groups.push({ checksum, perceptualHash: items[0]?.perceptualHash ?? null, items: groupItems });
      }

      for (const [phash, items] of byPhash) {
        const unassigned = items.filter((i) => !assigned.has(i.id));
        if (unassigned.length < 2) continue;
        const groupItems = unassigned.map((item) => ({
          id: item.id,
          originalFilename: item.originalFilename,
          mediaUrl: item.media ? mediaUrl(item.media.objectKey) : null,
          memoryId: item.memoryId,
          memoryTitle: item.memory?.title ?? null,
        }));
        for (const item of unassigned) assigned.add(item.id);
        groups.push({ checksum: unassigned[0]?.checksum ?? null, perceptualHash: phash, items: groupItems });
      }

      return reply.send({ groups });
    },
  );
}
