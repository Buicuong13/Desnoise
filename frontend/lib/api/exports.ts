/**
 * Export endpoints — build Word/PDF from the final reviewed content.
 * Backend blocks viewers (paid users / admins only).
 */
import { apiRequest } from './client'
import type { ApiExportResult } from './types'

export function exportDocx(documentId: string): Promise<ApiExportResult> {
  return apiRequest<ApiExportResult>(`/api/v1/documents/${documentId}/export/docx`, {
    method: 'POST',
  })
}

export function exportPdf(documentId: string): Promise<ApiExportResult> {
  return apiRequest<ApiExportResult>(`/api/v1/documents/${documentId}/export/pdf`, {
    method: 'POST',
  })
}
