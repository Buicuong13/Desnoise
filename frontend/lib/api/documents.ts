/**
 * Workspace (document) endpoints.
 */
import { apiRequest } from './client'
import type { ApiDocument } from './types'

export interface CreateDocumentPayload {
  title: string
  description?: string
  icon?: string
  color?: string
}

export interface UpdateDocumentPayload {
  title?: string
  description?: string | null
  icon?: string | null
  color?: string | null
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

export function updateDocument(id: string, patch: UpdateDocumentPayload): Promise<ApiDocument> {
  return apiRequest<ApiDocument>(`/api/v1/documents/${id}`, { method: 'PATCH', body: patch })
}

export function archiveDocument(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/documents/${id}`, { method: 'DELETE' })
}
