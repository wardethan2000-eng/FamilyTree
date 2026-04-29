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
  places: ExportPlace[];
  sections: ExportSection[];
  media: ExportMedia[];
  permissions: {
    exportedByUserId: string;
    exportedByRole: string;
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
  kind: string;
  body: string | null;
  dateOfEventText: string | null;
  placeId: string | null;
  placeLabel: string | null;
  transcriptText: string | null;
  mediaIds: string[];
  primaryMediaId: string | null;
  taggedPersonIds: string[];
  perspectiveIds: ExportPerspective[];
  relatedMemoryIds: string[];
  contributorName: string | null;
  sectionIds: string[];
  captionOverride: string | null;
};

export type ExportPerspective = {
  id: string;
  body: string | null;
  contributorName: string | null;
  mediaId: string | null;
  mimeType: string | null;
};

export type ExportRelationship = {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: string;
  spouseStatus: string | null;
  startDateText: string | null;
  endDateText: string | null;
};

export type ExportPlace = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  adminRegion: string | null;
  locality: string | null;
};

export type ExportSection = {
  id: string;
  title: string;
  body: string | null;
  sectionKind: string;
  sortOrder: number;
  settingsJson: Record<string, unknown> | null;
};

export type ExportMedia = {
  id: string;
  objectKey: string;
  localPath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  role: "portrait" | "memory" | "perspective" | "attachment";
};

export type MediaQuality = "original" | "web" | "small";

export type ExportOutputKind = "full_zip" | "mini_zip";