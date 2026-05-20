export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^--/, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9_-]/g, "")
    .slice(0, 63);
}
