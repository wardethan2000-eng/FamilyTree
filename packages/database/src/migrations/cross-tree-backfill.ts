import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../client.js";
import * as schema from "../schema.js";

export interface LegacyCrossTreeMergeCandidate {
  connectionId: string;
  personAId: string;
  personADisplayName: string | null;
  personBId: string;
  personBDisplayName: string | null;
}

export interface CrossTreeBackfillSummary {
  treePersonScopeRowsInserted: number;
  peopleHomeTreeBackfilled: number;
  relationshipsCreatedInTreeBackfilled: number;
  memoriesContributingTreeBackfilled: number;
  mediaContributingTreeBackfilled: number;
  memoryTagRowsInserted: number;
  legacyMergeCandidates: LegacyCrossTreeMergeCandidate[];
}

async function collectLegacyCrossTreeMergeCandidates(
  db: DbClient,
): Promise<LegacyCrossTreeMergeCandidate[]> {
  const links = await db.select().from(schema.crossTreePersonLinks);
  const candidates: LegacyCrossTreeMergeCandidate[] = [];

  for (const link of links) {
    const [personA, personB] = await Promise.all([
      db
        .select({
          id: schema.people.id,
          displayName: schema.people.displayName,
        })
        .from(schema.people)
        .where(eq(schema.people.id, link.personAId))
        .limit(1),
      db
        .select({
          id: schema.people.id,
          displayName: schema.people.displayName,
        })
        .from(schema.people)
        .where(eq(schema.people.id, link.personBId))
        .limit(1),
    ]);

    candidates.push({
      connectionId: link.connectionId,
      personAId: link.personAId,
      personADisplayName: personA[0]?.displayName ?? null,
      personBId: link.personBId,
      personBDisplayName: personB[0]?.displayName ?? null,
    });
  }

  return candidates;
}

export async function backfillCrossTreeSchema(
  db: DbClient,
): Promise<CrossTreeBackfillSummary> {
  const summary = await db.transaction(async (tx) => {
    const treePersonScopeRowsInserted = await tx.execute(sql`
      INSERT INTO tree_person_scope (
        tree_id,
        person_id,
        visibility_default,
        added_at
      )
      SELECT
        tree_id,
        id,
        'all_members'::tree_scope_visibility,
        created_at
      FROM people
      WHERE tree_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    const peopleHomeTreeBackfilled = await tx.execute(sql`
      UPDATE people
      SET home_tree_id = tree_id
      WHERE tree_id IS NOT NULL
        AND home_tree_id IS NULL
    `);

    const relationshipsCreatedInTreeBackfilled = await tx.execute(sql`
      UPDATE relationships
      SET created_in_tree_id = tree_id
      WHERE tree_id IS NOT NULL
        AND created_in_tree_id IS NULL
    `);

    const memoriesContributingTreeBackfilled = await tx.execute(sql`
      UPDATE memories
      SET contributing_tree_id = tree_id
      WHERE tree_id IS NOT NULL
        AND contributing_tree_id IS NULL
    `);

    const mediaContributingTreeBackfilled = await tx.execute(sql`
      UPDATE media
      SET contributing_tree_id = tree_id
      WHERE tree_id IS NOT NULL
        AND contributing_tree_id IS NULL
    `);

    const memoryTagRowsInserted = await tx.execute(sql`
      INSERT INTO memory_person_tags (memory_id, person_id)
      SELECT id, primary_person_id
      FROM memories
      ON CONFLICT DO NOTHING
    `);

    return {
      treePersonScopeRowsInserted: treePersonScopeRowsInserted.rowCount ?? 0,
      peopleHomeTreeBackfilled: peopleHomeTreeBackfilled.rowCount ?? 0,
      relationshipsCreatedInTreeBackfilled:
        relationshipsCreatedInTreeBackfilled.rowCount ?? 0,
      memoriesContributingTreeBackfilled:
        memoriesContributingTreeBackfilled.rowCount ?? 0,
      mediaContributingTreeBackfilled: mediaContributingTreeBackfilled.rowCount ?? 0,
      memoryTagRowsInserted: memoryTagRowsInserted.rowCount ?? 0,
    };
  });

  return {
    ...summary,
    legacyMergeCandidates: await collectLegacyCrossTreeMergeCandidates(db),
  };
}
