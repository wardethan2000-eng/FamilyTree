import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as schema from "@familytree/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import { canManageTreeScope } from "../lib/cross-tree-permission-service.js";
import { parseGedcom } from "../lib/gedcom-parser.js";

const GedcomImportBody = z.object({
  gedcom: z.string().min(1).max(20 * 1024 * 1024), // 20 MB cap
});

function normalizePair(aId: string, bId: string) {
  return aId < bId
    ? { normalizedPersonAId: aId, normalizedPersonBId: bId }
    : { normalizedPersonAId: bId, normalizedPersonBId: aId };
}

/** Truncate a string to `max` characters, safe for DB varchar columns */
function truncate(value: string | null | undefined, max: number): string | undefined {
  if (value == null) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

export async function importPlugin(app: FastifyInstance): Promise<void> {
  app.post("/api/trees/:treeId/import/gedcom", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      columns: { role: true },
    });

    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (!canManageTreeScope(membership.role)) {
      return reply.status(403).send({ error: "Only founders and stewards can import" });
    }

    const tree = await db.query.trees.findFirst({
      where: (t, { eq }) => eq(t.id, treeId),
      columns: { id: true },
    });
    if (!tree) return reply.status(404).send({ error: "Tree not found" });

    // Warn if tree already has people (re-import creates duplicates)
    const existingPeople = await db.query.people.findFirst({
      where: (p, { eq }) => eq(p.treeId, treeId),
      columns: { id: true },
    });
    // We don't block — just include a flag in the response so UI can warn

    const parsed = GedcomImportBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    let gedcom;
    try {
      gedcom = parseGedcom(parsed.data.gedcom);
    } catch {
      return reply.status(400).send({ error: "Could not parse GEDCOM file" });
    }

    if (gedcom.individuals.size === 0) {
      return reply.status(400).send({ error: "No individuals found in GEDCOM file" });
    }

    // Map GEDCOM xref → new database UUID
    const xrefToId = new Map<string, string>();
    for (const xref of gedcom.individuals.keys()) {
      xrefToId.set(xref, randomUUID());
    }

    let peopleCreated = 0;
    let relationshipsCreated = 0;
    let skipped = 0;

    await db.transaction(async (tx) => {
      // Insert all individuals with field-length truncation
      const peopleRows = [...gedcom.individuals.values()].map((individual) => ({
        id: xrefToId.get(individual.xref)!,
        treeId,
        displayName: truncate(individual.displayName, 200) ?? "Unknown",
        birthDateText: truncate(individual.birthDateText, 100),
        deathDateText: truncate(individual.deathDateText, 100),
        birthPlace: truncate(individual.birthPlace, 200),
        deathPlace: truncate(individual.deathPlace, 200),
        isLiving: !individual.isDeceased,
      }));

      await tx.insert(schema.people).values(peopleRows);
      peopleCreated = peopleRows.length;

      // Track inserted relationship pairs to avoid duplicates within this import
      const insertedPairs = new Set<string>();

      function pairKey(aId: string, bId: string, type: string) {
        const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
        return `${type}:${lo}:${hi}`;
      }

      async function insertRelationship(
        fromPersonId: string,
        toPersonId: string,
        type: "parent_child" | "sibling" | "spouse",
        spouseStatus?: "active",
        startDateText?: string | null,
      ) {
        const key = pairKey(fromPersonId, toPersonId, type);
        if (insertedPairs.has(key)) {
          skipped++;
          return;
        }
        insertedPairs.add(key);

        // Only spouse/sibling get normalized pair IDs (matches relationship-service)
        const normalizedPair =
          type === "spouse" || type === "sibling"
            ? normalizePair(fromPersonId, toPersonId)
            : { normalizedPersonAId: null, normalizedPersonBId: null };

        await tx.insert(schema.relationships).values({
          id: randomUUID(),
          treeId,
          createdInTreeId: treeId,
          fromPersonId,
          toPersonId,
          type,
          normalizedPersonAId: normalizedPair.normalizedPersonAId,
          normalizedPersonBId: normalizedPair.normalizedPersonBId,
          spouseStatus: type === "spouse" ? (spouseStatus ?? "active") : undefined,
          startDateText: startDateText ? truncate(startDateText, 100) : undefined,
        });

        relationshipsCreated++;
      }

      // Process each family record
      for (const family of gedcom.families.values()) {
        const husbandId = family.husbandXref ? xrefToId.get(family.husbandXref) : null;
        const wifeId = family.wifeXref ? xrefToId.get(family.wifeXref) : null;

        // Spouse relationship
        if (husbandId && wifeId) {
          await insertRelationship(husbandId, wifeId, "spouse", "active", family.marriageDateText);
        }

        // Parent-child relationships
        const parentIds = [husbandId, wifeId].filter((id): id is string => Boolean(id));
        for (const childXref of family.childXrefs) {
          const childId = xrefToId.get(childXref);
          if (!childId) {
            skipped++;
            continue;
          }
          for (const parentId of parentIds) {
            // parent is "from", child is "to" in parent_child relationships
            await insertRelationship(parentId, childId, "parent_child");
          }
        }
      }
    });

    return reply.status(201).send({
      peopleCreated,
      relationshipsCreated,
      skipped,
      treeHadExistingPeople: !!existingPeople,
    });
  });

  // Preview endpoint — parse only, no writes
  app.post("/api/trees/:treeId/import/gedcom/preview", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      columns: { role: true },
    });
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });
    if (!canManageTreeScope(membership.role)) {
      return reply.status(403).send({ error: "Only founders and stewards can import" });
    }

    const parsed = GedcomImportBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request body" });

    let gedcom;
    try {
      gedcom = parseGedcom(parsed.data.gedcom);
    } catch {
      return reply.status(400).send({ error: "Could not parse GEDCOM file" });
    }

    // Count expected relationships
    let expectedRelationships = 0;
    const seen = new Set<string>();
    for (const family of gedcom.families.values()) {
      const husbandId = family.husbandXref;
      const wifeId = family.wifeXref;

      if (husbandId && wifeId) {
        const key = [husbandId, wifeId].sort().join(":");
        if (!seen.has(`spouse:${key}`)) {
          seen.add(`spouse:${key}`);
          expectedRelationships++;
        }
      }

      const parents = [husbandId, wifeId].filter(Boolean) as string[];
      for (const childXref of family.childXrefs) {
        if (!gedcom.individuals.has(childXref)) continue;
        for (const parentXref of parents) {
          const key = [parentXref, childXref].sort().join(":");
          if (!seen.has(`parent_child:${key}`)) {
            seen.add(`parent_child:${key}`);
            expectedRelationships++;
          }
        }
      }
    }

    // Check if tree already has people (for re-import warning)
    const existingPeople = await db.query.people.findFirst({
      where: (p, { eq }) => eq(p.treeId, treeId),
      columns: { id: true },
    });

    return reply.send({
      individualsFound: gedcom.individuals.size,
      familiesFound: gedcom.families.size,
      expectedRelationships,
      treeHadExistingPeople: !!existingPeople,
    });
  });
}
