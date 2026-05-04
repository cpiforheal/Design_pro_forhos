import request from '@/utils/http'
import type {
  AssessmentCycle,
  AssessmentCyclePayload,
  AssessmentTemplateItem,
  BoardResponsibilityConfig,
  PermissionGrant,
  RoleGrantUpdatePayload,
  StaffingPosition,
  StaffingPositionUpdatePayload,
  TemplateUpdatePayload
} from '@/types/assessment'

export interface AccountUserItem {
  id: number
  username: string
  displayName: string
  employeeNo: string
  email: string
  status: 'active' | 'disabled'
  roleCode: string
  roleName: string
  boardId: string
  boardName: string
  position: string
  mobile: string
  elderlyFriendly: boolean
  medicalRecordStages: string[]
  updatedAt: string
}

export interface LoginLogItem {
  id: number
  userId: number | null
  username: string
  displayName: string
  employeeNo: string
  roleName: string
  boardName: string
  status: 'success' | 'failed'
  message: string
  ipAddress: string
  userAgent: string
  loggedAt: string
}

export interface CreateAccountParams {
  username: string
  password: string
  displayName: string
  employeeNo: string
  email: string
  roleCode: string
  boardId?: string
  position?: string
  mobile?: string
  elderlyFriendly?: boolean
  medicalRecordStages?: string[]
}

export interface UpdateAccountProfileParams {
  username?: string
  password?: string
  roleCode?: string
  displayName?: string
  employeeNo?: string
  email?: string
  status?: 'active' | 'disabled'
  boardId?: string
  position?: string
  mobile?: string
  elderlyFriendly?: boolean
  medicalRecordStages?: string[]
}

export function fetchAccountUsers() {
  return request.get<AccountUserItem[]>({
    url: '/api/admin/users'
  })
}

export function createAccountUser(params: CreateAccountParams) {
  return request.post<null>({
    url: '/api/admin/users',
    params,
    showSuccessMessage: true
  })
}

export function updateAccountUserRole(userId: number, roleCode: string) {
  return request.put<null>({
    url: `/api/admin/users/${userId}/role`,
    params: { roleCode },
    showSuccessMessage: true
  })
}

export function updateAccountUserProfile(userId: number, params: UpdateAccountProfileParams) {
  return request.put<null>({
    url: `/api/admin/users/${userId}/profile`,
    params,
    showSuccessMessage: true
  })
}

export function resetAccountUserPassword(userId: number, password: string) {
  return request.put<null>({
    url: `/api/admin/users/${userId}/password`,
    params: { password },
    showSuccessMessage: true
  })
}

export function fetchLoginLogs(limit = 200) {
  return request.get<LoginLogItem[]>({
    url: '/api/admin/login-logs',
    params: { limit }
  })
}

export function fetchRoleGrants() {
  return request.get<PermissionGrant[]>({ url: '/api/admin/roles' })
}

export function updateRoleGrant(roleId: string | number, params: RoleGrantUpdatePayload) {
  return request.put<PermissionGrant[]>({
    url: `/api/admin/roles/${roleId}`,
    params,
    showSuccessMessage: true
  })
}

export function fetchAssessmentCycles() {
  return request.get<AssessmentCycle[]>({ url: '/api/admin/assessment/cycles' })
}

export function createAssessmentCycle(params: AssessmentCyclePayload) {
  return request.post<AssessmentCycle[]>({
    url: '/api/admin/assessment/cycles',
    params,
    showSuccessMessage: true
  })
}

export function updateAssessmentCycle(cycleId: string, params: Partial<AssessmentCyclePayload>) {
  return request.put<AssessmentCycle[]>({
    url: `/api/admin/assessment/cycles/${cycleId}`,
    params,
    showSuccessMessage: true
  })
}

export function updateAssessmentCycleStatus(cycleId: string, status: string) {
  return request.put<AssessmentCycle[]>({
    url: `/api/admin/assessment/cycles/${cycleId}/status`,
    params: { status },
    showSuccessMessage: true
  })
}

export function fetchAssessmentTemplates() {
  return request.get<AssessmentTemplateItem[]>({ url: '/api/admin/assessment/templates' })
}

export function updateAssessmentTemplate(itemId: string, params: TemplateUpdatePayload) {
  return request.put<null>({
    url: `/api/admin/assessment/templates/${itemId}`,
    params,
    showSuccessMessage: true
  })
}

export function fetchBoardResponsibilityConfig() {
  return request.get<BoardResponsibilityConfig[]>({ url: '/api/admin/organization/boards' })
}

export function updateBoardResponsibilityConfig(
  boardId: string,
  params: {
    leaderUserId?: number | null
    managerUserId?: number | null
    officeCoordinatorUserId?: number | null
  }
) {
  return request.put<BoardResponsibilityConfig[]>({
    url: `/api/admin/organization/boards/${boardId}`,
    params,
    showSuccessMessage: true
  })
}

export function fetchStaffingPositions() {
  return request.get<StaffingPosition[]>({ url: '/api/admin/staffing' })
}

export function updateStaffingPosition(id: string, params: StaffingPositionUpdatePayload) {
  return request.put<StaffingPosition[]>({
    url: `/api/admin/staffing/${id}`,
    params,
    showSuccessMessage: true
  })
}
