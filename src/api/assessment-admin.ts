import request from '@/utils/http'
import type {
  AssessmentCycle,
  AssessmentCyclePayload,
  AssessmentTemplateItem,
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
  position: string
  mobile: string
  elderlyFriendly: boolean
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
