type Meta = { avatar_url?: unknown; picture?: unknown } | null | undefined;

export function resolveMetaAvatar(meta: Meta): string | null {
  if (!meta) return null;
  const v = meta.avatar_url ?? meta.picture;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function avatarNeedsSync(
  stored: string | null | undefined,
  next: string | null,
): boolean {
  return (stored ?? null) !== next;
}
