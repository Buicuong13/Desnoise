/**
 * Export endpoints — build Word/PDF from the final reviewed content.
 * Backend blocks viewers (paid users / admins only).
 *
 * The backend streams the file directly (Content-Disposition: attachment) — no
 * Cloudinary copy — so we read it as a Blob here and hand it to `saveBlob` (the
 * native "Save As" picker). The server-suggested filename is parsed from the
 * Content-Disposition header.
 */
import { apiRequest } from './client'

export interface ExportFile {
  blob: Blob
  filename: string
}

function parseFilename(res: Response, fallback: string): string {
  const cd = res.headers.get('content-disposition') ?? ''
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)
  return m?.[1] ? decodeURIComponent(m[1]) : fallback
}

async function downloadExport(path: string, fallback: string): Promise<ExportFile> {
  const res = await apiRequest<Response>(path, { method: 'POST', raw: true })
  return { blob: await res.blob(), filename: parseFilename(res, fallback) }
}

export function exportDocx(documentId: string): Promise<ExportFile> {
  return downloadExport(`/api/v1/documents/${documentId}/export/docx`, 'document.docx')
}

export function exportPdf(documentId: string): Promise<ExportFile> {
  return downloadExport(`/api/v1/documents/${documentId}/export/pdf`, 'document.pdf')
}
