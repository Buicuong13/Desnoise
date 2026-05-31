/**
 * Workspace (document) endpoints.
 */
import { apiRequest } from './client'
import type { ApiDocument } from './types'

export interface CreateDocumentPayload {
  title: string
  description?: string
}

export function listDocuments(): Promise<ApiDocument[]> {
  return apiRequest<ApiDocument[]>('/api/v1/documents')
}

export function createDocument(payload: CreateDocumentPayload): Promise<ApiDocument> {
  return apiRequest<ApiDocument>('/api/v1/documents', { method: 'POST', body: payload })
}

export function getDocument(id: string): Promise<ApiDocument> {
  return apiRequest<ApiDocument>(`/api/v1/documents/${id}`)
}

export function archiveDocument(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/documents/${id}`, { method: 'DELETE' })
}
