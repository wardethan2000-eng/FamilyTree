import { and, eq } from "drizzle-orm";
import * as schema from "@familytree/database";
import { db } from "./db.js";

type MergeableField =
  | "displayName"
  | "alsoKnownAs"
  | "essenceLine"
  | "birthDateText"
  | "deathDateText"
  | "birthPlace"
  | "deathPlace"
  | "birthPlaceId"
  | "deathPlaceId"
  | "isLiving"
  | "portraitMediaId"
  | "linkedUserId"
  | "homeTreeId";
type FieldSource = "survivor" | "merged";
type FieldResolutions = Partial<Record<MergeableField, FieldSource>>;
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type RelationshipType = typeof schema.relationships.$inferSelect.type;
type SpouseStatus = typeof schema.relationships.$inferSelect.spouseStatus;

export type MergeRelationshipRecord = Pick<
  typeof schema.relationships.$inferSelect,
  | "id"
  | "treeId"
  | "type"
  | "fromPersonId"
  | "toPersonId"
  | "spouseStatus"
  | "startDateText"
  | "endDateText"
>;

type MergeCandidate = {
  id: string;
  displayName: string;
  alsoKnownAs: string[];
  birthDateText: string | null;
  deathDateText: string | null;
  essenceLine: string | null;
  linkedUserId: string | null;
  homeTreeId: string | null;
  portraitMediaId: string | null;
  portraitMedia?: {
    objectKey: string;
  } | null;
};

export class PersonMergeError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PersonMergeError";
    this.status = status;
  }
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function extractYear(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(\d{4})\b/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function scoreDuplicateCandidate(
  source: MergeCandidate,
  candidate: MergeCandidate,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const sourceName = normalizeName(source.displayName);
  const candidateName = normalizeName(candidate.displayName);
  const sourceAliases = new Set(
    source.alsoKnownAs.map((alias) => normalizeName(alias)).filter(Boolean),
  );
  const candidateAliases = new Set(
    candidate.alsoKnownAs.map((alias) => normalizeName(alias)).filter(Boolean),
  );

  if (source.linkedUserId && source.linkedUserId === candidate.linkedUserId) {
    score += 100;
    reasons.push("linked account match");
  }

  if (sourceName && sourceName === candidateName) {
    score += 60;
    reasons.push("same display name");
  }

  if (
    sourceAliases.has(candidateName) ||
    candidateAliases.has(sourceName) ||
    [...sourceAliases].some((alias) => candidateAliases.has(alias))
  ) {
    score += 25;
    reasons.push("alias overlap");
  }

  if (
    source.birthDateText &&
    candidate.birthDateText &&
    source.birthDateText === candidate.birthDateText
  ) {
    score += 25;
    reasons.push("same birth date");
  } else {
    const sourceBirthYear = extractYear(source.birthDateText);
    const candidateBirthYear = extractYear(candidate.birthDateText);
    if (sourceBirthYear && candidateBirthYear && sourceBirthYear === candidateBirthYear) {
      score += 10;
      reasons.push("same birth year");
    }
  }

  if (
    source.deathDateText &&
    candidate.deathDateText &&
    source.deathDateText === candidate.deathDateText
  ) {
    score += 10;
    reasons.push("same death date");
  }

  return { score, reasons };
}

function mergeAlsoKnownAs(
  survivorAliases: string[],
  mergedAliases: string[],
  survivorName: string,
  mergedName: string,
): string[] {
  const merged = new Map<string, string>();

  for (const alias of [
    ...survivorAliases,
    ...mergedAliases,
    mergedName,
    survivorName,
  ]) {
    const normalized = normalizeName(alias);
    if (!normalized) continue;
    if (normalized === normalizeName(survivorName)) continue;
    merged.set(normalized, alias.trim());
  }

  return [...merged.values()];
}

function pickPreferredValue<T>(
  field: MergeableField,
  survivorValue: T,
  mergedValue: T,
  fieldResolutions?: FieldResolutions,
): T {
  const preference = fieldResolutions?.[field];
  if (preference === "survivor") {
    return survivorValue;
  }
  if (preference === "merged") {
    return mergedValue;
  }
  return survivorValue;
}

function mergeVisibilityDefault(
  survivorValue: "all_members" | "family_circle" | "named_circle",
  mergedValue?: "all_members" | "family_circle" | "named_circle",
): "all_members" | "family_circle" | "named_circle" {
  const rank = {
    all_members: 0,
    family_circle: 1,
    named_circle: 2,
  } as const;

  if (!mergedValue) {
    return survivorValue;
  }

  return rank[mergedValue] > rank[survivorValue] ? mergedValue : survivorValue;
}

function mergeNotes(
  existingNotes: string | null,
  incomingNotes: string | null,
): string | null {
  if (!existingNotes) return incomingNotes;
  if (!incomingNotes) return existingNotes;
  if (existingNotes.includes(incomingNotes)) return existingNotes;
  if (incomingNotes.includes(existingNotes)) return incomingNotes;
  return `${existingNotes}\n${incomingNotes}`;
}

function normalizeRelationshipPair(personAId: string, personBId: string) {
  return personAId < personBId
    ? { normalizedPersonAId: personAId, normalizedPersonBId: personBId }
    : { normalizedPersonAId: personBId, normalizedPersonBId: personAId };
}

function relationshipProjectionKey(relationship: MergeRelationshipRecord) {
  if (relationship.type === "parent_child") {
    return `${relationship.treeId}|${relationship.type}|${relationship.fromPersonId}->${relationship.toPersonId}`;
  }

  const normalizedPair = normalizeRelationshipPair(
    relationship.fromPersonId,
    relationship.toPersonId,
  );
  return `${relationship.treeId}|${relationship.type}|${normalizedPair.normalizedPersonAId}<->${normalizedPair.normalizedPersonBId}`;
}

function projectRelationshipForMerge(
  relationship: MergeRelationshipRecord,
  survivorPersonId: string,
  mergedAwayPersonId: string,
): MergeRelationshipRecord | null {
  const fromPersonId =
    relationship.fromPersonId === mergedAwayPersonId
      ? survivorPersonId
      : relationship.fromPersonId;
  const toPersonId =
    relationship.toPersonId === mergedAwayPersonId
      ? survivorPersonId
      : relationship.toPersonId;

  if (fromPersonId === toPersonId) {
    return null;
  }

  return {
    ...relationship,
    fromPersonId,
    toPersonId,
  };
}

function mergeRelationshipField<T extends string | null>(params: {
  relationshipType: RelationshipType;
  treeId: string;
  fieldLabel: string;
  primaryValue: T;
  secondaryValue: T;
}) {
  const { relationshipType, treeId, fieldLabel, primaryValue, secondaryValue } = params;

  if (primaryValue === secondaryValue || secondaryValue == null) {
    return primaryValue;
  }

  if (primaryValue == null) {
    return secondaryValue;
  }

  throw new PersonMergeError(
    `Merging would combine conflicting ${fieldLabel} on duplicate ${relationshipType} relationships in tree ${treeId}. Resolve those relationships before merging these people.`,
    409,
  );
}

function mergeProjectedDuplicateRelationship(
  primary: MergeRelationshipRecord,
  secondary: MergeRelationshipRecord,
): MergeRelationshipRecord {
  return {
    ...primary,
    spouseStatus: mergeRelationshipField({
      relationshipType: primary.type,
      treeId: primary.treeId,
      fieldLabel: "spouse status",
      primaryValue: primary.spouseStatus,
      secondaryValue: secondary.spouseStatus,
    }),
    startDateText: mergeRelationshipField({
      relationshipType: primary.type,
      treeId: primary.treeId,
      fieldLabel: "relationship start date",
      primaryValue: primary.startDateText,
      secondaryValue: secondary.startDateText,
    }),
    endDateText: mergeRelationshipField({
      relationshipType: primary.type,
      treeId: primary.treeId,
      fieldLabel: "relationship end date",
      primaryValue: primary.endDateText,
      secondaryValue: secondary.endDateText,
    }),
  };
}

export function preflightMergedRelationshipState(params: {
  relationships: MergeRelationshipRecord[];
  survivorPersonId: string;
  mergedAwayPersonId: string;
}) {
  const { relationships, survivorPersonId, mergedAwayPersonId } = params;
  const projectedRelationships = new Map<string, MergeRelationshipRecord>();

  for (const relationship of relationships) {
    const projected = projectRelationshipForMerge(
      relationship,
      survivorPersonId,
      mergedAwayPersonId,
    );
    if (!projected) {
      continue;
    }

    const key = relationshipProjectionKey(projected);
    const existing = projectedRelationships.get(key);
    projectedRelationships.set(
      key,
      existing
        ? mergeProjectedDuplicateRelationship(existing, projected)
        : projected,
    );
  }

  const dedupedRelationships = [...projectedRelationships.values()];
  const parentRelationships = dedupedRelationships.filter(
    (relationship) => relationship.type === "parent_child",
  );
  const parentLinkKeys = new Set(
    parentRelationships.map(
      (relationship) =>
        `${relationship.treeId}|${relationship.fromPersonId}->${relationship.toPersonId}`,
    ),
  );

  for (const relationship of parentRelationships) {
    if (
      parentLinkKeys.has(
        `${relationship.treeId}|${relationship.toPersonId}->${relationship.fromPersonId}`,
      )
    ) {
      throw new PersonMergeError(
        `Merging would create a parent/child cycle in tree ${relationship.treeId}. Resolve the conflicting parent relationships before merging these people.`,
        409,
      );
    }
  }

  const parentCounts = new Map<string, Set<string>>();
  for (const relationship of parentRelationships) {
    const key = `${relationship.treeId}|${relationship.toPersonId}`;
    const parents = parentCounts.get(key) ?? new Set<string>();
    parents.add(relationship.fromPersonId);
    if (parents.size > 2) {
      throw new PersonMergeError(
        `Merging would give person ${relationship.toPersonId} more than two parents in tree ${relationship.treeId}. Resolve those parent relationships before merging.`,
        409,
      );
    }
    parentCounts.set(key, parents);
  }

  const activeSpousePartners = new Map<string, Set<string>>();
  const rememberActiveSpouse = (personId: string, partnerId: string, treeId: string) => {
    const key = `${treeId}|${personId}`;
    const partners = activeSpousePartners.get(key) ?? new Set<string>();
    partners.add(partnerId);
    if (partners.size > 1) {
      throw new PersonMergeError(
        `Merging would create multiple active spouse relationships for person ${personId} in tree ${treeId}. Resolve those spouse relationships before merging.`,
        409,
      );
    }
    activeSpousePartners.set(key, partners);
  };

  for (const relationship of dedupedRelationships) {
    if (relationship.type !== "spouse" || relationship.spouseStatus !== "active") {
      continue;
    }

    rememberActiveSpouse(
      relationship.fromPersonId,
      relationship.toPersonId,
      relationship.treeId,
    );
    rememberActiveSpouse(
      relationship.toPersonId,
      relationship.fromPersonId,
      relationship.treeId,
    );
  }

  return dedupedRelationships;
}

async function listPersonTreeIds(
  tx: TxClient,
  personId: string,
  legacyTreeId: string,
): Promise<string[]> {
  const scopeRows = await tx.query.treePersonScope.findMany({
    where: (scope, { eq }) => eq(scope.personId, personId),
    columns: {
      treeId: true,
    },
  });

  return [...new Set([legacyTreeId, ...scopeRows.map((row) => row.treeId)])];
}

async function assertMergePermissions(
  tx: TxClient,
  userId: string,
  treeIds: string[],
) {
  const memberships = await tx.query.treeMemberships.findMany({
    where: (membership, { and, eq, inArray, or }) =>
      and(
        eq(membership.userId, userId),
        inArray(membership.treeId, treeIds),
        or(eq(membership.role, "founder"), eq(membership.role, "steward")),
      ),
    columns: {
      treeId: true,
    },
  });

  const allowedTreeIds = new Set(memberships.map((membership) => membership.treeId));
  const missingTreeIds = treeIds.filter((treeId) => !allowedTreeIds.has(treeId));
  if (missingTreeIds.length > 0) {
    throw new PersonMergeError(
      "You must be a founder or steward in every tree that contains these people",
      403,
    );
  }
}

async function mergeScopeRows(
  tx: TxClient,
  survivorPersonId: string,
  mergedAwayPersonId: string,
  performedByUserId: string,
  survivorLegacyTreeId: string,
  mergedAwayLegacyTreeId: string,
) {
  const [survivorScopes, mergedAwayScopes] = await Promise.all([
    tx.query.treePersonScope.findMany({
      where: (scope, { eq }) => eq(scope.personId, survivorPersonId),
    }),
    tx.query.treePersonScope.findMany({
      where: (scope, { eq }) => eq(scope.personId, mergedAwayPersonId),
    }),
  ]);

  const survivorByTreeId = new Map(
    survivorScopes.map((scope) => [scope.treeId, scope]),
  );
  const mergedByTreeId = new Map(
    mergedAwayScopes.map((scope) => [scope.treeId, scope]),
  );

  const treeIds = [
    ...new Set([
      survivorLegacyTreeId,
      mergedAwayLegacyTreeId,
      ...survivorByTreeId.keys(),
      ...mergedByTreeId.keys(),
    ]),
  ];

  for (const treeId of treeIds) {
    const survivorScope = survivorByTreeId.get(treeId);
    const mergedScope = mergedByTreeId.get(treeId);

    if (!survivorScope) {
      await tx
        .insert(schema.treePersonScope)
        .values({
          treeId,
          personId: survivorPersonId,
          displayNameOverride: mergedScope?.displayNameOverride ?? null,
          visibilityDefault: mergeVisibilityDefault(
            "all_members",
            mergedScope?.visibilityDefault,
          ),
          addedByUserId: mergedScope?.addedByUserId ?? performedByUserId,
          addedAt: mergedScope?.addedAt ?? new Date(),
        })
        .onConflictDoNothing();
      continue;
    }

    const updates: Partial<typeof schema.treePersonScope.$inferInsert> = {};

    if (!survivorScope.displayNameOverride && mergedScope?.displayNameOverride) {
      updates.displayNameOverride = mergedScope.displayNameOverride;
    }

    const mergedVisibilityDefault = mergeVisibilityDefault(
      survivorScope.visibilityDefault,
      mergedScope?.visibilityDefault,
    );
    if (mergedVisibilityDefault !== survivorScope.visibilityDefault) {
      updates.visibilityDefault = mergedVisibilityDefault;
    }

    if (Object.keys(updates).length > 0) {
      await tx
        .update(schema.treePersonScope)
        .set(updates)
        .where(
          and(
            eq(schema.treePersonScope.treeId, treeId),
            eq(schema.treePersonScope.personId, survivorPersonId),
          ),
        );
    }
  }

  await tx
    .delete(schema.treePersonScope)
    .where(eq(schema.treePersonScope.personId, mergedAwayPersonId));
}

async function mergeMemoryTags(
  tx: TxClient,
  survivorPersonId: string,
  mergedAwayPersonId: string,
) {
  const rows = await tx.query.memoryPersonTags.findMany({
    where: (tag, { eq }) => eq(tag.personId, mergedAwayPersonId),
  });

  for (const row of rows) {
    await tx
      .insert(schema.memoryPersonTags)
      .values({
        memoryId: row.memoryId,
        personId: survivorPersonId,
      })
      .onConflictDoNothing();
  }

  await tx
    .delete(schema.memoryPersonTags)
    .where(eq(schema.memoryPersonTags.personId, mergedAwayPersonId));
}

async function mergeRelationshipVisibility(
  tx: TxClient,
  targetRelationshipId: string,
  sourceRelationshipId: string,
) {
  const sourceRows = await tx.query.treeRelationshipVisibility.findMany({
    where: (visibility, { eq }) => eq(visibility.relationshipId, sourceRelationshipId),
  });

  for (const row of sourceRows) {
    const existing = await tx.query.treeRelationshipVisibility.findFirst({
      where: (visibility, { and, eq }) =>
        and(
          eq(visibility.treeId, row.treeId),
          eq(visibility.relationshipId, targetRelationshipId),
        ),
    });

    if (!existing) {
      await tx
        .insert(schema.treeRelationshipVisibility)
        .values({
          treeId: row.treeId,
          relationshipId: targetRelationshipId,
          isVisible: row.isVisible,
          notes: row.notes ?? null,
        })
        .onConflictDoNothing();
      continue;
    }

    const mergedVisibility = existing.isVisible && row.isVisible;
    const mergedNotes = mergeNotes(existing.notes ?? null, row.notes ?? null);

    if (
      mergedVisibility !== existing.isVisible ||
      mergedNotes !== (existing.notes ?? null)
    ) {
      await tx
        .update(schema.treeRelationshipVisibility)
        .set({
          isVisible: mergedVisibility,
          notes: mergedNotes,
        })
        .where(
          and(
            eq(schema.treeRelationshipVisibility.treeId, existing.treeId),
            eq(
              schema.treeRelationshipVisibility.relationshipId,
              targetRelationshipId,
            ),
          ),
        );
    }
  }
}

async function mergeRelationships(
  tx: TxClient,
  survivorPersonId: string,
  mergedAwayPersonId: string,
) {
  const relationships = await tx.query.relationships.findMany({
    where: (relationship, { or, eq }) =>
      or(
        eq(relationship.fromPersonId, mergedAwayPersonId),
        eq(relationship.toPersonId, mergedAwayPersonId),
      ),
  });

  for (const relationship of relationships) {
    const projectedRelationship = projectRelationshipForMerge(
      relationship,
      survivorPersonId,
      mergedAwayPersonId,
    );

    if (!projectedRelationship) {
      await tx
        .delete(schema.relationships)
        .where(eq(schema.relationships.id, relationship.id));
      continue;
    }

    const { fromPersonId, toPersonId } = projectedRelationship;

    const normalizedPair = normalizeRelationshipPair(fromPersonId, toPersonId);
    const duplicate = await tx.query.relationships.findFirst({
      where: (candidate, { and, eq, ne, or }) =>
        and(
          eq(candidate.treeId, relationship.treeId),
          eq(candidate.type, relationship.type),
          ne(candidate.id, relationship.id),
          or(
            and(
              eq(candidate.fromPersonId, fromPersonId),
              eq(candidate.toPersonId, toPersonId),
            ),
            and(
              eq(candidate.normalizedPersonAId, normalizedPair.normalizedPersonAId),
              eq(candidate.normalizedPersonBId, normalizedPair.normalizedPersonBId),
            ),
          ),
        ),
    });

    if (duplicate) {
      const mergedDuplicate = mergeProjectedDuplicateRelationship(
        {
          id: duplicate.id,
          treeId: duplicate.treeId,
          type: duplicate.type,
          fromPersonId: duplicate.fromPersonId,
          toPersonId: duplicate.toPersonId,
          spouseStatus: duplicate.spouseStatus,
          startDateText: duplicate.startDateText,
          endDateText: duplicate.endDateText,
        },
        projectedRelationship,
      );

      const duplicateUpdates: Partial<typeof schema.relationships.$inferInsert> = {};
      if (mergedDuplicate.spouseStatus !== duplicate.spouseStatus) {
        duplicateUpdates.spouseStatus = mergedDuplicate.spouseStatus;
      }
      if (mergedDuplicate.startDateText !== duplicate.startDateText) {
        duplicateUpdates.startDateText = mergedDuplicate.startDateText;
      }
      if (mergedDuplicate.endDateText !== duplicate.endDateText) {
        duplicateUpdates.endDateText = mergedDuplicate.endDateText;
      }

      if (Object.keys(duplicateUpdates).length > 0) {
        await tx
          .update(schema.relationships)
          .set(duplicateUpdates)
          .where(eq(schema.relationships.id, duplicate.id));
      }

      await mergeRelationshipVisibility(tx, duplicate.id, relationship.id);
      await tx
        .delete(schema.relationships)
        .where(eq(schema.relationships.id, relationship.id));
      continue;
    }

    await tx
      .update(schema.relationships)
      .set({
        fromPersonId,
        toPersonId,
        normalizedPersonAId: normalizedPair.normalizedPersonAId,
        normalizedPersonBId: normalizedPair.normalizedPersonBId,
      })
      .where(eq(schema.relationships.id, relationship.id));
  }
}

export async function listLikelyDuplicatePeople(personId: string) {
  const source = await db.query.people.findFirst({
    where: (person, { eq }) => eq(person.id, personId),
    columns: {
      id: true,
      displayName: true,
      alsoKnownAs: true,
      birthDateText: true,
      deathDateText: true,
      essenceLine: true,
      linkedUserId: true,
      homeTreeId: true,
      portraitMediaId: true,
    },
    with: {
      portraitMedia: {
        columns: {
          objectKey: true,
        },
      },
    },
  });

  if (!source) {
    return null;
  }

  const candidates = await db.query.people.findMany({
    where: (person, { ne }) => ne(person.id, personId),
    columns: {
      id: true,
      displayName: true,
      alsoKnownAs: true,
      birthDateText: true,
      deathDateText: true,
      essenceLine: true,
      linkedUserId: true,
      homeTreeId: true,
      portraitMediaId: true,
    },
    with: {
      portraitMedia: {
        columns: {
          objectKey: true,
        },
      },
    },
  });

  return candidates
    .map((candidate) => {
      const { score, reasons } = scoreDuplicateCandidate(source, candidate);
      return {
        ...candidate,
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score >= 50)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

export async function mergePeopleRecords(input: {
  treeId: string;
  survivorPersonId: string;
  mergedAwayPersonId: string;
  performedByUserId: string;
  fieldResolutions?: FieldResolutions;
}) {
  const {
    treeId,
    survivorPersonId,
    mergedAwayPersonId,
    performedByUserId,
    fieldResolutions,
  } = input;

  if (survivorPersonId === mergedAwayPersonId) {
    throw new PersonMergeError("Select two different people to merge");
  }

  return db.transaction(async (tx) => {
    const [survivor, mergedAway] = await Promise.all([
      tx.query.people.findFirst({
        where: (person, { eq }) => eq(person.id, survivorPersonId),
      }),
      tx.query.people.findFirst({
        where: (person, { eq }) => eq(person.id, mergedAwayPersonId),
      }),
    ]);

    if (!survivor || !mergedAway) {
      throw new PersonMergeError("One or both people could not be found", 404);
    }

    const currentTreeMembership = await tx.query.treeMemberships.findFirst({
      where: (membership, { and, eq, or }) =>
        and(
          eq(membership.treeId, treeId),
          eq(membership.userId, performedByUserId),
          or(eq(membership.role, "founder"), eq(membership.role, "steward")),
        ),
      columns: {
        treeId: true,
      },
    });

    if (!currentTreeMembership) {
      throw new PersonMergeError(
        "Only founders and stewards can merge people in this tree",
        403,
      );
    }

    const [survivorTreeIds, mergedAwayTreeIds] = await Promise.all([
      listPersonTreeIds(tx, survivor.id, survivor.treeId),
      listPersonTreeIds(tx, mergedAway.id, mergedAway.treeId),
    ]);

    await assertMergePermissions(tx, performedByUserId, [
      ...new Set([...survivorTreeIds, ...mergedAwayTreeIds]),
    ]);

    if (
      survivor.linkedUserId &&
      mergedAway.linkedUserId &&
      survivor.linkedUserId !== mergedAway.linkedUserId
    ) {
      throw new PersonMergeError(
        "Cannot merge two different claimed accounts into a single person",
        409,
      );
    }

    const touchedRelationships = await tx.query.relationships.findMany({
      where: (relationship, { eq, or }) =>
        or(
          eq(relationship.fromPersonId, survivor.id),
          eq(relationship.toPersonId, survivor.id),
          eq(relationship.fromPersonId, mergedAway.id),
          eq(relationship.toPersonId, mergedAway.id),
        ),
      columns: {
        treeId: true,
      },
    });

    const affectedRelationshipTreeIds = [
      ...new Set(touchedRelationships.map((relationship) => relationship.treeId)),
    ];

    if (affectedRelationshipTreeIds.length > 0) {
      const relationshipsInAffectedTrees = await tx.query.relationships.findMany({
        where: (relationship, { inArray }) =>
          inArray(relationship.treeId, affectedRelationshipTreeIds),
        columns: {
          id: true,
          treeId: true,
          type: true,
          fromPersonId: true,
          toPersonId: true,
          spouseStatus: true,
          startDateText: true,
          endDateText: true,
        },
      });

      preflightMergedRelationshipState({
        relationships: relationshipsInAffectedTrees,
        survivorPersonId: survivor.id,
        mergedAwayPersonId: mergedAway.id,
      });
    }

    const updates = {
      displayName: pickPreferredValue(
        "displayName",
        survivor.displayName,
        mergedAway.displayName,
        fieldResolutions,
      ),
      alsoKnownAs:
        fieldResolutions?.alsoKnownAs === "merged"
          ? mergeAlsoKnownAs(
              mergedAway.alsoKnownAs,
              survivor.alsoKnownAs,
              mergedAway.displayName,
              survivor.displayName,
            )
          : mergeAlsoKnownAs(
              survivor.alsoKnownAs,
              mergedAway.alsoKnownAs,
              survivor.displayName,
              mergedAway.displayName,
            ),
      essenceLine:
        pickPreferredValue(
          "essenceLine",
          survivor.essenceLine,
          mergedAway.essenceLine,
          fieldResolutions,
        ) ??
        survivor.essenceLine ??
        mergedAway.essenceLine,
      birthDateText:
        pickPreferredValue(
          "birthDateText",
          survivor.birthDateText,
          mergedAway.birthDateText,
          fieldResolutions,
        ) ??
        survivor.birthDateText ??
        mergedAway.birthDateText,
      deathDateText:
        pickPreferredValue(
          "deathDateText",
          survivor.deathDateText,
          mergedAway.deathDateText,
          fieldResolutions,
        ) ??
        survivor.deathDateText ??
        mergedAway.deathDateText,
      birthPlace:
        pickPreferredValue(
          "birthPlace",
          survivor.birthPlace,
          mergedAway.birthPlace,
          fieldResolutions,
        ) ??
        survivor.birthPlace ??
        mergedAway.birthPlace,
      deathPlace:
        pickPreferredValue(
          "deathPlace",
          survivor.deathPlace,
          mergedAway.deathPlace,
          fieldResolutions,
        ) ??
        survivor.deathPlace ??
        mergedAway.deathPlace,
      birthPlaceId:
        pickPreferredValue(
          "birthPlaceId",
          survivor.birthPlaceId,
          mergedAway.birthPlaceId,
          fieldResolutions,
        ) ??
        survivor.birthPlaceId ??
        mergedAway.birthPlaceId,
      deathPlaceId:
        pickPreferredValue(
          "deathPlaceId",
          survivor.deathPlaceId,
          mergedAway.deathPlaceId,
          fieldResolutions,
        ) ??
        survivor.deathPlaceId ??
        mergedAway.deathPlaceId,
      isLiving: pickPreferredValue(
        "isLiving",
        survivor.isLiving,
        mergedAway.isLiving,
        fieldResolutions,
      ),
      portraitMediaId:
        pickPreferredValue(
          "portraitMediaId",
          survivor.portraitMediaId,
          mergedAway.portraitMediaId,
          fieldResolutions,
        ) ??
        survivor.portraitMediaId ??
        mergedAway.portraitMediaId,
      linkedUserId:
        pickPreferredValue(
          "linkedUserId",
          survivor.linkedUserId,
          mergedAway.linkedUserId,
          fieldResolutions,
        ) ??
        survivor.linkedUserId ??
        mergedAway.linkedUserId,
      homeTreeId:
        pickPreferredValue(
          "homeTreeId",
          survivor.homeTreeId,
          mergedAway.homeTreeId,
          fieldResolutions,
        ) ??
        survivor.homeTreeId ??
        mergedAway.homeTreeId,
      updatedAt: new Date(),
    };

    await tx
      .update(schema.people)
      .set(updates)
      .where(eq(schema.people.id, survivor.id));

    await mergeScopeRows(
      tx,
      survivor.id,
      mergedAway.id,
      performedByUserId,
      survivor.treeId,
      mergedAway.treeId,
    );

    await mergeMemoryTags(tx, survivor.id, mergedAway.id);

    await Promise.all([
      tx
        .update(schema.memories)
        .set({ primaryPersonId: survivor.id })
        .where(eq(schema.memories.primaryPersonId, mergedAway.id)),
      tx
        .update(schema.prompts)
        .set({ toPersonId: survivor.id })
        .where(eq(schema.prompts.toPersonId, mergedAway.id)),
      tx
        .update(schema.invitations)
        .set({ linkedPersonId: survivor.id })
        .where(eq(schema.invitations.linkedPersonId, mergedAway.id)),
    ]);

    await mergeRelationships(tx, survivor.id, mergedAway.id);

    await tx.insert(schema.personMergeAudit).values({
      survivorPersonId: survivor.id,
      mergedAwayPersonId: mergedAway.id,
      fieldResolutions: fieldResolutions ?? null,
      performedByUserId,
    });

    await tx.delete(schema.people).where(eq(schema.people.id, mergedAway.id));

    const mergedPerson = await tx.query.people.findFirst({
      where: (person, { eq }) => eq(person.id, survivor.id),
      with: {
        portraitMedia: true,
        birthPlaceRef: true,
        deathPlaceRef: true,
      },
    });

    if (!mergedPerson) {
      throw new PersonMergeError("Merged person could not be loaded", 500);
    }

    return mergedPerson;
  });
}
