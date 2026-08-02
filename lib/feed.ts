/** Remove items posted by the current user so they don't see their own posts in the feed. */
export function excludeOwnItems<T extends { userId: string }>(
  items: T[],
  currentUserId: string,
): T[] {
  return items.filter((item) => item.userId !== currentUserId);
}
