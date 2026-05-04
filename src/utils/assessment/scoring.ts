import type {
  AssessmentItem,
  EvaluationDraft,
  RectificationItem,
  ScoreSummary,
  TaskDraft,
  TaskItem
} from '@/types/assessment'

const REDLINE_PENALTY = 12

export function createDefaultEvaluationDraft(): EvaluationDraft {
  return {
    status: 'completed',
    remark: '',
    rectification: ''
  }
}

export function createDefaultTaskDraft(): TaskDraft {
  return {
    status: 'pending',
    remark: ''
  }
}

export function calculateScoreSummary(
  items: AssessmentItem[],
  drafts: Record<string, EvaluationDraft>,
  redlineTriggered: boolean
): ScoreSummary {
  const applicableItems = items.filter((item) => drafts[item.id]?.status !== 'na')
  const completedCount = applicableItems.filter(
    (item) => drafts[item.id]?.status === 'completed'
  ).length
  const pendingCount = applicableItems.filter(
    (item) => drafts[item.id]?.status === 'pending'
  ).length
  const totalApplicable = applicableItems.length
  const completionRate = totalApplicable === 0 ? 0 : completedCount / totalApplicable
  const dailyScore = completedCount
  const redlinePenalty = redlineTriggered ? REDLINE_PENALTY : 0
  const finalScore = dailyScore - redlinePenalty

  return {
    totalApplicable,
    completedCount,
    pendingCount,
    completionRate,
    dailyScore,
    redlinePenalty,
    finalScore
  }
}

export function buildRectificationItems(
  items: AssessmentItem[],
  drafts: Record<string, EvaluationDraft>,
  assignee: string,
  boardNameMap: Record<string, string>
): RectificationItem[] {
  return items
    .filter((item) => drafts[item.id]?.status === 'pending')
    .map((item) => ({
      id: `rect-${item.id}`,
      source: item.category,
      boardName: boardNameMap[item.boardId] ?? item.moduleName,
      description: item.title,
      owner: assignee,
      rectification: drafts[item.id]?.rectification || '待补充整改措施',
      status: drafts[item.id]?.rectification ? '整改中' : '待整改'
    }))
}

export function buildTaskDraftMap(tasks: TaskItem[]): Record<string, TaskDraft> {
  return tasks.reduce<Record<string, TaskDraft>>((accumulator, task) => {
    accumulator[task.id] = createDefaultTaskDraft()
    return accumulator
  }, {})
}

export function buildEvaluationDraftMap(items: AssessmentItem[]): Record<string, EvaluationDraft> {
  return items.reduce<Record<string, EvaluationDraft>>((accumulator, item) => {
    accumulator[item.id] = createDefaultEvaluationDraft()
    return accumulator
  }, {})
}

export function getStatusLabel(status: EvaluationDraft['status'] | TaskDraft['status']): string {
  if (status === 'completed') {
    return '完成'
  }

  if (status === 'pending') {
    return '未完成'
  }

  return '不适用'
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}
