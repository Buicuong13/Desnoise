/**
 * Signed direct-to-Cloudinary upload (spec §3).
 *
 *   1. ask the backend to sign the upload  → getSignature()
 *   2. POST the file straight to Cloudinary → uploadToCloudinary()
 *   3. register the resulting metadata      → registerUpload()
 *
 * The image binary never passes through the FastAPI backend.
 */
import { apiRequest } from './client'
import type { ApiPage, CloudinaryUploadResult, UploadSignature } from './types'

export function getSignature(payload: {
  workspace_id: string
  filename: string
  content_type: string
  file_size: number
  purpose?: string
}): Promise<UploadSignature> {
  return apiRequest<UploadSignature>('/api/v1/uploads/signature', {
    method: 'POST',
    body: payload,
  })
}

/**
 * Upload the file directly to Cloudinary using the signed fields. Uses
 * XMLHttpRequest so we can report real upload progress. NOTE: no Authorization
 * header — this request goes to Cloudinary, not our backend.
 */
export function uploadToCloudinary(
  uploadUrl: string,
  fields: Record<string, string | number>,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const form = new FormData()
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)))
  form.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult)
        } catch {
          reject(new Error('Invalid Cloudinary response'))
        }
      } else {
        reject(new Error(`Cloudinary upload failed (${xhr.status}): ${xhr.responseText}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'))
    xhr.send(form)
  })
}

/**
 * Register the uploaded page. The document/non-document gate runs asynchronously
 * on the backend (classify_queue): the returned page starts at `classifying`
 * and the editor polls until it becomes `uploaded` or `rejected`.
 */
export function registerUpload(
  documentId: string,
  meta: {
    original_image_url: string
    cloudinary_public_id: string
    filename?: string
    file_size?: number
    width?: number
    height?: number
    format?: string
  },
): Promise<ApiPage> {
  return apiRequest<ApiPage>(`/api/v1/documents/${documentId}/pages/register-upload`, {
    method: 'POST',
    body: meta,
  })
}

/**
 * Replace the image of a *rejected* page in place (same page slot / id) and
 * re-run the classifier. Used when the user re-uploads after a non-document
 * rejection — avoids creating a new page that pushes later page numbers down.
 */
export function replaceUpload(
  pageId: string,
  meta: {
    original_image_url: string
    cloudinary_public_id: string
    filename?: string
    file_size?: number
    width?: number
    height?: number
    format?: string
  },
): Promise<ApiPage> {
  return apiRequest<ApiPage>(`/api/v1/pages/${pageId}/replace-upload`, {
    method: 'POST',
    body: meta,
  })
}
