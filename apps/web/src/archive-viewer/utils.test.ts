import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getMediaUrl,
  getMediaType,
  getPerson,
  getMemory,
  getPlace,
  getMemoriesForPerson,
  getRelatedMemories,
  getMemoriesForPlace,
  searchManifest,
  dateSpan,
  relationshipLabel,
  isFeaturedMemory,
} from "./utils.js";
import type { ArchiveExportManifest } from "../types.js";

const sampleManifest: ArchiveExportManifest = {
  version: 1,
  exportedAt: "2026-04-29T00:00:00Z",
  generatedBy: { userId: "u1", displayName: "Test User" },
  tree: { id: "t1", name: "Test Tree" },
  collection: {
    id: null,
    name: "Test Tree",
    description: null,
    introText: null,
    dedicationText: null,
    defaultViewMode: "chapter",
    scopeKind: "full_tree",
  },
  people: [
    {
      id: "p1",
      displayName: "Eleanor Martin",
      canonicalDisplayName: "Eleanor Martin",
      alsoKnownAs: ["Ellie"],
      birthDateText: "1940",
      deathDateText: "2020",
      essenceLine: "Beloved grandmother",
      portraitMediaId: "m-portrait",
      relationshipIds: ["r1"],
      memoryIds: ["mem1", "mem2"],
    },
    {
      id: "p2",
      displayName: "James Martin",
      canonicalDisplayName: "James Martin",
      alsoKnownAs: [],
      birthDateText: "1938",
      deathDateText: null,
      essenceLine: null,
      portraitMediaId: null,
      relationshipIds: ["r1"],
      memoryIds: ["mem2"],
    },
  ],
  memories: [
    {
      id: "mem1",
      primaryPersonId: "p1",
      title: "Summer at the lake",
      kind: "photo",
      body: "A beautiful day at Lake Tahoe",
      dateOfEventText: "1985",
      placeId: "pl1",
      placeLabel: "Lake Tahoe",
      transcriptText: null,
      mediaIds: ["m1"],
      taggedPersonIds: ["p2"],
      perspectiveIds: [],
      relatedMemoryIds: ["mem2"],
      contributorName: null,
      sectionIds: [],
      captionOverride: null,
    },
    {
      id: "mem2",
      primaryPersonId: "p1",
      title: "Eleanor's voice recording",
      kind: "voice",
      body: null,
      dateOfEventText: "2010",
      placeId: null,
      placeLabel: null,
      transcriptText: "We used to go to the lake every summer.",
      mediaIds: ["m2"],
      taggedPersonIds: [],
      perspectiveIds: ["persp1"],
      relatedMemoryIds: [],
      contributorName: "James Martin",
      sectionIds: [],
      captionOverride: null,
    },
  ],
  relationships: [
    {
      id: "r1",
      fromPersonId: "p1",
      toPersonId: "p2",
      type: "spouse",
      startDateText: "1962",
      endDateText: null,
    },
  ],
  perspectives: [
    {
      id: "persp1",
      memoryId: "mem2",
      body: "She always lit up when talking about the lake.",
      mediaId: null,
      contributorName: "James Martin",
    },
  ],
  places: [
    {
      id: "pl1",
      label: "Lake Tahoe",
      latitude: 39.0,
      longitude: -120.0,
      locality: "South Lake Tahoe",
      adminRegion: "California",
      countryCode: "US",
    },
  ],
  sections: [],
  media: [
    { id: "m1", localPath: "media/m1.jpg", mimeType: "image/jpeg", sizeBytes: 1024, checksum: null, role: "memory" },
    { id: "m2", localPath: "media/m2.mp3", mimeType: "audio/mpeg", sizeBytes: 512, checksum: null, role: "memory" },
    { id: "m-portrait", localPath: "media/m-portrait.jpg", mimeType: "image/jpeg", sizeBytes: 256, checksum: null, role: "portrait" },
  ],
  personCuration: [
    { personId: "p1", memoryId: "mem1", isFeatured: true, sortOrder: 0 },
    { personId: "p1", memoryId: "mem2", isFeatured: false, sortOrder: 1 },
  ],
  permissions: {
    exportedByUserId: "u1",
    exportedByRole: "steward",
    visibilityResolvedAt: "2026-04-29T00:00:00Z",
  },
};

describe("getMediaUrl", () => {
  it("returns localPath for known media id", () => {
    assert.equal(getMediaUrl(sampleManifest, "m1"), "media/m1.jpg");
  });

  it("returns null for unknown media id", () => {
    assert.equal(getMediaUrl(sampleManifest, "nonexistent"), null);
  });

  it("returns null for null input", () => {
    assert.equal(getMediaUrl(sampleManifest, null), null);
  });
});

describe("getMediaType", () => {
  it("detects image media", () => {
    assert.equal(getMediaType(sampleManifest, "m1"), "image");
  });

  it("detects audio media", () => {
    assert.equal(getMediaType(sampleManifest, "m2"), "audio");
  });

  it("returns unknown for nonexistent media", () => {
    assert.equal(getMediaType(sampleManifest, "nonexistent"), "unknown");
  });

  it("returns unknown for null input", () => {
    assert.equal(getMediaType(sampleManifest, null), "unknown");
  });
});

describe("getPerson", () => {
  it("finds person by id", () => {
    const p = getPerson(sampleManifest, "p1");
    assert.equal(p?.displayName, "Eleanor Martin");
  });

  it("returns undefined for unknown id", () => {
    assert.equal(getPerson(sampleManifest, "nonexistent"), undefined);
  });
});

describe("getMemory", () => {
  it("finds memory by id", () => {
    const m = getMemory(sampleManifest, "mem1");
    assert.equal(m?.title, "Summer at the lake");
  });

  it("returns undefined for unknown id", () => {
    assert.equal(getMemory(sampleManifest, "nonexistent"), undefined);
  });
});

describe("getPlace", () => {
  it("finds place by id", () => {
    const p = getPlace(sampleManifest, "pl1");
    assert.equal(p?.label, "Lake Tahoe");
  });

  it("returns undefined for unknown id", () => {
    assert.equal(getPlace(sampleManifest, "nonexistent"), undefined);
  });
});

describe("dateSpan", () => {
  it("formats both dates", () => {
    assert.equal(dateSpan("1940", "2020"), "1940 \u2013 2020");
  });

  it("formats birth only", () => {
    assert.equal(dateSpan("1940", null), "1940 \u2013");
  });

  it("formats death only", () => {
    assert.equal(dateSpan(null, "2020"), "\u2013 2020");
  });

  it("returns empty for no dates", () => {
    assert.equal(dateSpan(null, null), "");
  });
});

describe("relationshipLabel", () => {
  it("labels parent correctly from child perspective", () => {
    assert.equal(relationshipLabel("parent_child", "p1", "p2", "p2"), "Parent");
  });

  it("labels child correctly from parent perspective", () => {
    assert.equal(relationshipLabel("parent_child", "p1", "p2", "p1"), "Child");
  });

  it("labels spouse", () => {
    assert.equal(relationshipLabel("spouse", "p1", "p2", "p1"), "Spouse");
  });

  it("labels sibling", () => {
    assert.equal(relationshipLabel("sibling", "p1", "p2", "p1"), "Sibling");
  });

  it("passes through unknown types", () => {
    assert.equal(relationshipLabel("cousin", "p1", "p2", "p1"), "cousin");
  });
});

describe("isFeaturedMemory", () => {
  it("returns true for featured memory", () => {
    assert.equal(isFeaturedMemory(sampleManifest, "p1", "mem1"), true);
  });

  it("returns false for non-featured memory", () => {
    assert.equal(isFeaturedMemory(sampleManifest, "p1", "mem2"), false);
  });

  it("returns false for unknown pair", () => {
    assert.equal(isFeaturedMemory(sampleManifest, "p2", "mem1"), false);
  });
});

describe("getMemoriesForPerson", () => {
  it("returns memories for person with curation ordering", () => {
    const mems = getMemoriesForPerson(sampleManifest, "p1");
    assert.equal(mems.length, 2);
    assert.equal(mems[0].id, "mem1");
    assert.equal(mems[1].id, "mem2");
  });

  it("returns empty for unknown person", () => {
    const mems = getMemoriesForPerson(sampleManifest, "nonexistent");
    assert.equal(mems.length, 0);
  });
});

describe("getRelatedMemories", () => {
  it("returns related memories when linked", () => {
    const related = getRelatedMemories(sampleManifest, "mem1");
    assert.equal(related.length, 1);
    assert.equal(related[0].id, "mem2");
  });

  it("returns empty when no related memories", () => {
    const related = getRelatedMemories(sampleManifest, "mem2");
    assert.equal(related.length, 0);
  });
});

describe("getMemoriesForPlace", () => {
  it("returns memories at a place", () => {
    const mems = getMemoriesForPlace(sampleManifest, "pl1");
    assert.equal(mems.length, 1);
    assert.equal(mems[0].id, "mem1");
  });
});

describe("searchManifest", () => {
  it("finds people by name", () => {
    const { people } = searchManifest(sampleManifest, "Eleanor");
    assert.equal(people.length, 1);
    assert.equal(people[0].id, "p1");
  });

  it("finds people by alsoKnownAs", () => {
    const { people } = searchManifest(sampleManifest, "Ellie");
    assert.equal(people.length, 1);
  });

  it("finds memories by title", () => {
    const { memories } = searchManifest(sampleManifest, "lake");
    assert.equal(memories.length, 2);
    assert.equal(memories.some((m) => m.id === "mem1"), true);
  });

  it("finds memories by body text", () => {
    const { memories } = searchManifest(sampleManifest, "Tahoe");
    assert.equal(memories.length, 1);
  });

  it("finds memories by transcript", () => {
    const { memories } = searchManifest(sampleManifest, "every summer");
    assert.equal(memories.length, 1);
  });

  it("finds places by label", () => {
    const { places } = searchManifest(sampleManifest, "Tahoe");
    assert.equal(places.length, 1);
  });

  it("returns empty for no query", () => {
    const { people, memories, places } = searchManifest(sampleManifest, "");
    assert.equal(people.length, 0);
    assert.equal(memories.length, 0);
    assert.equal(places.length, 0);
  });

  it("returns empty for no match", () => {
    const { people, memories } = searchManifest(sampleManifest, "xyzzy");
    assert.equal(people.length, 0);
    assert.equal(memories.length, 0);
  });
});