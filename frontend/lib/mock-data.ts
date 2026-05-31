import { User, Document, Suggestion, ProcessingLog, DashboardStats, AdminStats } from './types'

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    email: 'john@example.com',
    name: 'John Nguyen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    role: 'user',
    createdAt: new Date('2024-01-15'),
    documentsProcessed: 47
  },
  {
    id: '2',
    email: 'sarah@example.com',
    name: 'Sarah Tran',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    role: 'user',
    createdAt: new Date('2024-02-20'),
    documentsProcessed: 23
  },
  {
    id: '3',
    email: 'admin@docrecovery.com',
    name: 'Admin User',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    documentsProcessed: 156
  },
  {
    id: '4',
    email: 'mike@example.com',
    name: 'Mike Le',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
    role: 'user',
    createdAt: new Date('2024-03-10'),
    documentsProcessed: 12
  },
  {
    id: '5',
    email: 'emma@example.com',
    name: 'Emma Pham',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    role: 'user',
    createdAt: new Date('2024-03-25'),
    documentsProcessed: 8
  }
]

// Current logged in user (for demo)
export const currentUser: User = mockUsers[0]
export const adminUser: User = mockUsers[2]

// Mock suggestions for OCR text
const createSuggestions = (documentId: string): Suggestion[] => [
  {
    id: `${documentId}-sug-1`,
    startIndex: 45,
    endIndex: 52,
    originalText: 'recieve',
    suggestedText: 'receive',
    confidence: 98,
    status: 'pending',
    reason: 'Common spelling error: "i before e except after c"'
  },
  {
    id: `${documentId}-sug-2`,
    startIndex: 120,
    endIndex: 135,
    originalText: 'th□ document',
    suggestedText: 'the document',
    confidence: 95,
    status: 'pending',
    reason: 'Character recovery: missing "e" detected from context'
  },
  {
    id: `${documentId}-sug-3`,
    startIndex: 200,
    endIndex: 215,
    originalText: 'imp0rtant',
    suggestedText: 'important',
    confidence: 92,
    status: 'pending',
    reason: 'OCR confusion: "0" (zero) detected as "o" based on word pattern'
  },
  {
    id: `${documentId}-sug-4`,
    startIndex: 280,
    endIndex: 295,
    originalText: 'cornpany',
    suggestedText: 'company',
    confidence: 89,
    status: 'pending',
    reason: 'OCR confusion: "rn" pattern often misread, corrected based on dictionary'
  },
  {
    id: `${documentId}-sug-5`,
    startIndex: 350,
    endIndex: 365,
    originalText: 'addres□',
    suggestedText: 'address',
    confidence: 94,
    status: 'pending',
    reason: 'Character recovery: missing final "s" inferred from context'
  }
]

// Sample OCR text with errors that match suggestions
const sampleOcrText = `BUSINESS AGREEMENT

This agreement is made between the parties listed below. Please recieve this document as confirmation of our partnership.

Section 1: Terms and Conditions

According to th□ document specifications, all parties must adhere to the following guidelines. This is an imp0rtant notice regarding the terms of service.

Section 2: Company Information

The cornpany reserves the right to modify these terms at any time. Please ensure your contact addres□ is up to date in our records.

Section 3: Signatures

All parties have reviewed and agree to the terms stated above. This document has been processed through our advanced OCR system with AI-powered text recovery.

Date: March 15, 2024
Reference Number: DOC-2024-0892`

// Mock Documents
export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    userId: '1',
    title: 'Business Agreement 2024',
    originalImageUrl: '/mock/blurry-doc-1.jpg',
    denoisedImageUrl: '/mock/clear-doc-1.jpg',
    ocrText: sampleOcrText,
    suggestions: createSuggestions('doc-1'),
    status: 'completed',
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-03-15')
  },
  {
    id: 'doc-2',
    userId: '1',
    title: 'Invoice Receipt',
    originalImageUrl: '/mock/blurry-doc-2.jpg',
    denoisedImageUrl: '/mock/clear-doc-2.jpg',
    ocrText: 'Invoice #INV-2024-0456\n\nBilled to: John Nguyen\nDate: March 10, 2024\n\nItems:\n- Service Fee: $150.00\n- Processing: $25.00\n\nTotal: $175.00',
    suggestions: [
      {
        id: 'doc-2-sug-1',
        startIndex: 8,
        endIndex: 20,
        originalText: 'INV-2O24-0456',
        suggestedText: 'INV-2024-0456',
        confidence: 97,
        status: 'accepted',
        reason: 'OCR confusion: "O" corrected to "0" in year format'
      }
    ],
    status: 'completed',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-10')
  },
  {
    id: 'doc-3',
    userId: '1',
    title: 'Meeting Notes',
    originalImageUrl: '/mock/blurry-doc-3.jpg',
    denoisedImageUrl: '/mock/clear-doc-3.jpg',
    ocrText: 'Meeting Notes - Q1 Review\n\nAttendees: John, Sarah, Mike\nDate: March 5, 2024\n\nAgenda:\n1. Review Q1 performance\n2. Discuss Q2 targets\n3. Budget allocation',
    suggestions: [],
    status: 'completed',
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-03-05')
  },
  {
    id: 'doc-4',
    userId: '2',
    title: 'Contract Draft',
    originalImageUrl: '/mock/blurry-doc-4.jpg',
    denoisedImageUrl: '/mock/clear-doc-4.jpg',
    ocrText: 'Contract for Services\n\nThis contract establishes...',
    suggestions: createSuggestions('doc-4'),
    status: 'processing',
    createdAt: new Date('2024-03-18'),
    updatedAt: new Date('2024-03-18')
  },
  {
    id: 'doc-5',
    userId: '1',
    title: 'Tax Document 2023',
    originalImageUrl: '/mock/blurry-doc-5.jpg',
    denoisedImageUrl: '/mock/clear-doc-5.jpg',
    ocrText: 'TAX RETURN 2023\n\nFiler: John Nguyen\nSSN: XXX-XX-1234\n\nGross Income: $85,000\nDeductions: $12,500\nTaxable Income: $72,500',
    suggestions: [
      {
        id: 'doc-5-sug-1',
        startIndex: 55,
        endIndex: 65,
        originalText: '$85,0OO',
        suggestedText: '$85,000',
        confidence: 99,
        status: 'accepted',
        reason: 'OCR confusion: "O" corrected to "0" in currency amount'
      }
    ],
    status: 'completed',
    createdAt: new Date('2024-02-28'),
    updatedAt: new Date('2024-02-28')
  }
]

// Mock Processing Logs
export const mockProcessingLogs: ProcessingLog[] = [
  {
    id: 'log-1',
    documentId: 'doc-1',
    userId: '1',
    userName: 'John Nguyen',
    action: 'upload',
    details: 'Document uploaded: Business Agreement 2024',
    timestamp: new Date('2024-03-15T10:30:00')
  },
  {
    id: 'log-2',
    documentId: 'doc-1',
    userId: '1',
    userName: 'John Nguyen',
    action: 'denoise',
    details: 'Image denoising completed. Quality improved by 78%',
    timestamp: new Date('2024-03-15T10:30:15')
  },
  {
    id: 'log-3',
    documentId: 'doc-1',
    userId: '1',
    userName: 'John Nguyen',
    action: 'ocr',
    details: 'OCR extraction completed. 5 potential corrections suggested.',
    timestamp: new Date('2024-03-15T10:30:45')
  },
  {
    id: 'log-4',
    documentId: 'doc-2',
    userId: '1',
    userName: 'John Nguyen',
    action: 'suggestion_accepted',
    details: 'Accepted correction: "INV-2O24-0456" → "INV-2024-0456"',
    timestamp: new Date('2024-03-10T14:22:00')
  },
  {
    id: 'log-5',
    documentId: 'doc-2',
    userId: '1',
    userName: 'John Nguyen',
    action: 'export',
    details: 'Document exported as PDF',
    timestamp: new Date('2024-03-10T14:25:00')
  },
  {
    id: 'log-6',
    documentId: 'doc-4',
    userId: '2',
    userName: 'Sarah Tran',
    action: 'upload',
    details: 'Document uploaded: Contract Draft',
    timestamp: new Date('2024-03-18T09:15:00')
  },
  {
    id: 'log-7',
    documentId: 'doc-4',
    userId: '2',
    userName: 'Sarah Tran',
    action: 'denoise',
    details: 'Image denoising in progress...',
    timestamp: new Date('2024-03-18T09:15:30')
  }
]

// Dashboard Stats for current user
export const mockDashboardStats: DashboardStats = {
  totalDocuments: 47,
  documentsThisMonth: 12,
  successRate: 96.5,
  averageProcessingTime: 8.3,
  suggestionsAccepted: 156,
  suggestionsRejected: 23
}

// Admin Stats
export const mockAdminStats: AdminStats = {
  totalDocuments: 1250,
  documentsThisMonth: 342,
  successRate: 94.8,
  averageProcessingTime: 9.2,
  suggestionsAccepted: 4521,
  suggestionsRejected: 892,
  totalUsers: 156,
  activeUsersToday: 42,
  storageUsed: 2450
}

// Helper to get user's documents
export function getUserDocuments(userId: string): Document[] {
  return mockDocuments.filter(doc => doc.userId === userId)
}

// Helper to get document by ID
export function getDocumentById(documentId: string): Document | undefined {
  return mockDocuments.find(doc => doc.id === documentId)
}

// Helper to get user's logs
export function getUserLogs(userId: string): ProcessingLog[] {
  return mockProcessingLogs.filter(log => log.userId === userId)
}

// Helper to get all logs (for admin)
export function getAllLogs(): ProcessingLog[] {
  return mockProcessingLogs
}
