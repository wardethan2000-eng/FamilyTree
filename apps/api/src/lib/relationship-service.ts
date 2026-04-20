import { and, eq } from "drizzle-orm";
import * as schema from "@familytree/database";
import { db } from "./db.js";

type RelationshipType = "parent_child" | "sibling" | "spouse";
type SpouseStatus = "active" | "former" | "deceased_partner";
type ParentChildLink = {
  fromPersonId: string;
  toPersonId: string;
};

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class RelationshipRuleError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RelationshipRuleError";
    this.status = status;
  }
}

function normalizePair(personAId: string, personBId: string) {
  return personAId < personBId
    ? { normalizedPersonAId: personAId, normalizedPersonBId: personBId }
    : { normalizedPersonAId: personBId, normalizedPersonBId: personAId };
}

function resolveSpouseStatus(
  type: RelationshipType,
  requestedSpouseStatus: SpouseStatus | null | undefined,
  existingSpouseStatus: SpouseStatus | null | undefined,
): SpouseStatus | null {
  if (type !== "spouse") return null;
  return requestedSpouseStatus ?? existingSpouseStatus ?? "active";
}

async function ensurePeopleInTree(
  tx: TxClient,
  treeId: string,
  personIds: readonly [string, string],
) {
  const [fromPerson, toPerson] = await Promise.all([
    tx.query.people.findFirst({
      where: (p, { and, eq }) => and(eq(p.id, personIds[0]), eq(p.treeId, treeId)),
    }),
    tx.query.people.findFirst({
      where: (p, { and, eq }) => and(eq(p.id, personIds[1]), eq(p.treeId, treeId)),
    }),
  ]);

  if (!fromPerson || !toPerson) {
    throw new RelationshipRuleError("Both people must belong to this tree");
  }
}

async function assertNoDuplicateRelationship(
  tx: TxClient,
  params: {
    treeId: string;
    fromPersonId: string;
    toPersonId: string;
    type: RelationshipType;
    excludeRelationshipId?: string;
  },
) {
  const {
    treeId,
    fromPersonId,
    toPersonId,
    type,
    excludeRelationshipId,
  } = params;

  if (type === "parent_child") {
    const existing = await tx.query.relationships.findFirst({
      where: (r, { and, eq, ne }) =>
        excludeRelationshipId
          ? and(
              eq(r.treeId, treeId),
              eq(r.type, type),
              eq(r.fromPersonId, fromPersonId),
              eq(r.toPersonId, toPersonId),
              ne(r.id, excludeRelationshipId),
            )
          : and(
              eq(r.treeId, treeId),
              eq(r.type, type),
              eq(r.fromPersonId, fromPersonId),
              eq(r.toPersonId, toPersonId),
            ),
    });
    if (existing) {
      throw new RelationshipRuleError("This parent/child relationship already exists", 409);
    }
    return;
  }

  const { normalizedPersonAId, normalizedPersonBId } = normalizePair(
    fromPersonId,
    toPersonId,
  );

  const existing = await tx.query.relationships.findFirst({
    where: (r, { and, eq, ne }) =>
      excludeRelationshipId
        ? and(
            eq(r.treeId, treeId),
            eq(r.type, type),
            eq(r.normalizedPersonAId, normalizedPersonAId),
            eq(r.normalizedPersonBId, normalizedPersonBId),
            ne(r.id, excludeRelationshipId),
          )
        : and(
            eq(r.treeId, treeId),
            eq(r.type, type),
            eq(r.normalizedPersonAId, normalizedPersonAId),
            eq(r.normalizedPersonBId, normalizedPersonBId),
          ),
  });

  if (existing) {
    const label = type === "spouse" ? "spouse" : "sibling";
    throw new RelationshipRuleError(`This ${label} relationship already exists`, 409);
  }
}

async function assertNoImmediateParentCycle(
  tx: TxClient,
  params: {
    treeId: string;
    fromPersonId: string;
    toPersonId: string;
    excludeRelationshipId?: string;
  },
) {
  const { treeId, fromPersonId, toPersonId, excludeRelationshipId } = params;

  const reverse = await tx.query.relationships.findFirst({
    where: (r, { and, eq, ne }) =>
      excludeRelationshipId
        ? and(
            eq(r.treeId, treeId),
            eq(r.type, "parent_child"),
            eq(r.fromPersonId, toPersonId),
            eq(r.toPersonId, fromPersonId),
            ne(r.id, excludeRelationshipId),
          )
        : and(
            eq(r.treeId, treeId),
            eq(r.type, "parent_child"),
            eq(r.fromPersonId, toPersonId),
            eq(r.toPersonId, fromPersonId),
          ),
  });

  if (reverse) {
    throw new RelationshipRuleError("This parent/child link would create an invalid cycle");
  }
}

async function assertParentLimit(
  tx: TxClient,
  params: {
    treeId: string;
    childPersonId: string;
    excludeRelationshipId?: string;
  },
) {
  const { treeId, childPersonId, excludeRelationshipId } = params;

  const parents = await tx.query.relationships.findMany({
    where: (r, { and, eq, ne }) =>
      excludeRelationshipId
        ? and(
            eq(r.treeId, treeId),
            eq(r.type, "parent_child"),
            eq(r.toPersonId, childPersonId),
            ne(r.id, excludeRelationshipId),
          )
        : and(
            eq(r.treeId, treeId),
            eq(r.type, "parent_child"),
            eq(r.toPersonId, childPersonId),
          ),
    columns: { id: true },
  });

  if (parents.length >= 2) {
    throw new RelationshipRuleError(
      "This person already has two parents. Edit or replace an existing parent relationship first.",
      409,
    );
  }
}

async function assertActiveSpouseAvailability(
  tx: TxClient,
  params: {
    treeId: string;
    personId: string;
    partnerId: string;
    excludeRelationshipId?: string;
  },
) {
  const { treeId, personId, partnerId, excludeRelationshipId } = params;

  const activeSpouse = await tx.query.relationships.findFirst({
    where: (r, { and, eq, ne, or }) =>
      excludeRelationshipId
        ? and(
            eq(r.treeId, treeId),
            eq(r.type, "spouse"),
            eq(r.spouseStatus, "active"),
            or(eq(r.fromPersonId, personId), eq(r.toPersonId, personId)),
            ne(r.id, excludeRelationshipId),
          )
        : and(
            eq(r.treeId, treeId),
            eq(r.type, "spouse"),
            eq(r.spouseStatus, "active"),
            or(eq(r.fromPersonId, personId), eq(r.toPersonId, personId)),
          ),
  });

  if (!activeSpouse) return;

  const samePair =
    (activeSpouse.fromPersonId === personId && activeSpouse.toPersonId === partnerId) ||
    (activeSpouse.fromPersonId === partnerId && activeSpouse.toPersonId === personId);
  if (samePair) return;

  throw new RelationshipRuleError(
    "This person already has an active spouse relationship. End that relationship before adding a new active spouse.",
    409,
  );
}

function parentChildLinkKey({ fromPersonId, toPersonId }: ParentChildLink) {
  return `${fromPersonId}->${toPersonId}`;
}

function dedupePersonIds(personIds: string[]) {
  return [...new Set(personIds)].sort();
}

async function listParentIdsForChild(
  tx: TxClient,
  treeId: string,
  childPersonId: string,
) {
  const relationships = await tx.query.relationships.findMany({
    where: (r, { and, eq }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "parent_child"),
        eq(r.toPersonId, childPersonId),
      ),
    columns: { fromPersonId: true },
  });

  return dedupePersonIds(
    relationships
      .map((relationship) => relationship.fromPersonId)
      .filter((personId): personId is string => Boolean(personId)),
  );
}

async function listChildIdsForParent(
  tx: TxClient,
  treeId: string,
  parentPersonId: string,
) {
  const relationships = await tx.query.relationships.findMany({
    where: (r, { and, eq }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "parent_child"),
        eq(r.fromPersonId, parentPersonId),
      ),
    columns: { toPersonId: true },
  });

  return dedupePersonIds(
    relationships
      .map((relationship) => relationship.toPersonId)
      .filter((personId): personId is string => Boolean(personId)),
  );
}

async function listActiveSpouseIds(
  tx: TxClient,
  treeId: string,
  personId: string,
) {
  const relationships = await tx.query.relationships.findMany({
    where: (r, { and, eq, or }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "spouse"),
        eq(r.spouseStatus, "active"),
        or(eq(r.fromPersonId, personId), eq(r.toPersonId, personId)),
      ),
    columns: { fromPersonId: true, toPersonId: true },
  });

  return dedupePersonIds(
    relationships
      .flatMap((relationship) => {
        if (relationship.fromPersonId === personId && relationship.toPersonId) {
          return [relationship.toPersonId];
        }
        if (relationship.toPersonId === personId && relationship.fromPersonId) {
          return [relationship.fromPersonId];
        }
        return [];
      })
      .filter((partnerId): partnerId is string => Boolean(partnerId)),
  );
}

async function listExplicitSiblingIds(
  tx: TxClient,
  treeId: string,
  personId: string,
) {
  const relationships = await tx.query.relationships.findMany({
    where: (r, { and, eq, or }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "sibling"),
        or(eq(r.fromPersonId, personId), eq(r.toPersonId, personId)),
      ),
    columns: { fromPersonId: true, toPersonId: true },
  });

  return dedupePersonIds(
    relationships
      .flatMap((relationship) => {
        if (relationship.fromPersonId === personId && relationship.toPersonId) {
          return [relationship.toPersonId];
        }
        if (relationship.toPersonId === personId && relationship.fromPersonId) {
          return [relationship.fromPersonId];
        }
        return [];
      })
      .filter((siblingId): siblingId is string => Boolean(siblingId)),
  );
}

async function listSiblingIds(
  tx: TxClient,
  treeId: string,
  personId: string,
) {
  const [parentIds, explicitSiblingIds] = await Promise.all([
    listParentIdsForChild(tx, treeId, personId),
    listExplicitSiblingIds(tx, treeId, personId),
  ]);

  const siblingIds = new Set(explicitSiblingIds);
  if (parentIds.length === 0) {
    return [...siblingIds].sort();
  }

  const sharedParentRelationships = await tx.query.relationships.findMany({
    where: (r, { and, eq, ne, or }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "parent_child"),
        ne(r.toPersonId, personId),
        parentIds.length === 1
          ? eq(r.fromPersonId, parentIds[0]!)
          : or(eq(r.fromPersonId, parentIds[0]!), eq(r.fromPersonId, parentIds[1]!)),
      ),
    columns: { toPersonId: true },
  });

  for (const relationship of sharedParentRelationships) {
    if (relationship.toPersonId) {
      siblingIds.add(relationship.toPersonId);
    }
  }

  return [...siblingIds].sort();
}

function dedupeParentChildLinks(links: ParentChildLink[]) {
  const deduped = new Map<string, ParentChildLink>();
  for (const link of links) {
    if (link.fromPersonId === link.toPersonId) continue;
    deduped.set(parentChildLinkKey(link), link);
  }
  return [...deduped.values()];
}

async function buildInitialParentChildInferenceCandidates(
  tx: TxClient,
  params: {
    treeId: string;
    fromPersonId: string;
    toPersonId: string;
    type: RelationshipType;
    spouseStatus: SpouseStatus | null;
  },
) {
  const { treeId, fromPersonId, toPersonId, type, spouseStatus } = params;

  if (type === "spouse" && spouseStatus === "active") {
    const [fromChildren, toChildren] = await Promise.all([
      listChildIdsForParent(tx, treeId, fromPersonId),
      listChildIdsForParent(tx, treeId, toPersonId),
    ]);

    return dedupeParentChildLinks([
      ...fromChildren.map((childPersonId) => ({
        fromPersonId: toPersonId,
        toPersonId: childPersonId,
      })),
      ...toChildren.map((childPersonId) => ({
        fromPersonId: fromPersonId,
        toPersonId: childPersonId,
      })),
    ]);
  }

  if (type === "sibling") {
    const [fromParents, toParents] = await Promise.all([
      listParentIdsForChild(tx, treeId, fromPersonId),
      listParentIdsForChild(tx, treeId, toPersonId),
    ]);

    return dedupeParentChildLinks([
      ...fromParents.map((parentPersonId) => ({
        fromPersonId: parentPersonId,
        toPersonId,
      })),
      ...toParents.map((parentPersonId) => ({
        fromPersonId: parentPersonId,
        toPersonId: fromPersonId,
      })),
    ]);
  }

  return [];
}

async function buildPropagatedParentChildInferenceCandidates(
  tx: TxClient,
  treeId: string,
  link: ParentChildLink,
) {
  const [spouseIds, siblingIds] = await Promise.all([
    listActiveSpouseIds(tx, treeId, link.fromPersonId),
    listSiblingIds(tx, treeId, link.toPersonId),
  ]);

  return dedupeParentChildLinks([
    ...spouseIds.map((spouseId) => ({
      fromPersonId: spouseId,
      toPersonId: link.toPersonId,
    })),
    ...siblingIds.map((siblingId) => ({
      fromPersonId: link.fromPersonId,
      toPersonId: siblingId,
    })),
  ]);
}

async function tryCreateInferredParentChildRelationship(
  tx: TxClient,
  params: {
    treeId: string;
    fromPersonId: string;
    toPersonId: string;
  },
) {
  const { treeId, fromPersonId, toPersonId } = params;
  if (fromPersonId === toPersonId) return false;

  const existing = await tx.query.relationships.findFirst({
    where: (r, { and, eq }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "parent_child"),
        eq(r.fromPersonId, fromPersonId),
        eq(r.toPersonId, toPersonId),
      ),
    columns: { id: true },
  });
  if (existing) return false;

  const reverse = await tx.query.relationships.findFirst({
    where: (r, { and, eq }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "parent_child"),
        eq(r.fromPersonId, toPersonId),
        eq(r.toPersonId, fromPersonId),
      ),
    columns: { id: true },
  });
  if (reverse) return false;

  const existingParents = await tx.query.relationships.findMany({
    where: (r, { and, eq }) =>
      and(
        eq(r.treeId, treeId),
        eq(r.type, "parent_child"),
        eq(r.toPersonId, toPersonId),
      ),
    columns: { id: true },
  });
  if (existingParents.length >= 2) return false;

  const [created] = await tx
    .insert(schema.relationships)
    .values({
      treeId,
      fromPersonId,
      toPersonId,
      type: "parent_child",
      normalizedPersonAId: null,
      normalizedPersonBId: null,
      spouseStatus: null,
      startDateText: null,
      endDateText: null,
    })
    .returning();

  return Boolean(created);
}

async function applyRelationshipInferences(
  tx: TxClient,
  params: {
    treeId: string;
    fromPersonId: string;
    toPersonId: string;
    type: RelationshipType;
    spouseStatus: SpouseStatus | null;
  },
) {
  const propagationQueue: ParentChildLink[] = [];
  const attemptedLinkKeys = new Set<string>();

  if (params.type === "parent_child") {
    const explicitLink = {
      fromPersonId: params.fromPersonId,
      toPersonId: params.toPersonId,
    };
    propagationQueue.push(explicitLink);
    attemptedLinkKeys.add(parentChildLinkKey(explicitLink));
  }

  const initialCandidates = await buildInitialParentChildInferenceCandidates(tx, params);
  for (const candidate of initialCandidates) {
    const candidateKey = parentChildLinkKey(candidate);
    if (attemptedLinkKeys.has(candidateKey)) continue;
    attemptedLinkKeys.add(candidateKey);

    if (
      await tryCreateInferredParentChildRelationship(tx, {
        treeId: params.treeId,
        fromPersonId: candidate.fromPersonId,
        toPersonId: candidate.toPersonId,
      })
    ) {
      propagationQueue.push(candidate);
    }
  }

  while (propagationQueue.length > 0) {
    const link = propagationQueue.shift();
    if (!link) continue;

    const propagatedCandidates = await buildPropagatedParentChildInferenceCandidates(
      tx,
      params.treeId,
      link,
    );

    for (const candidate of propagatedCandidates) {
      const candidateKey = parentChildLinkKey(candidate);
      if (attemptedLinkKeys.has(candidateKey)) continue;
      attemptedLinkKeys.add(candidateKey);

      if (
        await tryCreateInferredParentChildRelationship(tx, {
          treeId: params.treeId,
          fromPersonId: candidate.fromPersonId,
          toPersonId: candidate.toPersonId,
        })
      ) {
        propagationQueue.push(candidate);
      }
    }
  }
}

async function assertRelationshipInvariants(
  tx: TxClient,
  params: {
    treeId: string;
    fromPersonId: string;
    toPersonId: string;
    type: RelationshipType;
    spouseStatus: SpouseStatus | null;
    excludeRelationshipId?: string;
  },
) {
  const {
    treeId,
    fromPersonId,
    toPersonId,
    type,
    spouseStatus,
    excludeRelationshipId,
  } = params;

  if (fromPersonId === toPersonId) {
    throw new RelationshipRuleError(
      "A person cannot have a relationship with themselves",
    );
  }

  await ensurePeopleInTree(tx, treeId, [fromPersonId, toPersonId]);

  await assertNoDuplicateRelationship(tx, {
    treeId,
    fromPersonId,
    toPersonId,
    type,
    excludeRelationshipId,
  });

  if (type === "parent_child") {
    await assertNoImmediateParentCycle(tx, {
      treeId,
      fromPersonId,
      toPersonId,
      excludeRelationshipId,
    });
    await assertParentLimit(tx, {
      treeId,
      childPersonId: toPersonId,
      excludeRelationshipId,
    });
  }

  if (type === "spouse" && spouseStatus === "active") {
    await assertActiveSpouseAvailability(tx, {
      treeId,
      personId: fromPersonId,
      partnerId: toPersonId,
      excludeRelationshipId,
    });
    await assertActiveSpouseAvailability(tx, {
      treeId,
      personId: toPersonId,
      partnerId: fromPersonId,
      excludeRelationshipId,
    });
  }
}

type CreateRelationshipInput = {
  treeId: string;
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  startDateText?: string | null;
  endDateText?: string | null;
  spouseStatus?: SpouseStatus | null;
};

type UpdateRelationshipInput = {
  treeId: string;
  relationshipId: string;
  type?: RelationshipType;
  startDateText?: string | null;
  endDateText?: string | null;
  spouseStatus?: SpouseStatus | null;
};

export async function createRelationship(input: CreateRelationshipInput) {
  return db.transaction(async (tx) => {
    const spouseStatus = resolveSpouseStatus(input.type, input.spouseStatus, null);
    const normalizedPair =
      input.type === "spouse" || input.type === "sibling"
        ? normalizePair(input.fromPersonId, input.toPersonId)
        : { normalizedPersonAId: null, normalizedPersonBId: null };

    await assertRelationshipInvariants(tx, {
      treeId: input.treeId,
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      type: input.type,
      spouseStatus,
    });

    const [rel] = await tx
      .insert(schema.relationships)
      .values({
        treeId: input.treeId,
        fromPersonId: input.fromPersonId,
        toPersonId: input.toPersonId,
        type: input.type,
        normalizedPersonAId: normalizedPair.normalizedPersonAId,
        normalizedPersonBId: normalizedPair.normalizedPersonBId,
        spouseStatus,
        startDateText: input.startDateText ?? null,
        endDateText: input.endDateText ?? null,
      })
      .returning();

    if (!rel) {
      throw new RelationshipRuleError("Failed to create relationship", 500);
    }

    await applyRelationshipInferences(tx, {
      treeId: input.treeId,
      fromPersonId: input.fromPersonId,
      toPersonId: input.toPersonId,
      type: input.type,
      spouseStatus,
    });

    return rel;
  });
}

export async function updateRelationship(input: UpdateRelationshipInput) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.relationships.findFirst({
      where: (r, { and, eq }) =>
        and(eq(r.id, input.relationshipId), eq(r.treeId, input.treeId)),
    });
    if (!existing) {
      throw new RelationshipRuleError("Relationship not found", 404);
    }

    const nextType = input.type ?? existing.type;
    const nextSpouseStatus = resolveSpouseStatus(
      nextType,
      input.spouseStatus,
      existing.spouseStatus,
    );

    const normalizedPair =
      nextType === "spouse" || nextType === "sibling"
        ? normalizePair(existing.fromPersonId, existing.toPersonId)
        : { normalizedPersonAId: null, normalizedPersonBId: null };

    await assertRelationshipInvariants(tx, {
      treeId: existing.treeId,
      fromPersonId: existing.fromPersonId,
      toPersonId: existing.toPersonId,
      type: nextType,
      spouseStatus: nextSpouseStatus,
      excludeRelationshipId: existing.id,
    });

    const [updated] = await tx
      .update(schema.relationships)
      .set({
        type: nextType,
        normalizedPersonAId: normalizedPair.normalizedPersonAId,
        normalizedPersonBId: normalizedPair.normalizedPersonBId,
        spouseStatus: nextSpouseStatus,
        ...(input.startDateText !== undefined
          ? { startDateText: input.startDateText }
          : {}),
        ...(input.endDateText !== undefined
          ? { endDateText: input.endDateText }
          : {}),
      })
      .where(
        and(
          eq(schema.relationships.id, input.relationshipId),
          eq(schema.relationships.treeId, input.treeId),
        ),
      )
      .returning();

    if (!updated) {
      throw new RelationshipRuleError("Relationship not found", 404);
    }

    return updated;
  });
}

export async function deleteRelationship(treeId: string, relationshipId: string) {
  const [deleted] = await db
    .delete(schema.relationships)
    .where(
      and(
        eq(schema.relationships.id, relationshipId),
        eq(schema.relationships.treeId, treeId),
      ),
    )
    .returning();

  if (!deleted) {
    throw new RelationshipRuleError("Relationship not found", 404);
  }
}
