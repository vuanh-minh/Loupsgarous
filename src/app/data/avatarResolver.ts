/**
 * avatarResolver.ts
 * Resolves avatar URLs stored as gallery references (`gallery:<id>`)
 * to actual build-time asset URLs. This ensures avatars work across
 * devices since each device resolves the ID against its own build.
 */
import { AVATAR_GALLERY } from './avatarGallery';

const GALLERY_PREFIX = 'gallery:';

// Build a fast lookup map once
const galleryMap = new Map<number, string>();
for (const avatar of AVATAR_GALLERY) {
  galleryMap.set(avatar.id, avatar.url);
}

/**
 * Resolve an avatarUrl that may be a gallery reference or a regular URL.
 * - `gallery:5` → resolved to AVATAR_GALLERY[id=5].url
 * - Regular URLs (uploaded images, signed URLs) are returned as-is
 */
export function resolveAvatarUrl(avatarUrl: string | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith(GALLERY_PREFIX)) {
    const id = parseInt(avatarUrl.slice(GALLERY_PREFIX.length), 10);
    return galleryMap.get(id) ?? undefined;
  }
  return avatarUrl;
}

/**
 * Create a gallery reference string for storing in game state.
 */
export function galleryRef(id: number): string {
  return `${GALLERY_PREFIX}${id}`;
}

/**
 * Check if an avatarUrl is a gallery reference.
 */
export function isGalleryRef(avatarUrl: string | undefined): boolean {
  return !!avatarUrl && avatarUrl.startsWith(GALLERY_PREFIX);
}

/**
 * Extract the gallery ID from a gallery reference, or null.
 */
export function getGalleryId(avatarUrl: string | undefined): number | null {
  if (!avatarUrl || !avatarUrl.startsWith(GALLERY_PREFIX)) return null;
  const id = parseInt(avatarUrl.slice(GALLERY_PREFIX.length), 10);
  return isNaN(id) ? null : id;
}
