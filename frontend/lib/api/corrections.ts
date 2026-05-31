/**
 * LLM correction endpoints — trigger, list, review (Keep/Undo), reconstruct final text.
 */
import { apiRequest } from './client'
import type { ApiCorrection, ApiFinalText, CorrectionStatus } from './types'

export function triggerLlmCorrection(
  pageId: string,
): Promise<{ status: string; page_id: string; provider: string }> {
  return apiRequest(`/api/v1/pages/${pageId}/llm-correction`, { method: 'POST' })
}

export function listCorrections(
  pageId: string,
  status?: CorrectionStatus,
): Promise<ApiCorrection[]> {
  const q = status ? `?status=${status}` : ''
  return apiRequest<ApiCorrection[]>(`/api/v1/corrections/by-page/${pageId}${q}`)
}

export function keepCorrection(id: string): Promise<ApiCorrection> {
  return apiRequest<ApiCorrection>(`/api/v1/corrections/${id}/keep`, { method: 'POST' })
}

export function undoCorrection(id: string): Promise<ApiCorrection> {
  return apiRequest<ApiCorrection>(`/api/v1/corrections/${id}/undo`, { method: 'POST' })
}

export function bulkReview(payload: {
  accept_ids?: string[]
  reject_ids?: string[]
}): Promise<ApiCorrection[]> {
  return apiRequest<ApiCorrection[]>(`/api/v1/corrections/bulk`, {
    method: 'POST',
    body: payload,
  })
}

export function getFinalText(pageId: string): Promise<ApiFinalText> {
  return apiRequest<ApiFinalText>(`/api/v1/corrections/by-page/${pageId}/final-text`)
}
