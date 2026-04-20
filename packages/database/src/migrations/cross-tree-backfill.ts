import { sql } from "drizzle-orm";
import type { DbClient } from "../client.js";
import * as schema from "../schema.js";

export interface LegacyCrossTreeMergeCandidate extends Record<string, unknown> {
  connectionId: string;
  personAId: string;
  personADisplayName: string | null;
  personBId: string;
  personBDisplayName: string | null;
}

export interface CrossTreeBackfillSummary {
  dryRun: boolean;
  treePersonScopeRowsInserted: number;
  peopleHomeTreeBackfilled: number;
  relationshipsCreatedInTreeBackfilled: number;
  memoriesContributingTreeBackfilled: number;
  mediaContributingTreeBackfilled: number;
  memoryTagRowsInserted: number;
  legacyMergeCandidates: LegacyCrossTreeMergeCandidate[];
}

export interface CrossTreeBackfillOptions {
  dryRun?: boolean;
}

type CrossTreeBackfillCounts = Omit<
  CrossTreeBackfillSummary,
  "dryRun" | "legacyMergeCandidates"
>;

interface ExistingRelationRow extends Record<string, unknown> {
  relationName: string | null;
}

async function collectLegacyCrossTreeMergeCandidates(
  db: DbClient,
): Promise<LegacyCrossTreeMergeCandidate[]> {
  const relationCheck = await db.execute<ExistingRelationRow>(sql`
    SELECT to_regclass('public.cross_tree_person_links') AS "relationName"
  `);

  if (!relationCheck.rows[0]?.relationName) {
    return [];
  }

  const result = await db.execute<LegacyCrossTreeMergeCandidate>(sql`
    SELECT
      links.connection_id AS "connectionId",
      links.person_a_id AS "personAId",
      person_a.display_name AS "personADisplayName",
      links.person_b_id AS "personBId",
      person_b.display_name AS "personBDisplayName"
    FROM cross_tree_person_links AS links
    LEFT JOIN people AS person_a ON person_a.id = links.person_a_id
    LEFT JOIN people AS person_b ON person_b.id = links.person_b_id
    ORDER BY links.connection_id, links.person_a_id, links.person_b_id
  `);

  return result.rows;
}

async function countRows(db: DbClient, query: ReturnType<typeof sql>) {
  const result = await db.execute<{ count: number | string }>(query);
  return Number(result.rows[0]?.count ?? 0);
}

async function collectBackfillCounts(db: DbClient): Promise<CrossTreeBackfillCounts> {
  const [
    treePersonScopeRowsInserted,
    peopleHomeTreeBackfilled,
    relationshipsCreatedInTreeBackfilled,
    memoriesContributingTreeBackfilled,
    mediaContributingTreeBackfilled,
    memoryTagRowsInserted,
  ] = await Promise.all([
    countRows(
      db,
      sql`
        SELECT COUNT(*)::int AS count
        FROM people AS person
        WHERE person.tree_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM tree_person_scope AS scope
            WHERE scope.tree_id = person.tree_id
              AND scope.person_id = person.id
          )
      `,
    ),
    countRows(
      db,
      sql`
        SELECT COUNT(*)::int AS count
        FROM people
        WHERE tree_id IS NOT NULL
          AND home_tree_id IS NULL
      `,
    ),
    countRows(
      db,
      sql`
        SELECT COUNT(*)::int AS count
        FROM relationships
        WHERE tree_id IS NOT NULL
          AND created_in_tree_id IS NULL
      `,
    ),
    countRows(
      db,
      sql`
        SELECT COUNT(*)::int AS count
        FROM memories
        WHERE tree_id IS NOT NULL
          AND contributing_tree_id IS NULL
      `,
    ),
    countRows(
      db,
      sql`
        SELECT COUNT(*)::int AS count
        FROM media
        WHERE tree_id IS NOT NULL
          AND contributing_tree_id IS NULL
      `,
    ),
    countRows(
      db,
      sql`
        SELECT COUNT(*)::int AS count
        FROM memories AS memory
        WHERE NOT EXISTS (
          SELECT 1
          FROM memory_person_tags AS tag
          WHERE tag.memory_id = memory.id
            AND tag.person_id = memory.primary_person_id
        )
      `,
    ),
  ]);

  return {
    treePersonScopeRowsInserted,
    peopleHomeTreeBackfilled,
    relationshipsCreatedInTreeBackfilled,
    memoriesContributingTreeBackfilled,
    mediaContributingTreeBackfilled,
    memoryTagRowsInserted,
  };
}

export async function previewCrossTreeBackfill(
  db: DbClient,
): Promise<CrossTreeBackfillSummary> {
  const [counts, legacyMergeCandidates] = await Promise.all([
    collectBackfillCounts(db),
    collectLegacyCrossTreeMergeCandidates(db),
  ]);

  return {
    dryRun: true,
    ...counts,
    legacyMergeCandidates,
  };
}

export async function backfillCrossTreeSchema(
  db: DbClient,
  options: CrossTreeBackfillOptions = {},
): Promise<CrossTreeBackfillSummary> {
  if (options.dryRun) {
    return previewCrossTreeBackfill(db);
  }

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
    dryRun: false,
    ...summary,
    legacyMergeCandidates: await collectLegacyCrossTreeMergeCandidates(db),
  };
}
