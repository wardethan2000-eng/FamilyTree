const STORAGE_KEY = "familytree:last-opened-tree-id";

export function readLastOpenedTreeId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeLastOpenedTreeId(treeId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, treeId);
  } catch {
    // Ignore storage failures. This hint should never block navigation.
  }
}
