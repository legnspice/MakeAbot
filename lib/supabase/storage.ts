import { createAdminClient } from "./admin";

const BUCKET = "post_photos";

/**
 * Recover the storage object path from a stored public URL.
 *
 * Public URLs look like
 *   https://<ref>.supabase.co/storage/v1/object/public/post_photos/<path>
 * Returns null for anything that is not a URL into this bucket, so a
 * hand-edited or external value cannot make the caller delete the wrong object.
 */
export function objectPathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * Delete the storage object backing a public `imgUrl`.
 *
 * Never throws: the nightly sweep continues past a storage failure and
 * counts it, so any error here is swallowed and reported as `false`.
 */
export async function deleteStorageObject(url: string): Promise<boolean> {
  const path = objectPathFromUrl(url);
  if (path === null) return false;

  try {
    const supabase = await createAdminClient();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}
