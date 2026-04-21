import type { TreeHomeCoverage, TreeHomeMemory } from "./homeTypes";

export const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

export function getVoiceTranscriptLabel(memory: TreeHomeMemory): string | null {
  if (memory.kind !== "voice") return null;
  if (memory.transcriptStatus === "completed" && memory.transcriptText) {
    return memory.transcriptText;
  }
  if (memory.transcriptStatus === "completed") {
    return "Transcript unavailable.";
  }
  if (memory.transcriptStatus === "failed") {
    return memory.transcriptError ? `Transcription failed: ${memory.transcriptError}` : "Transcription failed.";
  }
  if (memory.transcriptStatus === "queued" || memory.transcriptStatus === "processing") {
    return "Transcribing…";
  }
  return null;
}

export function getHeroExcerpt(memory: TreeHomeMemory | null): string | null {
  if (!memory) return null;
  if (memory.kind === "voice") return getVoiceTranscriptLabel(memory);
  if (memory.body?.trim()) return memory.body.trim();
  return null;
}

export function getCoverageRangeLabel(coverage: TreeHomeCoverage | null): string {
  if (!coverage || (coverage.earliestYear === null && coverage.latestYear === null)) {
    return "Dates are still gathering.";
  }
  if (coverage.earliestYear !== null && coverage.latestYear !== null) {
    if (coverage.earliestYear === coverage.latestYear) return `${coverage.earliestYear}`;
    return `${coverage.earliestYear} to ${coverage.latestYear}`;
  }
  return `${coverage.earliestYear ?? coverage.latestYear}`;
}
