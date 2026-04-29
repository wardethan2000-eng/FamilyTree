export function sanitizePath(entryPath: string): string | null {
  const parts = entryPath
    .split("/")
    .filter((part) => part !== "" && part !== "." && part !== "..");
  if (parts.length === 0) return null;
  const result = parts
    .map((part) => part.replace(/[<>:"|?*]/g, "_"))
    .join("/");
  if (result.startsWith("/") || result.startsWith("..")) return null;
  return result;
}