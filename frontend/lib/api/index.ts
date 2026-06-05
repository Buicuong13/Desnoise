/**
 * Single import surface for the backend API client.
 *
 *   import { api } from '@/lib/api'
 *   await api.auth.login({ email, password })
 *   const docs = await api.documents.list()
 *   await api.ocr.trigger(pageId)
 */
import * as auth from './auth'
import * as billing from './billing'
import * as corrections from './corrections'
import * as documents from './documents'
import * as exportsApi from './exports'
import * as ocr from './ocr'
import * as pages from './pages'
import * as uploads from './uploads'

export const api = {
  auth,
  documents: {
    list: documents.listDocuments,
    create: documents.createDocument,
    get: documents.getDocument,
    update: documents.updateDocument,
    archive: documents.archiveDocument,
  },
  uploads: {
    sign: uploads.getSignature,
    toCloudinary: uploads.uploadToCloudinary,
    register: uploads.registerUpload,
    replace: uploads.replaceUpload,
  },
  pages: {
    denoise: pages.denoisePage,
    list: pages.listPages,
    get: pages.getPage,
    status: pages.getPageStatus,
    pollStatus: pages.pollPageStatus,
    downloadUrl: pages.getPageDownloadUrl,
  },
  ocr: {
    trigger: ocr.triggerOcr,
    get: ocr.getOcrResult,
    saveTiptap: ocr.patchTiptap,
  },
  corrections: {
    trigger: corrections.triggerLlmCorrection,
    list: corrections.listCorrections,
    keep: corrections.keepCorrection,
    undo: corrections.undoCorrection,
    bulk: corrections.bulkReview,
    finalText: corrections.getFinalText,
  },
  exports: {
    docx: exportsApi.exportDocx,
    pdf: exportsApi.exportPdf,
  },
  billing: {
    plans: billing.listPlans,
    me: billing.getMySubscription,
    payments: billing.listPayments,
    checkout: billing.createCheckout,
  },
}

export {
  ApiError,
  API_BASE_URL,
  getStoredToken,
  setStoredToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from './client'
export type * from './types'
