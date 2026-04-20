import { and, eq } from "drizzle-orm";
import * as schema from "@familytree/database";
import { db } from "./db.js";

export type RemovePersonFromTreeResult =
  | {
      action: "deleted";
      personId: string;
      remainingScopeCount: 0;
    }
  | {
      action: "removed_from_scope";
      personId: string;
      remainingScopeCount: number;
    };

export async function removePersonFromTree(
  treeId: string,
  personId: string,
): Promise<RemovePersonFromTreeResult | null> {
  return db.transaction(async (tx) => {
    const scopedPerson = await tx.query.treePersonScope.findFirst({
      where: (scope, { and, eq }) =>
        and(eq(scope.treeId, treeId), eq(scope.personId, personId)),
      with: {
        person: {
          columns: {
            id: true,
            homeTreeId: true,
          },
        },
      },
    });

    if (!scopedPerson?.person) {
      return null;
    }

    const remainingScopes = await tx.query.treePersonScope.findMany({
      where: (scope, { and, eq, ne }) =>
        and(eq(scope.personId, personId), ne(scope.treeId, treeId)),
      columns: {
        treeId: true,
      },
    });

    if (remainingScopes.length === 0) {
      const [deleted] = await tx
        .delete(schema.people)
        .where(eq(schema.people.id, personId))
        .returning({ id: schema.people.id });

      if (!deleted) {
        return null;
      }

      return {
        action: "deleted",
        personId: deleted.id,
        remainingScopeCount: 0,
      };
    }

    await tx
      .delete(schema.treePersonScope)
      .where(
        and(
          eq(schema.treePersonScope.treeId, treeId),
          eq(schema.treePersonScope.personId, personId),
        ),
      );

    if (scopedPerson.person.homeTreeId === treeId) {
      await tx
        .update(schema.people)
        .set({
          homeTreeId: remainingScopes[0]?.treeId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.people.id, personId));
    }

    return {
      action: "removed_from_scope",
      personId,
      remainingScopeCount: remainingScopes.length,
    };
  });
}
