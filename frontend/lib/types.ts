// User types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'user' | 'admin'
  createdAt: Date
  documentsProcessed: number
}

// Document types
export interface Document {
  id: string
  userId: string
  title: string
  originalImageUrl: string
  denoisedImageUrl: string
  ocrText: string
  suggestions: Suggestion[]
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

// AI Suggestion for text correction (Copilot-style)
export interface Suggestion {
  id: string
  startIndex: number
  endIndex: number
  originalText: string
  suggestedText: string
  confidence: number // 0-100
  status: 'pending' | 'accepted' | 'rejected'
  reason?: string // AI explanation for the suggestion
}

// Processing Log
export interface ProcessingLog {
  id: string
  documentId: string
  userId: string
  userName: string
  action: 'upload' | 'denoise' | 'ocr' | 'suggestion_accepted' | 'suggestion_rejected' | 'export'
  details: string
  timestamp: Date
}

// Stats for dashboard
export interface DashboardStats {
  totalDocuments: number
  documentsThisMonth: number
  successRate: number
  averageProcessingTime: number // in seconds
  suggestionsAccepted: number
  suggestionsRejected: number
}

// Admin stats
export interface AdminStats extends DashboardStats {
  totalUsers: number
  activeUsersToday: number
  storageUsed: number // in MB
}

// Auth state
export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}
