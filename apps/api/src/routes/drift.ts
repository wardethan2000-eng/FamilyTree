import type { FastifyInstance } from "fastify";
import { getSession } from "../lib/session.js";
import { db } from "../lib/db.js";
import { getTreeMemories } from "../lib/cross-tree-read-service.js";
import { mediaUrl } from "../lib/storage.js";

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
}

// Deterministic PRNG so the same seed reliably produces the same drift order.
function mulberry32(seedInput: number) {
  let a = seedInput >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(seedFromString(seed));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export async function driftPlugin(app: FastifyInstance) {
  app.get("/api/trees/:treeId/drift", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const query = request.query as { seed?: string; limit?: string };
    const seed = query.seed && query.seed.length > 0 ? query.seed : `${treeId}:${Date.now()}`;
    const requestedLimit = query.limit ? Number.parseInt(query.limit, 10) : 400;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(800, Math.max(1, requestedLimit))
      : 400;

    const memories = await getTreeMemories(treeId, {
      viewerUserId: session.user.id,
    });

    const serialized = memories.map((memory) => {
      const primary = memory.primaryPerson;
      const mediaItems = (memory.mediaItems ?? []).map((item) => ({
        id: item.id,
        mediaId: item.mediaId,
        mediaUrl: item.media ? mediaUrl(item.media.objectKey) : null,
        mimeType: item.media?.mimeType ?? null,
        linkedMediaProvider: item.linkedMediaProvider,
        linkedMediaPreviewUrl: item.linkedMediaPreviewUrl,
        linkedMediaOpenUrl: item.linkedMediaOpenUrl,
        linkedMediaLabel: item.linkedMediaLabel,
        sortOrder: item.sortOrder,
      }));

      return {
        id: memory.id,
        primaryPersonId: memory.primaryPersonId,
        primaryPerson: primary
          ? {
              id: primary.id,
              name: primary.displayName,
              portraitUrl: primary.portraitMedia
                ? mediaUrl(primary.portraitMedia.objectKey)
                : null,
            }
          : null,
        kind: memory.kind,
        title: memory.title,
        body: memory.body,
        transcriptText: memory.transcriptText,
        transcriptStatus: memory.transcriptStatus,
        dateOfEventText: memory.dateOfEventText,
        mediaUrl: memory.media ? mediaUrl(memory.media.objectKey) : null,
        mimeType: memory.media?.mimeType ?? null,
        mediaItems,
      };
    });

    const shuffled = seededShuffle(serialized, seed).slice(0, limit);

    return reply.send({
      treeId,
      seed,
      count: shuffled.length,
      memories: shuffled,
    });
  });
}
