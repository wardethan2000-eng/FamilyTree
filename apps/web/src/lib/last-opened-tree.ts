const STORAGE_KEY = "tessera:last-opened-tree-id";
const LEGACY_STORAGE_KEY_1 = "familytree:last-opened-tree-id";
const LEGACY_STORAGE_KEY_2 = "heirloom:last-opened-tree-id";

export function readLastOpenedTreeId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return (
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY_1) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY_2)
    );
  } catch {
    return null;
  }
}

export function writeLastOpenedTreeId(treeId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_1);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_2);
    window.localStorage.setItem(STORAGE_KEY, treeId);
  } catch {
    // Ignore storage failures. This hint should never block navigation.
  }
}
