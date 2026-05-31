/**
 * OCR endpoints — trigger document-layout OCR, read back the layout + Tiptap
 * doc, and save manual Tiptap edits.
 */
import { apiRequest } from './client'
import type { ApiOcrDocument, ApiPage, TiptapDoc } from './types'

export function triggerOcr(pageId: string): Promise<{ status: string; page_id: string }> {
  return apiRequest(`/api/v1/pages/${pageId}/ocr`, { method: 'POST' })
}

export function getOcrResult(pageId: string): Promise<ApiOcrDocument> {
  return apiRequest<ApiOcrDocument>(`/api/v1/pages/${pageId}/ocr`)
}

export function patchTiptap(pageId: string, tiptapJson: TiptapDoc): Promise<ApiPage> {
  return apiRequest<ApiPage>(`/api/v1/pages/${pageId}/tiptap`, {
    method: 'PATCH',
    body: { tiptap_json: tiptapJson },
  })
}
