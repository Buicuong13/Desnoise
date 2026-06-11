/**
 * Admin panel endpoints — all require an admin-role token (the backend gates
 * them with the `AdminUser` dependency; a non-admin gets 403).
 */
import { apiRequest } from './client'
import type {
  AdminDashboard,
  AdminHistoryList,
  AdminUser,
  AdminUserList,
  UserRole,
  UserStatus,
} from './types'

export function getDashboard(): Promise<AdminDashboard> {
  return apiRequest<AdminDashboard>('/api/v1/admin/dashboard')
}

export interface ListUsersParams {
  search?: string
  role?: UserRole
  status?: UserStatus
  page?: number
  pageSize?: number
}

export function listUsers(params: ListUsersParams = {}): Promise<AdminUserList> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.role) qs.set('role', params.role)
  if (params.status) qs.set('status', params.status)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('page_size', String(params.pageSize))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiRequest<AdminUserList>(`/api/v1/admin/users${suffix}`)
}

export interface UpdateUserPayload {
  role?: UserRole
  status?: UserStatus
}

export function updateUser(userId: string, patch: UpdateUserPayload): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    body: patch,
  })
}

export interface ListHistoryParams {
  search?: string
  page?: number
  pageSize?: number
}

export function listHistory(params: ListHistoryParams = {}): Promise<AdminHistoryList> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('page_size', String(params.pageSize))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiRequest<AdminHistoryList>(`/api/v1/admin/history${suffix}`)
}
