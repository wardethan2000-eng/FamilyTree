import { and, eq, sql, isNotNull } from "drizzle-orm";
import type { DbClient } from "../client.js";
import * as schema from "../schema.js";

type MemoryRow = {
  id: string;
  treeId: string;
  primaryPersonId: string;
  kind: string;
  dateOfEventText: string | null;
  body: string | null;
  title: string;
};

type PersonRow = {
  id: string;
  treeId: string;
  birthDateText: string | null;
  deathDateText: string | null;
  isLiving: boolean;
};

type BranchRow = {
  id: string;
  treeId: string;
  name: string;
  isDefault: boolean;
};

export interface BranchBackfillSummary {
  dryRun: boolean;
  defaultBranchesCreated: number;
  memoriesTagged: number;
  treesProcessed: number;
  errors: string[];
}

const BRANCH_RULES: { name: string; keywords: string[]; maxAge?: number; minAge?: number; kinds?: string[] }[] = [
  {
    name: "Childhood",
    keywords: ["childhood", "born", "birth", "baby", "infant", "toddler", "kid", "growing up", "little", "young"],
    maxAge: 18,
  },
  {
    name: "School & Education",
    keywords: ["school", "college", "university", "class", "teacher", "graduation", "student", "study", "education", "campus", "degree", "diploma"],
    maxAge: 25,
    minAge: 5,
  },
  {
    name: "Romance & Partnership",
    keywords: ["wedding", "marriage", "married", "love", "romance", "engagement", "engaged", "honeymoon", "anniversary", "partner", "spouse", "husband", "wife", "fiance"],
  },
  {
    name: "Parenthood & Family",
    keywords: ["baby", "born", "birth", "pregnancy", "parenthood", "parent", "mother", "father", "newborn", "nursery", "adoption", "maternity", "family"],
  },
  {
    name: "Career & Calling",
    keywords: ["career", "job", "work", "profession", "retirement", "promoted", "business", "company", "office", "colleague", "boss", "award", "achievement"],
  },
  {
    name: "Travel & Adventure",
    keywords: ["trip", "travel", "vacation", "adventure", "journey", "road trip", "cruise", "expedition", "explore", "hike", "camp", "backpack"],
  },
  {
    name: "Home & Place",
    keywords: ["home", "house", "moved", "town", "city", "neighborhood", "community", "apartment", "garden", "kitchen", "yard", "living room"],
  },
  {
    name: "Recipes & Traditions",
    keywords: ["recipe", "cooking", "bake", "baking", "thanksgiving", "christmas", "holiday", "tradition", "feast", "dinner", "meal", "food", "kitchen"],
    kinds: ["recipe"],
  },
  {
    name: "Loss & Remembrance",
    keywords: ["died", "death", "passed away", "funeral", "memorial", "grief", "mourning", "loss", "remember", "tribute", "remembrance", "eulogy", "obituary"],
  },
  {
    name: "Just Between Us",
    keywords: ["secret", "private", "just between", "personal", "intimate", "whispered", "confession"],
    kinds: ["voice"],
  },
];

function extractYear(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/\b(\d{4})\b/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

function estimatePersonAgeAtEvent(
  person: PersonRow | undefined,
  eventYear: number | null,
): number | null {
  if (!person || !eventYear) return null;
  const birthYear = extractYear(person.birthDateText);
  if (!birthYear) return null;
  return eventYear - birthYear;
}

function matchBranchesForMemory(
  memory: MemoryRow,
  person: PersonRow | undefined,
  branchNames: Set<string>,
): string[] {
  const matched: string[] = [];
  const textContent = `${memory.title} ${memory.body ?? ""}`.toLowerCase();
  const eventYear = extractYear(memory.dateOfEventText);
  const estimatedAge = estimatePersonAgeAtEvent(person, eventYear);

  for (const rule of BRANCH_RULES) {
    if (!branchNames.has(rule.name)) continue;

    let score = 0;

    for (const keyword of rule.keywords) {
      if (textContent.includes(keyword)) {
        score += 1;
      }
    }

    if (rule.kinds && rule.kinds.includes(memory.kind)) {
      score += 2;
    }

    if (estimatedAge !== null) {
      if (rule.maxAge !== undefined && estimatedAge <= rule.maxAge) score += 1;
      if (rule.minAge !== undefined && estimatedAge >= rule.minAge) score += 1;
    }

    if (score >= 1 && matched.length < 3) {
      matched.push(rule.name);
    }
  }

  return matched;
}

export async function previewBranchBackfill(db: DbClient): Promise<BranchBackfillSummary> {
  return performBranchBackfill(db, true);
}

export async function backfillBranches(db: DbClient): Promise<BranchBackfillSummary> {
  return performBranchBackfill(db, false);
}

async function performBranchBackfill(
  db: DbClient,
  dryRun: boolean,
): Promise<BranchBackfillSummary> {
  const summary: BranchBackfillSummary = {
    dryRun,
    defaultBranchesCreated: 0,
    memoriesTagged: 0,
    treesProcessed: 0,
    errors: [],
  };

  const allTrees = await db.query.trees.findMany();
  summary.treesProcessed = allTrees.length;

  for (const tree of allTrees) {
    try {
      const existingDefaults = await db.query.branches.findMany({
        where: (b, { and, eq }) => and(eq(b.treeId, tree.id), eq(b.isDefault, true)),
      });

      if (existingDefaults.length === 0) {
        if (!dryRun) {
          const ACCENT_PALETTE = [
            "moss", "rose", "gilt", "ink-soft",
            "moss", "rose", "gilt", "ink-soft",
            "moss", "rose",
          ];
          const DEFAULT_NAMES = [
            "Childhood", "School & Education", "Romance & Partnership",
            "Parenthood & Family", "Career & Calling", "Travel & Adventure",
            "Home & Place", "Recipes & Traditions", "Loss & Remembrance",
            "Just Between Us",
          ];
          await db.insert(schema.branches).values(
            DEFAULT_NAMES.map((name, i) => ({
              treeId: tree.id,
              name,
              sortWeight: i,
              isDefault: true,
              accent: ACCENT_PALETTE[i] ?? "moss",
            })),
          );
        }
        summary.defaultBranchesCreated += 10;
      }

      const branches = dryRun
        ? existingDefaults.length > 0
          ? existingDefaults
          : BRANCH_RULES.map((r, i) => ({
              id: `preview-${i}`,
              treeId: tree.id,
              name: r.name,
              description: null as string | null,
              sortWeight: i,
              isDefault: true,
              accent: null as string | null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          : await db.query.branches.findMany({
              where: (b, { eq }) => eq(b.treeId, tree.id),
              orderBy: (b, { asc }) => [asc(b.sortWeight)],
            });

      const branchNameMap = new Map(branches.map((b) => [b.name, b.id]));
      const branchNames = new Set(branchNameMap.keys());

      const people = await db.query.people.findMany({
        where: (p, { eq }) => eq(p.treeId, tree.id),
      });
      const personMap = new Map(people.map((p) => [p.id, p]));

      const memories = await db.query.memories.findMany({
        where: (m, { eq }) => eq(m.treeId, tree.id),
      });

      const existingTags = await db.query.memoryBranches.findMany({
        where: (mb, { inArray }) =>
          inArray(mb.branchId, branches.map((b) => b.id)),
      });

      const memoriesWithBranches = new Set(existingTags.map((t) => t.memoryId));

      const memoriesToTag = memories.filter((m) => !memoriesWithBranches.has(m.id));

      const tagValues: { memoryId: string; branchId: string }[] = [];

      for (const memory of memoriesToTag) {
        const memoryRow: MemoryRow = {
          id: memory.id,
          treeId: memory.treeId,
          primaryPersonId: memory.primaryPersonId,
          kind: memory.kind,
          dateOfEventText: memory.dateOfEventText ?? null,
          body: memory.body ?? null,
          title: memory.title,
        };

        const person = personMap.get(memory.primaryPersonId);
        const personRow: PersonRow | undefined = person
          ? {
              id: person.id,
              treeId: person.treeId,
              birthDateText: person.birthDateText ?? null,
              deathDateText: person.deathDateText ?? null,
              isLiving: person.isLiving,
            }
          : undefined;

        const matchedBranchNames = matchBranchesForMemory(memoryRow, personRow, branchNames);

        for (const branchName of matchedBranchNames) {
          const branchId = branchNameMap.get(branchName);
          if (branchId) {
            tagValues.push({ memoryId: memory.id, branchId });
          }
        }
      }

      if (tagValues.length > 0 && !dryRun) {
        await db.insert(schema.memoryBranches).values(tagValues).onConflictDoNothing();
      }

      summary.memoriesTagged += tagValues.length;
    } catch (error) {
      summary.errors.push(
        `Tree ${tree.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return summary;
}