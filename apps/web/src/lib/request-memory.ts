import type { ApiRelationship } from "@/components/tree/treeTypes";
import { getImmediateFamily } from "@/components/tree/treeLayout";

export type RequestTargetMode = "person" | "people" | "family";

export interface RequestPersonOption {
  id: string;
  displayName: string;
  portraitUrl?: string | null;
  essenceLine?: string | null;
  linkedUserId?: string | null;
}

export interface ResolveRequestRecipientsInput {
  mode: RequestTargetMode;
  people: RequestPersonOption[];
  relationships?: ApiRelationship[];
  selectedPersonId?: string | null;
  selectedPersonIds?: string[];
  familyAnchorPersonId?: string | null;
}

export interface ResolveRequestRecipientsResult {
  recipientIds: string[];
  recipients: RequestPersonOption[];
  excludedUnlinked: RequestPersonOption[];
}

export function resolveRequestRecipients({
  mode,
  people,
  relationships = [],
  selectedPersonId,
  selectedPersonIds = [],
  familyAnchorPersonId,
}: ResolveRequestRecipientsInput): ResolveRequestRecipientsResult {
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const rawIds =
    mode === "person"
      ? selectedPersonId
        ? [selectedPersonId]
        : []
      : mode === "people"
      ? selectedPersonIds
      : familyAnchorPersonId
      ? Array.from(getImmediateFamily(familyAnchorPersonId, relationships))
      : [];

  const uniquePeople = [...new Set(rawIds)]
    .map((personId) => peopleById.get(personId))
    .filter((person): person is RequestPersonOption => Boolean(person));

  const recipients = uniquePeople.filter((person) => person.linkedUserId);
  const excludedUnlinked = uniquePeople.filter((person) => !person.linkedUserId);

  return {
    recipientIds: recipients.map((person) => person.id),
    recipients,
    excludedUnlinked,
  };
}
