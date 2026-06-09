/**
 * Insert a Cloudinary transformation into a delivery URL so the browser fetches
 * a right-sized, modern-format image instead of the full-resolution original.
 *
 * Why: page images are stored as raw `secure_url`s (multi-MB PNG/JPEG). Rendering
 * those at thumbnail / canvas size still downloads + DECODES the full image on the
 * main thread — the cause of the jank when switching pages. A transform like
 * `w_1600,f_auto,q_auto` drops that to tens of KB with no visible quality loss on
 * screen, so page switches feel instant.
 *
 * The transform string is spliced in right after `/upload/`. Non-Cloudinary URLs
 * (e.g. the `local://` storage fallback, or any non-upload URL) are returned
 * untouched, so callers can pass any stored URL safely.
 *
 * For the FULL-resolution original, just use the raw stored URL (don't call this)
 * — that's what the "Xem ảnh gốc" link and the Download button do on purpose.
 */
const UPLOAD_MARKER = '/image/upload/'

export function cloudinaryUrl(
  url: string | null | undefined,
  transform: string,
): string {
  if (!url || !transform) return url ?? ''
  const idx = url.indexOf(UPLOAD_MARKER)
  if (idx === -1) return url // not a Cloudinary delivery URL — leave as-is
  const head = url.slice(0, idx + UPLOAD_MARKER.length)
  const tail = url.slice(idx + UPLOAD_MARKER.length)
  return `${head}${transform}/${tail}`
}

/** Sidebar page thumbnail — square crop, retina-friendly, format/quality auto. */
export const TX_THUMB = 'w_160,h_160,c_fill,f_auto,q_auto'

/**
 * Main canvas / before-after compare. Capped width covers retina screens
 * (dpr_auto serves @2x where needed) while staying small enough to decode
 * without blocking. Visually identical to the original at on-screen sizes.
 */
export const TX_CANVAS = 'w_1600,f_auto,q_auto,dpr_auto'
