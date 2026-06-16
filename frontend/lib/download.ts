/**
 * Download a page image to the user's machine.
 *
 * Scale / deploy note: when the image already lives on a public CDN (Cloudinary,
 * `https://…`) we fetch the bytes STRAIGHT from the CDN, so the FastAPI backend
 * is never in the download data-path — it can't be overwhelmed by download
 * traffic no matter how many users hit "Download" at once. Only the local-disk
 * storage fallback (dev / self-hosted, `local://…`) streams through the backend's
 * authed `/pages/{id}/download` endpoint, so we attach the bearer token there.
 *
 * UX note: where the browser supports the File System Access API (Chrome/Edge)
 * we open a native "Save As" dialog so the user picks the exact folder + name.
 * Elsewhere (Firefox/Safari) we fall back to a normal download into the
 * browser's default Downloads folder.
 */
import { API_BASE_URL, getStoredToken } from '@/lib/api'

// Minimal typing for the (still partially non-standard) File System Access API.
type SaveFilePicker = (opts?: {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}>

interface DownloadOpts {
  /** The page's stored URL (e.g. `denoised_url`). Public http URL → fetched
   *  directly from the CDN; anything else routes through the backend. */
  url?: string | null
  pageId: string
  type?: 'denoised' | 'original'
  /** Suggested file name shown in the Save dialog. */
  filename: string
}

/** Strip characters that are illegal in file names on Windows/macOS/Linux. */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
}

async function fetchImageBlob({ url, pageId, type = 'denoised' }: DownloadOpts): Promise<Blob> {
  // Public CDN URL → fetch directly, no backend, no auth needed.
  if (url && /^https?:\/\//i.test(url)) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    return res.blob()
  }
  // Local-disk storage fallback: authed backend endpoint (streams the bytes).
  const token = getStoredToken()
  const res = await fetch(`${API_BASE_URL}/api/v1/pages/${pageId}/download?type=${type}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return res.blob()
}

/** Map a file extension to a Save-As picker `types` entry so the native dialog
 *  shows a sensible filter (PNG image / PDF document / Word document …). */
function pickerTypes(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  const map: Record<string, { description: string; mime: string }> = {
    '.png': { description: 'PNG image', mime: 'image/png' },
    '.pdf': { description: 'PDF document', mime: 'application/pdf' },
    '.docx': {
      description: 'Word document',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  }
  const t = map[ext]
  return t ? [{ description: t.description, accept: { [t.mime]: [ext] } }] : undefined
}

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
  // Preferred: native Save-As picker so the user chooses the folder (Chromium,
  // secure context only — requires the user gesture we already have from click).
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: pickerTypes(filename),
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (e) {
      // User dismissed the dialog — respect that, don't silently auto-download.
      if (e instanceof DOMException && e.name === 'AbortError') return
      // Any other failure (permissions, etc.) → fall through to the anchor path.
    }
  }
  // Fallback: object-URL anchor download into the default Downloads folder.
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadImage(opts: DownloadOpts): Promise<void> {
  const blob = await fetchImageBlob(opts)
  await saveBlob(blob, safeFilename(opts.filename))
}
