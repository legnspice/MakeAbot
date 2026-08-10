type Meta = { avatar_url?: unknown; picture?: unknown } | null | undefined;

export function resolveMetaAvatar(meta: Meta): string | null {
  if (!meta) return null;
  const pick = (x: unknown): string | null =>
    typeof x === "string" && x.length > 0 ? x : null;
  // Treat an empty/blank avatar_url as absent and fall back to picture.
  return pick(meta.avatar_url) ?? pick(meta.picture);
}

export function avatarNeedsSync(
  stored: string | null | undefined,
  next: string | null,
): boolean {
  return (stored ?? null) !== next;
}

/** Resolve a display name from auth metadata (Google sets full_name/name). */
export function resolveMetaName(
  meta: { full_name?: unknown; name?: unknown } | null | undefined,
): string | null {
  if (!meta) return null;
  const v = meta.full_name ?? meta.name;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
