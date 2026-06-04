'use client'

/**
 * Direct-upload pipeline state (spec §3). Lives outside React so it survives
 * navigation. The browser uploads the file straight to Cloudinary; the backend
 * only signs the upload and registers the resulting page metadata.
 *
 * This step STOPS at status `uploaded` — denoise is a separate, user-triggered
 * action performed in the editor (pipeline "có điểm dừng").
 */
import { create } from 'zustand'

import { api, ApiError } from './api'
import type { ApiPage } from './api/types'

export type UploadStep =
  | 'idle'
  | 'signing'
  | 'uploading'
  | 'validating'
  | 'rejected'
  | 'registering'
  | 'complete'
  | 'error'

export type WorkspaceChoice =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; title: string }

export interface UploadRejection {
  /** 0..1 confidence that the image is NOT a document. */
  confidence: number
  probDocuments: number
}

interface UploadState {
  step: UploadStep
  progress: number
  statusMessage: string
  error: string | null
  rejection: UploadRejection | null
  resultPage: ApiPage | null
  documentId: string | null
  previewDataUrl: string | null
  fileName: string | null
}

interface UploadActions {
  startUpload: (
    workspace: WorkspaceChoice,
    file: File,
    previewDataUrl: string,
  ) => Promise<void>
  reset: () => void
}

const initial: UploadState = {
  step: 'idle',
  progress: 0,
  statusMessage: '',
  error: null,
  rejection: null,
  resultPage: null,
  documentId: null,
  previewDataUrl: null,
  fileName: null,
}

export const useUploadStore = create<UploadState & UploadActions>((set) => ({
  ...initial,

  reset: () => set(initial),

  startUpload: async (workspace, file, previewDataUrl) => {
    set({
      ...initial,
      step: 'signing',
      progress: 5,
      statusMessage: 'Preparing…',
      previewDataUrl,
      fileName: file.name,
    })

    try {
      // 1. Ensure a destination workspace.
      let documentId: string
      if (workspace.kind === 'new') {
        set({ statusMessage: 'Creating workspace…' })
        const doc = await api.documents.create({ title: workspace.title })
        documentId = doc.id
      } else {
        documentId = workspace.id
      }
      set({ documentId })

      // 2. Ask the backend to sign a direct Cloudinary upload.
      set({ progress: 15, statusMessage: 'Requesting upload signature…' })
      const signed = await api.uploads.sign({
        workspace_id: documentId,
        filename: file.name,
        content_type: file.type,
        file_size: file.size,
        purpose: 'original_page',
      })

      // 3. Upload the file straight to Cloudinary (no backend in between).
      set({ step: 'uploading', progress: 20, statusMessage: 'Uploading to Cloudinary…' })
      const result = await api.uploads.toCloudinary(
        signed.upload_url,
        signed.fields,
        file,
        (pct) => set({ progress: 20 + Math.round(pct * 0.6) }),
      )

      // 4. Validate the image is a document page (MobileNetV3 gate). If it is
      //    not a document we STOP here — never register, never spend quota.
      set({ step: 'validating', progress: 85, statusMessage: 'Checking the image is a document…' })
      const verdict = await api.uploads.validate({
        workspace_id: documentId,
        image_url: result.secure_url,
        cloudinary_public_id: result.public_id,
      })
      if (!verdict.is_document) {
        set({
          step: 'rejected',
          progress: 100,
          statusMessage: 'Not a document',
          rejection: {
            confidence: verdict.confidence,
            probDocuments: verdict.prob_documents,
          },
        })
        return
      }

      // 5. Register the page metadata with the backend.
      set({ step: 'registering', progress: 92, statusMessage: 'Saving page…' })
      const page = await api.uploads.register(documentId, {
        original_image_url: result.secure_url,
        cloudinary_public_id: result.public_id,
        filename: file.name,
        file_size: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
        doc_class: verdict.label,
        doc_class_confidence: verdict.confidence,
      })

      set({
        step: 'complete',
        progress: 100,
        statusMessage: 'Uploaded',
        resultPage: page,
        documentId,
      })
    } catch (e) {
      set({
        step: 'error',
        error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Upload failed',
      })
    }
  },
}))
