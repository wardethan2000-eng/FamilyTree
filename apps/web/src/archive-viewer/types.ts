export type ArchiveExportManifest = {
  version: 1;
  exportedAt: string;
  generatedBy: {
    userId: string;
    displayName: string | null;
  };
  tree: {
    id: string;
    name: string;
  };
  collection: {
    id: string | null;
    name: string;
    description: string | null;
    introText: string | null;
    dedicationText: string | null;
    defaultViewMode: "chapter" | "drift" | "gallery" | "storybook" | "kiosk";
    scopeKind: string;
  };
  people: ExportPerson[];
  memories: ExportMemory[];
  relationships: ExportRelationship[];
  perspectives: ExportPerspective[];
  places: ExportPlace[];
  sections: ExportSection[];
  media: ExportMedia[];
  personCuration: ExportPersonCuration[];
  permissions: {
    viewerUserId: string;
    generatedFromRole: string;
    visibilityResolvedAt: string;
  };
};

export type ExportPerson = {
  id: string;
  displayName: string;
  canonicalDisplayName?: string;
  alsoKnownAs: string[];
  birthDateText: string | null;
  deathDateText: string | null;
  essenceLine: string | null;
  portraitMediaId: string | null;
  relationshipIds: string[];
  memoryIds: string[];
};

export type ExportMemory = {
  id: string;
  primaryPersonId: string;
  title: string;
  kind: "story" | "photo" | "voice" | "document" | "other";
  body: string | null;
  dateOfEventText: string | null;
  placeId: string | null;
  placeLabel: string | null;
  transcriptText: string | null;
  mediaIds: string[];
  taggedPersonIds: string[];
  perspectiveIds: string[];
  relatedMemoryIds: string[];
  contributorName: string | null;
  sectionIds: string[];
  captionOverride: string | null;
};

export type ExportRelationship = {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: string;
  startDateText: string | null;
  endDateText: string | null;
};

export type ExportPlace = {
  id: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
};

export type ExportSection = {
  id: string;
  title: string;
  body: string | null;
  sectionKind: "intro" | "chapter" | "gallery" | "timeline" | "drift" | "people" | "custom";
  sortOrder: number;
  itemIds: string[];
};

export type ExportMedia = {
  id: string;
  localPath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  role: "portrait" | "memory" | "perspective" | "attachment";
};

export type ExportPerspective = {
  id: string;
  memoryId: string;
  body: string | null;
  mediaId: string | null;
  contributorName: string | null;
};

export type ExportPersonCuration = {
  personId: string;
  memoryId: string;
  isFeatured: boolean;
  sortOrder: number;
};