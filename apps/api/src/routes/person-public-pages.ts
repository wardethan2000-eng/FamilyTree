import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import { mediaUrl } from "../lib/storage.js";
import { getTreeScopedPerson, isPersonInTreeScope } from "../lib/cross-tree-read-service.js";

const PublicPageBody = z.object({
  slug: z
    .string()
    .min(3)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  status: z.enum(["draft", "published", "disabled"]).optional(),
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(255).nullable().optional(),
  obituaryText: z.string().max(20000).nullable().optional(),
  serviceDetails: z.string().max(10000).nullable().optional(),
  donationUrl: z.string().url().max(2000).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  allowSearchIndexing: z.boolean().optional(),
  showLifeDates: z.boolean().optional(),
  showPlaces: z.boolean().optional(),
  showFeaturedMemories: z.boolean().optional(),
});

type PublicPageStatus = typeof schema.personPublicPageStatusEnum.enumValues[number];

function canPublish(role: string): boolean {
  return role === "founder" || role === "steward";
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function nextText(
  incoming: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const normalized = normalizeOptionalText(incoming);
  return normalized === undefined ? fallback ?? null : normalized;
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return `${base || "person"}-${randomBytes(3).toString("hex")}`;
}

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
}

function serializeManagedPage(
  page: typeof schema.personPublicPages.$inferSelect | null | undefined,
) {
  if (!page) return null;
  return {
    id: page.id,
    treeId: page.treeId,
    personId: page.personId,
    slug: page.slug,
    status: page.status,
    title: page.title,
    subtitle: page.subtitle,
    obituaryText: page.obituaryText,
    serviceDetails: page.serviceDetails,
    donationUrl: page.donationUrl,
    contactEmail: page.contactEmail,
    allowSearchIndexing: page.allowSearchIndexing,
    showLifeDates: page.showLifeDates,
    showPlaces: page.showPlaces,
    showFeaturedMemories: page.showFeaturedMemories,
    publishedAt: page.publishedAt,
    publicUrl: `/people/${page.slug}`,
    updatedAt: page.updatedAt,
  };
}

function serializeMemory(memory: {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  dateOfEventText: string | null;
  media: { objectKey: string; mimeType: string } | null;
  mediaItems: Array<{
    media: { objectKey: string; mimeType: string } | null;
    linkedMediaPreviewUrl: string | null;
    linkedMediaOpenUrl: string | null;
    linkedMediaLabel: string | null;
    sortOrder: number;
  }>;
}) {
  const firstMediaItem = [...memory.mediaItems].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )[0];
  const itemMediaUrl = firstMediaItem?.media
    ? mediaUrl(firstMediaItem.media.objectKey)
    : null;
  return {
    id: memory.id,
    kind: memory.kind,
    title: memory.title,
    body: memory.body,
    dateOfEventText: memory.dateOfEventText,
    mediaUrl: itemMediaUrl ?? (memory.media ? mediaUrl(memory.media.objectKey) : null),
    mimeType: firstMediaItem?.media?.mimeType ?? memory.media?.mimeType ?? null,
    linkedMediaOpenUrl: firstMediaItem?.linkedMediaOpenUrl ?? null,
    linkedMediaPreviewUrl: firstMediaItem?.linkedMediaPreviewUrl ?? null,
    linkedMediaLabel: firstMediaItem?.linkedMediaLabel ?? null,
  };
}

export async function personPublicPagesPlugin(app: FastifyInstance): Promise<void> {
  app.get("/api/trees/:treeId/people/:personId/public-page", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as { treeId: string; personId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });

    const personInScope = await isPersonInTreeScope(treeId, personId);
    if (!personInScope) return reply.status(404).send({ error: "Person not found" });

    const page = await db.query.personPublicPages.findFirst({
      where: (p, { and, eq }) => and(eq(p.treeId, treeId), eq(p.personId, personId)),
    });

    return reply.send({ page: serializeManagedPage(page), canPublish: canPublish(membership.role) });
  });

  app.put("/api/trees/:treeId/people/:personId/public-page", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as { treeId: string; personId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });
    if (!canPublish(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    const parsed = PublicPageBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request body" });

    const person = await getTreeScopedPerson(treeId, personId);
    if (!person) return reply.status(404).send({ error: "Person not found" });

    const existing = await db.query.personPublicPages.findFirst({
      where: (p, { and, eq }) => and(eq(p.treeId, treeId), eq(p.personId, personId)),
    });
    const slug = parsed.data.slug ?? existing?.slug ?? makeSlug(person.displayName);
    const status = (parsed.data.status ?? existing?.status ?? "draft") as PublicPageStatus;
    if (status === "published" && person.isLiving) {
      return reply.status(400).send({ error: "Living people cannot be published publicly" });
    }
    const now = new Date();

    const values = {
      slug,
      status,
      title: nextText(parsed.data.title, existing?.title ?? person.displayName),
      subtitle: nextText(parsed.data.subtitle, existing?.subtitle ?? person.essenceLine),
      obituaryText: nextText(parsed.data.obituaryText, existing?.obituaryText),
      serviceDetails: nextText(parsed.data.serviceDetails, existing?.serviceDetails),
      donationUrl: nextText(parsed.data.donationUrl, existing?.donationUrl),
      contactEmail: nextText(parsed.data.contactEmail, existing?.contactEmail),
      allowSearchIndexing:
        parsed.data.allowSearchIndexing ?? existing?.allowSearchIndexing ?? false,
      showLifeDates: parsed.data.showLifeDates ?? existing?.showLifeDates ?? true,
      showPlaces: parsed.data.showPlaces ?? existing?.showPlaces ?? true,
      showFeaturedMemories:
        parsed.data.showFeaturedMemories ?? existing?.showFeaturedMemories ?? true,
      updatedByUserId: session.user.id,
      updatedAt: now,
      publishedAt:
        status === "published"
          ? (existing?.publishedAt ?? now)
          : existing?.publishedAt ?? null,
    };

    try {
      const [page] = existing
        ? await db
            .update(schema.personPublicPages)
            .set(values)
            .where(eq(schema.personPublicPages.id, existing.id))
            .returning()
        : await db
            .insert(schema.personPublicPages)
            .values({
              treeId,
              personId,
              createdByUserId: session.user.id,
              ...values,
            })
            .returning();

      return reply.send({ page: serializeManagedPage(page) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("person_public_pages_slug_unique_idx")) {
        return reply.status(409).send({ error: "That public URL is already in use" });
      }
      request.log.error({ error }, "Failed to save public person page");
      return reply.status(500).send({ error: "Failed to save public page" });
    }
  });

  app.get("/api/public/person-pages/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const page = await db.query.personPublicPages.findFirst({
      where: (p, { and, eq }) => and(eq(p.slug, slug), eq(p.status, "published")),
      with: {
        person: {
          with: {
            portraitMedia: { columns: { objectKey: true, mimeType: true } },
            birthPlaceRef: true,
            deathPlaceRef: true,
          },
        },
        tree: { columns: { id: true, name: true } },
      },
    });

    if (!page) return reply.status(404).send({ error: "Public page not found" });
    if (page.person.isLiving) {
      return reply.status(404).send({ error: "Public page not found" });
    }

    const featuredRows = page.showFeaturedMemories
      ? await db.query.personMemoryCuration.findMany({
          where: (c, { and, eq }) =>
            and(
              eq(c.treeId, page.treeId),
              eq(c.personId, page.personId),
              eq(c.isFeatured, true),
            ),
          orderBy: (c, { asc }) => [asc(c.sortOrder)],
          with: {
            memory: {
              with: {
                media: { columns: { objectKey: true, mimeType: true } },
                mediaItems: {
                  with: {
                    media: { columns: { objectKey: true, mimeType: true } },
                  },
                },
                personTags: { columns: { personId: true } },
              },
            },
          },
        })
      : [];

    const memories = featuredRows
      .filter((row) => row.memory.personTags.some((tag) => tag.personId === page.personId))
      .map((row) => serializeMemory(row.memory));

    return reply
      .header(
        "X-Robots-Tag",
        page.allowSearchIndexing ? "index, follow" : "noindex, nofollow",
      )
      .send({
        page: {
          slug: page.slug,
          title: page.title ?? page.person.displayName,
          subtitle: page.subtitle,
          obituaryText: page.obituaryText,
          serviceDetails: page.serviceDetails,
          donationUrl: page.donationUrl,
          contactEmail: page.contactEmail,
          allowSearchIndexing: page.allowSearchIndexing,
          showLifeDates: page.showLifeDates,
          showPlaces: page.showPlaces,
          publishedAt: page.publishedAt,
        },
        person: {
          displayName: page.person.displayName,
          essenceLine: page.person.essenceLine,
          birthDateText: page.showLifeDates ? page.person.birthDateText : null,
          deathDateText: page.showLifeDates ? page.person.deathDateText : null,
          birthPlace: page.showPlaces
            ? page.person.birthPlaceRef?.label ?? page.person.birthPlace
            : null,
          deathPlace: page.showPlaces
            ? page.person.deathPlaceRef?.label ?? page.person.deathPlace
            : null,
          portraitUrl: page.person.portraitMedia
            ? mediaUrl(page.person.portraitMedia.objectKey)
            : null,
        },
        tree: page.tree,
        memories,
      });
  });
}
