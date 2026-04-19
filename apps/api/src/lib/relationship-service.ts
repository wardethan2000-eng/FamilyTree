import { and, eq } from "drizzle-orm";
import * as schema from "@familytree/database";
import { db } from "./db.js";

type RelationshipType = "parent_child" | "sibling" | "spouse";
type SpouseStatus = "active" | "former" | "deceased_partner";

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
