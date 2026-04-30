import type {
  AssessmentAdminConfig,
  AssessmentCycle,
  AssessmentItem,
  AssessmentTodoItem,
  Board,
  EmployeeAssessmentSnapshot,
  EmployeeProfile,
  EvaluationDraft,
  RectificationItem,
  ScoreSummary,
  TaskDraft,
  TaskItem,
  TodoPriority,
  WorkflowStatus
} from '@/types/assessment'

const REVIEWABLE_STATUSES: WorkflowStatus[] = ['submitted', 'returned', 'rectifying']

export function getWorkflowStatusLabel(status: WorkflowStatus): string {
  const statusMap: Record<WorkflowStatus, string> = {
    notStarted: '未开始',
    draft: '待提交',
    submitted: '待审核',
    approved: '已通过',
    returned: '已退回',
    rectifying: '整改中',
    closed: '已销号'
  }

  return statusMap[status]
}

export function getCycleStatusLabel(status: AssessmentCycle['status']): string {
  const statusMap: Record<AssessmentCycle['status'], string> = {
    notStarted: '未开始',
    filling: '填报中',
    reviewing: '审核中',
    completed: '已完成',
    archived: '已归档'
  }

  return statusMap[status]
}

export function resolveDraftWorkflowStatus(draft?: EvaluationDraft | TaskDraft): WorkflowStatus {
  if (draft?.workflowStatus) {
    return draft.workflowStatus
  }

  if (!draft || draft.status === 'na') {
    return 'notStarted'
  }

  if (draft.status === 'completed') {
    return 'approved'
  }

  return draft.remark ? 'draft' : 'notStarted'
}

export function buildEmployeeTodoItems(options: {
  commonItems: AssessmentItem[]
  boardItems: AssessmentItem[]
  tasks: TaskItem[]
  commonDrafts: Record<string, EvaluationDraft>
  boardDrafts: Record<string, EvaluationDraft>
  hospitalTaskDrafts: Record<string, TaskDraft>
  boardTaskDrafts: Record<string, TaskDraft>
  boards: Board[]
  employee: EmployeeProfile
  cycle: AssessmentCycle
}): AssessmentTodoItem[] {
  const boardNameMap = Object.fromEntries(options.boards.map((board) => [board.id, board.name]))

  const assessmentTodos = [...options.commonItems, ...options.boardItems]
    .map((item) => {
      const draft =
        item.category === '全员通用' ? options.commonDrafts[item.id] : options.boardDrafts[item.id]
      const workflowStatus = resolveDraftWorkflowStatus(draft)
      const priority = getTodoPriority(workflowStatus, item.isRedline)

      return {
        id: `todo-${item.id}`,
        title: item.title,
        description: item.standard,
        source: 'assessment' as const,
        boardId: item.boardId,
        boardName: boardNameMap[item.boardId] ?? item.moduleName,
        owner: options.employee.name,
        deadline: options.cycle.submitDeadline,
        priority,
        workflowStatus,
        actionText: getActionText(workflowStatus)
      }
    })
    .filter((todo) => shouldShowEmployeeTodo(todo.workflowStatus))

  const taskTodos = options.tasks
    .map((task) => {
      const draft =
        task.source === '医院安排'
          ? options.hospitalTaskDrafts[task.id]
          : options.boardTaskDrafts[task.id]
      const workflowStatus = resolveDraftWorkflowStatus(draft)

      return {
        id: `todo-${task.id}`,
        title: task.title,
        description: `${task.source} · ${task.owner}`,
        source: 'task' as const,
        boardId: task.boardId,
        boardName: boardNameMap[task.boardId] ?? '本周任务',
        owner: options.employee.name,
        deadline: task.deadline,
        priority: getTodoPriority(workflowStatus, false),
        workflowStatus,
        actionText: getActionText(workflowStatus)
      }
    })
    .filter((todo) => shouldShowEmployeeTodo(todo.workflowStatus))

  return [...assessmentTodos, ...taskTodos].sort(
    (left, right) => getPriorityWeight(right.priority) - getPriorityWeight(left.priority)
  )
}

export function buildReviewTodoItems(options: {
  todoItems: AssessmentTodoItem[]
  reviewerName: string
}): AssessmentTodoItem[] {
  return options.todoItems
    .filter((item) => REVIEWABLE_STATUSES.includes(item.workflowStatus))
    .map((item) => ({
      ...item,
      id: `review-${item.id}`,
      source: 'review',
      owner: options.reviewerName,
      actionText: item.workflowStatus === 'submitted' ? '立即审核' : '跟进整改'
    }))
}

export function buildEmployeeAssessmentSnapshot(options: {
  employee: EmployeeProfile
  cycle: AssessmentCycle
  todoItems: AssessmentTodoItem[]
  rectificationItems: RectificationItem[]
  summary: ScoreSummary
}): EmployeeAssessmentSnapshot {
  return {
    employee: options.employee,
    cycle: options.cycle,
    todoCount: options.todoItems.length,
    urgentTodoCount: options.todoItems.filter((item) => item.priority === 'urgent').length,
    completionRate: options.summary.completionRate,
    finalScore: options.summary.finalScore,
    hasReturnedItems: options.todoItems.some((item) => item.workflowStatus === 'returned'),
    hasRectificationItems: options.rectificationItems.length > 0
  }
}

export function submitEvaluationDraft(
  draft: EvaluationDraft,
  operator: string,
  config: AssessmentAdminConfig,
  now = new Date().toISOString()
): EvaluationDraft {
  return {
    ...draft,
    workflowStatus: 'submitted',
    submittedAt: now,
    reviewComment: '',
    reviewRecords: [
      ...(draft.reviewRecords ?? []),
      {
        id: `record-${Date.now()}`,
        operator,
        action: 'submitted',
        comment:
          config.requireEvidenceForPending && draft.status === 'pending'
            ? '已提交，待补充或核验整改证明。'
            : '已提交，等待负责人审核。',
        operatedAt: now
      }
    ]
  }
}

export function approveEvaluationDraft(
  draft: EvaluationDraft,
  reviewer: string,
  comment = '审核通过',
  now = new Date().toISOString()
): EvaluationDraft {
  return {
    ...draft,
    workflowStatus: draft.status === 'pending' ? 'rectifying' : 'approved',
    reviewer,
    reviewedAt: now,
    reviewComment: comment,
    reviewRecords: [
      ...(draft.reviewRecords ?? []),
      {
        id: `record-${Date.now()}`,
        operator: reviewer,
        action: draft.status === 'pending' ? 'rectifying' : 'approved',
        comment,
        operatedAt: now
      }
    ]
  }
}

export function returnEvaluationDraft(
  draft: EvaluationDraft,
  reviewer: string,
  comment = '资料不完整，请补充后重新提交。',
  now = new Date().toISOString()
): EvaluationDraft {
  return {
    ...draft,
    workflowStatus: 'returned',
    reviewer,
    reviewedAt: now,
    reviewComment: comment,
    reviewRecords: [
      ...(draft.reviewRecords ?? []),
      {
        id: `record-${Date.now()}`,
        operator: reviewer,
        action: 'returned',
        comment,
        operatedAt: now
      }
    ]
  }
}

export function closeEvaluationDraft(
  draft: EvaluationDraft,
  operator: string,
  comment = '整改已销号',
  now = new Date().toISOString()
): EvaluationDraft {
  return {
    ...draft,
    workflowStatus: 'closed',
    reviewComment: comment,
    reviewRecords: [
      ...(draft.reviewRecords ?? []),
      {
        id: `record-${Date.now()}`,
        operator,
        action: 'closed',
        comment,
        operatedAt: now
      }
    ]
  }
}

export function cloneTaskWorkflowFromAssessment(
  draft: TaskDraft,
  workflowStatus: WorkflowStatus
): TaskDraft {
  return {
    ...draft,
    workflowStatus
  }
}

function shouldShowEmployeeTodo(status: WorkflowStatus): boolean {
  return !['approved', 'closed'].includes(status)
}

function getTodoPriority(status: WorkflowStatus, isRedline?: boolean): TodoPriority {
  if (isRedline || status === 'returned') {
    return 'urgent'
  }

  if (status === 'submitted' || status === 'rectifying') {
    return 'warning'
  }

  return 'normal'
}

function getPriorityWeight(priority: TodoPriority): number {
  const weightMap: Record<TodoPriority, number> = {
    normal: 1,
    warning: 2,
    urgent: 3
  }

  return weightMap[priority]
}

function getActionText(status: WorkflowStatus): string {
  if (status === 'submitted') {
    return '等待审核'
  }

  if (status === 'returned') {
    return '补充后重交'
  }

  if (status === 'rectifying') {
    return '继续整改'
  }

  return '去处理'
}
