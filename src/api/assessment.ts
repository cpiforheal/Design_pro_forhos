import request from '@/utils/http'
import type {
  AssessmentBootstrapPayload,
  AssessmentAssistPayload,
  AssessmentExportPayload,
  AssessmentRecordPayload,
  RectificationClosePayload,
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
