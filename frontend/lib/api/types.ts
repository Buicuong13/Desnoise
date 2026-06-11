/**
 * Types mirroring the FastAPI backend schemas in `backend/app/schemas/`.
 * Update these together with the backend models.
 */

export type UserRole = 'admin' | 'user' | 'viewer'
export type UserStatus = 'active' | 'banned' | 'pending'

export type PageStatus =
  | 'classifying'
  | 'rejected'
  | 'uploaded'
  | 'denoising'
  | 'denoised'
  | 'ocr_running'
  | 'ocr_done'
  | 'llm_running'
  | 'llm_done'
  | 'reviewing'
  | 'reviewed'
  | 'exported'
  | 'failed'

export type DocumentStatus = 'draft' | 'processing' | 'ready' | 'archived'

export interface ApiUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  status: UserStatus
  images_used: number
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  user: ApiUser
}

export interface ApiDocument {
  id: string
  title: string
  description: string | null
  /** Icon key (see lib/workspace-icons). */
  icon: string | null
  /** Color key (see lib/workspace-icons). */
  color: string | null
  status: DocumentStatus
  total_pages: number
  created_at: string
}

// Tiptap / ProseMirror document (loose typing — enough for the editor).
export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  content?: TiptapNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}
export interface TiptapDoc {
  type: 'doc'
  content: TiptapNode[]
}

export interface ApiPage {
  id: string
  document_id: string
  page_number: number
  status: PageStatus
  original_url: string
  /** Current denoised image (overwritten on each "Denoise Again"). */
  denoised_url: string | null
  denoise_version: number
  width: number | null
  height: number | null
  file_size_kb: number | null
  /** Document classifier result captured at upload: 'document' | 'non_document' | 'unknown'. */
  doc_class: string | null
  doc_class_confidence: number | null
  ocr_plain_text: string | null
  tiptap_json: TiptapDoc | null
  final_text: string | null
  processing_error: string | null
  completed_at: string | null
}

export interface ApiPageStatus {
  id: string
  status: PageStatus
  denoised_url: string | null
  denoise_version: number
  processing_error: string | null
}

// ── Direct upload (signed Cloudinary) ───────────────────────────────────────
export interface UploadSignature {
  upload_url: string
  fields: Record<string, string | number>
  expires_in: number
}

export interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  width: number
  height: number
  bytes: number
  format: string
}

// ── Billing / subscription ──────────────────────────────────────────────────
export interface PlanFeatures {
  tier?: 'free' | 'pro' | 'enterprise'
  purchasable?: boolean
  period?: 'monthly' | 'yearly'
  discount?: number
  contact?: boolean
  highlights?: string[]
}

export interface ApiPlan {
  id: number
  code: string
  name: string
  price_vnd: number
  duration_days: number
  features: PlanFeatures | null
  is_active: boolean
}

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'
export type PaymentGateway = 'vnpay' | 'momo' | 'stripe'
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded'

export interface ApiSubscription {
  id: string
  status: SubscriptionStatus
  starts_at: string
  ends_at: string
  plan: ApiPlan
}

export interface ApiPayment {
  id: string
  gateway: PaymentGateway
  gateway_txn_id: string
  amount_vnd: number
  status: PaymentStatus
  created_at: string
  paid_at: string | null
  plan_name: string | null
}

export type CorrectionStatus = 'pending' | 'kept' | 'undone'
/** Paid users pick between `openai` (gpt-4o-mini) and `ollama`; viewers are
 *  forced to the free tier. `openrouter_qwen` is an alternate free-tier option. */
export type LLMProvider = 'openai' | 'ollama' | 'openrouter_qwen'

export interface ApiOcrWord {
  id: number
  word_index: number
  text: string
  confidence: number
  bbox: { x: number; y: number; w: number; h: number } | null
  line_number: number | null
  is_suspicious: boolean
}

export interface ApiLowConfidenceWord {
  word_id: string
  text: string
  confidence: number
  bbox: number[]
  start_offset: number
  end_offset: number
}

/** Returned by GET /pages/{id}/ocr — document layout + Tiptap + plain text. */
export interface ApiOcrDocument {
  page_id: string
  width: number | null
  height: number | null
  ocr_document: Record<string, unknown> | null
  tiptap_json: TiptapDoc | null
  plain_text: string
  low_confidence_words: ApiLowConfidenceWord[]
  suspicious_count: number
  blurred: boolean
}

export interface ApiCorrection {
  id: string
  page_id: string
  word_indices: number[] | null
  start_offset: number | null
  end_offset: number | null
  original_text: string
  suggested_text: string
  reason: string | null
  llm_provider: LLMProvider
  llm_model: string
  confidence_score: number | null
  status: CorrectionStatus
  reviewed_at: string | null
  created_at: string
}

export interface ApiExportResult {
  export_id: string
  format: 'docx' | 'pdf'
  file_url: string
}

export interface ApiFinalText {
  page_id: string
  text: string
  blurred: boolean
}

// ── Admin panel ──────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  status: UserStatus
  auth_provider: string
  images_used: number
  documents_count: number
  created_at: string
  last_login_at: string | null
}

export interface AdminUserList {
  items: AdminUser[]
  total: number
  page: number
  page_size: number
}

export interface AdminDashboardStats {
  total_users: number
  new_users_30d: number
  total_documents: number
  total_pages: number
  pages_processed: number
  avg_processing_seconds: number | null
  success_rate: number
  revenue_vnd: number
}

export interface AdminActivityItem {
  id: number
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  created_at: string
}

export interface AdminDailyPoint {
  /** ISO date (YYYY-MM-DD), zero-filled across the last 30 days. */
  date: string
  created: number
  completed: number
}

export interface AdminDashboard {
  stats: AdminDashboardStats
  recent_users: AdminUser[]
  recent_activity: AdminActivityItem[]
  daily_pages: AdminDailyPoint[]
}

export interface AdminHistoryItem {
  page_id: string
  document_id: string
  document_title: string
  owner_email: string
  page_number: number
  status: PageStatus
  denoise_version: number
  ocr_done: boolean
  corrections_count: number
  created_at: string
  completed_at: string | null
}

export interface AdminHistoryList {
  items: AdminHistoryItem[]
  total: number
  page: number
  page_size: number
}
