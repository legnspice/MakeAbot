/** True if any provided argument is a present array with length 0.
 *  Repos use this to short-circuit an empty batch to [] instead of scanning. */
export function hasEmptyBatch(
  ...arrays: (readonly unknown[] | undefined | null)[]
): boolean {
  return arrays.some((a) => Array.isArray(a) && a.length === 0);
}
