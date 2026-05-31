/**
 * Page (uploaded image) endpoints + a small polling helper so UI code does
 * not have to reinvent it.
 */
import { API_BASE_URL, apiRequest } from './client'
import type { ApiPage, ApiPageStatus, PageStatus } from './types'

/** User-triggered, repeatable denoise. Pass source='current_denoised' to
 *  "Denoise Again" from the latest result (spec §4.3). */
export function denoisePage(
  pageId: string,
  opts: { source?: 'original' | 'current_denoised'; params?: Record<string, unknown> } = {},
): Promise<{ page_id: string; status: PageStatus }> {
  return apiRequest(`/api/v1/pages/${pageId}/denoise`, {
    method: 'POST',
    body: { source: opts.source ?? 'original', params: opts.params ?? {} },
  })
}

export function listPages(documentId: string): Promise<ApiPage[]> {
  return apiRequest<ApiPage[]>(`/api/v1/documents/${documentId}/pages`)
}

export function getPage(pageId: string): Promise<ApiPage> {
  return apiRequest<ApiPage>(`/api/v1/pages/${pageId}`)
}

export function getPageStatus(pageId: string): Promise<ApiPageStatus> {
  return apiRequest<ApiPageStatus>(`/api/v1/pages/${pageId}/status`)
}

/**
 * Build a URL that downloads (or redirects to) the stored image. Browsers can
 * use this directly as an `<img src>` since it injects the token via query
 * string — but we don't have that yet, so the simplest UX is to use the
 * Cloudinary URL returned on the page record. This helper is for the local
 * storage backend / explicit download buttons.
 */
export function getPageDownloadUrl(
  pageId: string,
  type: 'denoised' | 'original' = 'denoised',
): string {
  return `${API_BASE_URL}/api/v1/pages/${pageId}/download?type=${type}`
}

/**
 * Poll page status until it reaches a terminal state. Returns the final
 * status payload, or throws if the deadline is hit.
 */
export async function pollPageStatus(
  pageId: string,
  opts: {
    until?: PageStatus[]
    intervalMs?: number
    timeoutMs?: number
    onTick?: (s: ApiPageStatus) => void
    signal?: AbortSignal
  } = {},
): Promise<ApiPageStatus> {
  const {
    until = ['denoised', 'failed'],
    intervalMs = 1500,
    timeoutMs = 120_000,
    onTick,
    signal,
  } = opts
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const status = await getPageStatus(pageId)
    onTick?.(status)
    if (until.includes(status.status)) return status
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Polling timed out for page ${pageId}`)
}

