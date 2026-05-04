import request from '@/utils/http'
import { useUserStore } from '@/store/modules/user'
import type {
  AssessmentBootstrapPayload,
  AssessmentAssistPayload,
  AssessmentExportPayload,
  AssessmentRecordPayload,
  RectificationClosePayload,
  RectificationUpdatePayload,
  ReviewGroupConfirmPayload,
  ReviewActionPayload,
  AssessmentReviewLog,
  ManagerTaskPayload,
  PerformanceResult,
  TaskItem,
  TaskRecordPayload
} from '@/types/assessment'

export function fetchAssessmentBootstrap() {
  return request.get<AssessmentBootstrapPayload>({ url: '/api/assessment/bootstrap' })
}

export function fetchAssessmentAssist(userId: number) {
  return request.get<AssessmentAssistPayload>({ url: `/api/assessment/assist/${userId}` })
}

export function saveAssessmentRecord(params: AssessmentRecordPayload) {
  return request.post<AssessmentBootstrapPayload>({ url: '/api/assessment/records', params })
}

export function saveTaskRecord(params: TaskRecordPayload) {
  return request.post<AssessmentBootstrapPayload>({ url: '/api/assessment/tasks/records', params })
}

export function uploadTaskEvidence(taskId: string, file: File) {
  const formData = new FormData()
  formData.append('taskId', taskId)
  formData.append('file', file)
  return request.post<AssessmentBootstrapPayload>({
    url: '/api/assessment/tasks/evidence',
    data: formData,
    showSuccessMessage: true
  })
}

export function deleteTaskEvidence(id: string | number) {
  return request.del<AssessmentBootstrapPayload>({
    url: `/api/assessment/tasks/evidence/${id}`,
    showSuccessMessage: true
  })
}

export async function downloadTaskEvidence(id: string | number, fileName: string) {
  const { accessToken } = useUserStore()
  const baseUrl = import.meta.env.VITE_API_URL || ''
  const response = await fetch(`${baseUrl}/api/assessment/tasks/evidence/${id}/download`, {
    headers: accessToken ? { Authorization: accessToken } : {}
  })
  if (!response.ok) throw new Error('佐证材料下载失败')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function submitCurrentAssessment() {
  return request.post<AssessmentBootstrapPayload>({
    url: '/api/assessment/submit',
    params: {},
    showSuccessMessage: true
  })
}

export function reviewAssessmentRecord(
  recordType: 'assessment' | 'task',
  recordId: number,
  params: ReviewActionPayload
) {
  return request.post<AssessmentBootstrapPayload>({
    url: `/api/assessment/review/${recordType}/${recordId}`,
    params,
    showSuccessMessage: true
  })
}

export function closeAssessmentRectification(
  id: string | number,
  params: RectificationClosePayload = {}
) {
  return request.post<AssessmentBootstrapPayload>({
    url: `/api/assessment/rectifications/${id}/close`,
    params,
    showSuccessMessage: true
  })
}

export function updateAssessmentRectification(
  id: string | number,
  params: RectificationUpdatePayload
) {
  return request.put<AssessmentBootstrapPayload>({
    url: `/api/assessment/rectifications/${id}`,
    params,
    showSuccessMessage: true
  })
}

export function exportAssessmentResult() {
  return request.get<AssessmentExportPayload>({ url: '/api/assessment/export' })
}

export function fetchReviewLogs() {
  return request.get<AssessmentReviewLog[]>({ url: '/api/assessment/review-logs' })
}

export function fetchPerformanceResults() {
  return request.get<PerformanceResult[]>({ url: '/api/assessment/performance/results' })
}

export function confirmPerformance(comment = '员工电子确认') {
  return request.post<AssessmentBootstrapPayload>({
    url: '/api/assessment/performance/confirm',
    params: { comment },
    showSuccessMessage: true
  })
}

export function managerConfirmPerformance(userId: number, comment = '负责人电子确认') {
  return request.post<AssessmentBootstrapPayload>({
    url: `/api/assessment/performance/manager-confirm/${userId}`,
    params: { comment },
    showSuccessMessage: true
  })
}

export function reviewGroupConfirmPerformance(
  userId: number,
  params: ReviewGroupConfirmPayload | string = '考核小组复核签字'
) {
  const payload = typeof params === 'string' ? { comment: params } : params
  return request.post<AssessmentBootstrapPayload>({
    url: `/api/assessment/performance/review-group-confirm/${userId}`,
    params: payload,
    showSuccessMessage: true
  })
}

export function fetchManagedBoardTasks() {
  return request.get<TaskItem[]>({ url: '/api/assessment/manager/tasks' })
}

export function createManagedBoardTask(params: ManagerTaskPayload) {
  return request.post<TaskItem[]>({
    url: '/api/assessment/manager/tasks',
    params,
    showSuccessMessage: true
  })
}

export function updateManagedBoardTask(id: string, params: ManagerTaskPayload) {
  return request.put<TaskItem[]>({
    url: `/api/assessment/manager/tasks/${id}`,
    params,
    showSuccessMessage: true
  })
}

export function publishManagedBoardTask(id: string) {
  return request.post<TaskItem[]>({
    url: `/api/assessment/manager/tasks/${id}/publish`,
    params: {},
    showSuccessMessage: true
  })
}
