export type AssessmentStatus = 'completed' | 'pending' | 'na'
export type WorkflowStatus =
  | 'notStarted'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'returned'
  | 'rectifying'
  | 'closed'
export type AssessmentCycleStatus =
  | 'notStarted'
  | 'filling'
  | 'reviewing'
  | 'completed'
  | 'archived'
export type AssessmentCycleType = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type TodoPriority = 'normal' | 'warning' | 'urgent'
export type TodoSource = 'assessment' | 'task' | 'rectification' | 'review'
export type EmployeeStatus = 'active' | 'inactive'
export type SystemRoleCode = 'R_SUPER' | 'R_LEADER' | 'R_MANAGER' | 'R_EMPLOYEE'
export type TaskCategory =
  | '周一重点任务'
  | '医院重点任务'
  | '分管负责人任务'
  | '临时突击任务'
  | '创新发展任务'

export type RoleId =
  | 'superAdmin'
  | 'leader'
  | 'generalOffice'
  | 'medicalDirector'
  | 'nursingDirector'
  | 'adminSupportDirector'
  | 'brandDirector'
  | 'financeHrDirector'
  | 'employee'

export type BoardId =
  | 'allStaff'
  | 'medical'
  | 'nursing'
  | 'generalOffice'
  | 'adminSupport'
  | 'brand'
  | 'financeHr'

export interface Role {
  id: RoleId
  name: string
  scope: 'super' | 'all' | 'board' | 'employee'
  boardIds: BoardId[]
  description: string
  defaultBoardId: BoardId
}

export interface Board {
  id: BoardId
  name: string
  owner: string
  description: string
  color: string
  leaderUserId?: number
  managerUserId?: number
  officeCoordinatorUserId?: number
}

export interface EmployeeProfile {
  id: string
  name: string
  employeeNo: string
  boardId: BoardId
  roleId: RoleId
  systemRole: SystemRoleCode
  position: string
  mobile?: string
  status: EmployeeStatus
  elderlyFriendly?: boolean
}

export interface AssessmentCycle {
  id: string
  name: string
  type: AssessmentCycleType
  startDate: string
  endDate: string
  submitDeadline: string
  reviewDeadline: string
  status: AssessmentCycleStatus
  description: string
}

export interface AssessmentItem {
  id: string
  category: '全员通用' | '板块专项'
  boardId: BoardId
  moduleName: string
  title: string
  standard: string
  isRedline?: boolean
  score?: number
  deductScore?: number
  requireEvidence?: boolean
}

export interface TaskItem {
  id: string
  source: '医院安排' | '分管负责人安排'
  boardId: BoardId
  title: string
  deadline: string
  deadlineAt?: string
  taskCategory?: TaskCategory
  deployerUserId?: number
  acceptorUserId?: number
  acceptanceStatus?: '待验收' | '验收通过' | '退回整改'
  overdueLocked?: boolean
  overdue?: boolean
  collaborationNote?: string
  owner: string
  enabled?: boolean
  assigneeMode?: 'board' | 'users'
  assigneeUserIds?: number[]
  assigneeNames?: string[]
}

export interface ManagerTaskPayload {
  id?: string
  boardId: BoardId
  title: string
  deadline: string
  deadlineAt?: string
  taskCategory?: TaskCategory
  deployerUserId?: number
  acceptorUserId?: number
  acceptanceStatus?: string
  collaborationNote?: string
  owner: string
  enabled?: boolean
  assigneeMode?: 'board' | 'users'
  assigneeUserIds?: number[]
}

export interface EvidenceAttachment {
  id: string
  name: string
  type: 'image' | 'file' | 'link'
  url: string
  uploadedAt: string
}

export interface ReviewRecord {
  id: string
  operator: string
  action: WorkflowStatus
  comment: string
  operatedAt: string
}

export interface EvaluationDraft {
  status: AssessmentStatus
  remark: string
  rectification: string
  workflowStatus?: WorkflowStatus
  submittedAt?: string
  reviewedAt?: string
  reviewer?: string
  reviewComment?: string
  attachments?: EvidenceAttachment[]
  reviewRecords?: ReviewRecord[]
}

export interface TaskDraft {
  status: AssessmentStatus
  remark: string
  evidenceText?: string
  workflowStatus?: WorkflowStatus
  submittedAt?: string
  reviewedAt?: string
  reviewer?: string
  reviewComment?: string
  attachments?: EvidenceAttachment[]
  reviewRecords?: ReviewRecord[]
}

export interface RectificationItem {
  id: string
  source: string
  boardName: string
  description: string
  owner: string
  rectification: string
  status: '待整改' | '整改中' | '已销号'
}

export interface ScoreSummary {
  totalApplicable: number
  completedCount: number
  pendingCount: number
  completionRate: number
  dailyScore: number
  redlinePenalty: number
  finalScore: number
}

export interface AssessmentTodoItem {
  id: string
  title: string
  description: string
  source: TodoSource
  boardId: BoardId
  boardName: string
  owner: string
  deadline: string
  priority: TodoPriority
  workflowStatus: WorkflowStatus
  actionText: string
}

export interface EmployeeAssessmentSnapshot {
  employee: EmployeeProfile
  cycle: AssessmentCycle
  todoCount: number
  urgentTodoCount: number
  completionRate: number
  finalScore: number
  hasReturnedItems: boolean
  hasRectificationItems: boolean
}

export interface PermissionGrant {
  id: string | number
  roleCode: string
  roleName: string
  description: string
  menuPermissions: string[]
  actionPermissions: string[]
  dataScope: 'all' | 'board' | 'self'
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface RoleGrantUpdatePayload {
  roleName?: string
  description?: string
  menuPermissions?: string[]
  actionPermissions?: string[]
  dataScope?: 'all' | 'board' | 'self'
  enabled?: boolean
}

export interface AssessmentAdminConfig {
  allowEmployeeSelfSubmit: boolean
  requireEvidenceForPending: boolean
  requireReviewBeforeClose: boolean
  elderlyFriendlyMode: boolean
  defaultReviewerName: string
}

export interface ExportPayload {
  roleId: RoleId
  roleName: string
  boardId: BoardId
  boardName: string
  assignee: string
  generatedAt: string
  summary: ScoreSummary
  redlineTriggered: boolean
  assessments: Array<
    AssessmentItem & {
      draft: EvaluationDraft
    }
  >
  tasks: Array<
    TaskItem & {
      draft: TaskDraft
    }
  >
  rectifications: RectificationItem[]
}

export interface AssessmentRecordDraft extends EvaluationDraft {
  recordId?: number
}

export interface TaskRecordDraft extends TaskDraft {
  recordId?: number
}

export interface AssessmentReviewTodoItem extends AssessmentTodoItem {
  recordType: 'assessment' | 'task'
  recordId: number
  evidenceText?: string
  attachments?: EvidenceAttachment[]
}

export interface MyTodoSummary {
  pending: number
  reviewing: number
  returned: number
  rectifying: number
  completed: number
}

export interface MyAssessmentGroups {
  pending: AssessmentTodoItem[]
  reviewing: AssessmentTodoItem[]
  returned: AssessmentTodoItem[]
  rectifying: AssessmentTodoItem[]
  completed: AssessmentTodoItem[]
}
export interface AssessmentTemplateItem {
  id: string
  category: string
  boardId: BoardId
  boardName: string
  moduleName: string
  title: string
  standard: string
  isRedline: boolean
  enabled: boolean
  sortOrder: number
  score: number
  deductScore: number
  requireEvidence: boolean
}

export interface AssessmentCyclePayload {
  id?: string
  name: string
  type: AssessmentCycleType
  startDate: string
  endDate: string
  submitDeadline: string
  reviewDeadline: string
  status?: AssessmentCycleStatus
  description?: string
}

export interface CycleStatusAction {
  status: AssessmentCycleStatus
  label: string
}

export interface AssessmentReviewLog {
  id: number
  cycleId: string
  recordType: string
  recordId: number
  targetUserId: number
  targetName: string
  operatorUserId: number
  operatorName: string
  boardName: string
  action: string
  comment: string
  operatedAt: string
}

export interface PerformanceResult {
  id: number
  cycleId: string
  userId: number
  employeeName: string
  employeeNo: string
  boardId: BoardId
  boardName: string
  completionRate: number
  dailyScore: number
  redlinePenalty: number
  finalScore: number
  unfinishedCount: number
  rectificationCount: number
  overdueCount: number
  archivedStatus: 'draft' | 'ready' | 'archived'
  employeeConfirmedAt: string
  managerConfirmedAt: string
  managerUserId?: number
  managerName?: string
  updatedAt: string
}

export interface PerformanceConfirmation {
  id: number
  cycleId: string
  userId: number
  role: 'employee' | 'manager'
  confirmerUserId: number
  comment: string
  confirmedAt: string
}

export interface PerformanceSummary {
  totalEmployees: number
  averageScore: number
  averageCompletionRate: number
  readyToArchiveCount: number
  archivedCount: number
  boardSummaries: Array<{
    boardId: BoardId
    boardName: string
    completionRate: number
    averageScore: number
    overdueTaskCount: number
  }>
}

export interface RiskSummary {
  overdueTaskCount: number
  unconfirmedEmployeeCount: number
  openRectificationCount: number
  redlineCount: number
  lowScoreEmployees: PerformanceResult[]
}

export interface ConfirmationSummary {
  totalEmployees: number
  employeeConfirmedCount: number
  managerConfirmedCount: number
  readyToArchiveCount: number
  unconfirmedCount: number
}

export interface ConfirmationGapItem {
  userId: number
  employeeName: string
  employeeNo: string
  boardId: BoardId
  boardName: string
  missingEmployeeConfirmation: boolean
  missingManagerConfirmation: boolean
  archivedStatus: 'draft' | 'ready' | 'archived'
}

export interface BoardResponsibilityConfig {
  boardId: BoardId
  boardName: string
  leaderUserId?: number
  leaderName: string
  managerUserId?: number
  managerName: string
  officeCoordinatorUserId?: number
  officeCoordinatorName: string
}

export interface ManagedTaskDeadlinePolicy {
  requireDeadlineAt: boolean
  overdueLocked: boolean
  message: string
}

export interface TemplateUpdatePayload {
  title?: string
  standard?: string
  enabled?: boolean
  sortOrder?: number
  score?: number
  deductScore?: number
  requireEvidence?: boolean
}
export interface AssessmentBootstrapPayload {
  user: EmployeeProfile & { userId?: number }
  roleCode: SystemRoleCode
  dataScope: 'all' | 'board' | 'self'
  boards: Board[]
  employees: Array<EmployeeProfile & { userId?: number }>
  currentCycle: AssessmentCycle
  assessmentItems: AssessmentItem[]
  tasks: TaskItem[]
  assessmentRecords: Record<string, AssessmentRecordDraft>
  taskRecords: Record<string, TaskRecordDraft>
  rectifications: Array<RectificationItem & { updatedAt?: string; closedAt?: string }>
  reviewTodoItems: AssessmentReviewTodoItem[]
  reviewLogs: AssessmentReviewLog[]
  performanceResults: PerformanceResult[]
  performanceSummary: PerformanceSummary
  riskSummary: RiskSummary
  confirmationSummary: ConfirmationSummary
  confirmationGaps: ConfirmationGapItem[]
  cycleStatusActions: CycleStatusAction[]
  myTodoSummary: MyTodoSummary
  myAssessmentGroups: MyAssessmentGroups
  summary: ScoreSummary
}

export interface AssessmentRecordPayload {
  itemId: string
  status: AssessmentStatus
  remark?: string
  rectification?: string
  evidenceText?: string
  targetUserId?: number
}

export interface TaskRecordPayload {
  taskId: string
  status: AssessmentStatus
  remark?: string
  evidenceText?: string
  targetUserId?: number
}

export interface AssessmentAssistPayload {
  targetUser: EmployeeProfile & { userId?: number }
  currentCycle: AssessmentCycle
  assessmentItems: AssessmentItem[]
  tasks: TaskItem[]
  assessmentRecords: Record<string, AssessmentRecordDraft>
  taskRecords: Record<string, TaskRecordDraft>
}

export interface ReviewActionPayload {
  action: 'approve' | 'return'
  comment?: string
}

export interface RectificationClosePayload {
  comment?: string
}

export interface AssessmentExportPayload extends AssessmentBootstrapPayload {
  generatedAt: string
  hospitalName: string
  title: string
  signatureRows: string[]
}
