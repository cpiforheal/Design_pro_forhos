import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  closeAssessmentRectification,
  confirmPerformance,
  createManagedBoardTask,
  deleteTaskEvidence,
  downloadTaskEvidence,
  exportAssessmentResult,
  fetchAssessmentBootstrap,
  fetchManagedBoardTasks,
  fetchPerformanceResults,
  fetchReviewLogs,
  managerConfirmPerformance,
  publishManagedBoardTask,
  reviewGroupConfirmPerformance,
  reviewAssessmentRecord,
  saveAssessmentRecord,
  saveTaskRecord,
  submitCurrentAssessment,
  uploadTaskEvidence,
  updateAssessmentRectification,
  updateManagedBoardTask
} from '@/api/assessment'
import {
  fetchAssessmentCycles,
  fetchAssessmentTemplates,
  fetchBoardResponsibilityConfig,
  updateAssessmentCycle,
  updateAssessmentCycleStatus,
  updateAssessmentTemplate,
  updateBoardResponsibilityConfig
} from '@/api/assessment-admin'
import type {
  AssessmentBootstrapPayload,
  AssessmentCyclePayload,
  AssessmentItem,
  AssessmentRecordDraft,
  AssessmentStatus,
  Board,
  BoardId,
  EmployeeProfile,
  ManagerTaskPayload,
  TaskItem,
  TaskRecordDraft,
  AssessmentCycle,
  AssessmentTemplateItem,
  TemplateUpdatePayload,
  AssessmentReviewLog,
  PerformanceResult,
  ReviewGroupConfirmPayload,
  BoardResponsibilityConfig,
  RectificationUpdatePayload
} from '@/types/assessment'
import {
  buildEmployeeAssessmentSnapshot,
  buildEmployeeTodoItems,
  getCycleStatusLabel,
  getWorkflowStatusLabel
} from '@/utils/assessment/workflow'
import { calculateScoreSummary, formatRate, getStatusLabel } from '@/utils/assessment/scoring'

const loading = ref(false)
const bootstrap = ref<AssessmentBootstrapPayload | null>(null)
const selectedBoardId = ref<BoardId>('medical')
const redlineTriggered = ref(false)
const cycleList = ref<AssessmentCycle[]>([])
const templateList = ref<AssessmentTemplateItem[]>([])
const reviewLogList = ref<AssessmentReviewLog[]>([])
const managedBoardTaskList = ref<TaskItem[]>([])
const performanceResultList = ref<PerformanceResult[]>([])
const boardResponsibilityList = ref<BoardResponsibilityConfig[]>([])
let loadPromise: Promise<void> | null = null

const fallbackBoard: Board = {
  id: 'medical',
  name: '医疗中心板块',
  owner: '院长 / 医疗中心分管负责人',
  description: '围绕诊疗质量、医疗安全与病历规范的专项考核',
  color: '#0f766e'
}

export function useAssessmentPlatform() {
  void ensureLoaded()

  const boards = computed(() => bootstrap.value?.boards ?? [])
  const visibleBoards = boards
  const nonAllStaffBoards = computed(() => boards.value.filter((board) => board.id !== 'allStaff'))
  const currentAssessmentCycle = computed(
    () =>
      bootstrap.value?.currentCycle ?? {
        id: '',
        name: '加载中',
        type: 'weekly' as const,
        startDate: '',
        endDate: '',
        submitDeadline: '',
        reviewDeadline: '',
        status: 'notStarted' as const,
        description: ''
      }
  )
  const currentEmployee = computed(() => bootstrap.value?.user ?? emptyEmployee())
  const hospitalEmployees = computed(() => bootstrap.value?.employees ?? [])
  const currentBoard = computed(
    () =>
      boards.value.find((board) => board.id === selectedBoardId.value) ??
      nonAllStaffBoards.value[0] ??
      boards.value[0] ??
      fallbackBoard
  )
  const assessmentItems = computed(() => bootstrap.value?.assessmentItems ?? [])
  const commonAssessmentItems = computed(() =>
    assessmentItems.value.filter((item) => item.category === '全员通用')
  )
  const boardAssessmentItems = computed(() =>
    assessmentItems.value.filter((item) => item.category === '板块专项')
  )
  const currentBoardItems = computed(() =>
    boardAssessmentItems.value.filter((item) => item.boardId === selectedBoardId.value)
  )
  const tasks = computed(() => bootstrap.value?.tasks ?? [])
  const hospitalWeeklyTasks = computed(() =>
    tasks.value.filter((task) => task.source === '医院安排')
  )
  const currentBoardTasks = computed(() =>
    tasks.value.filter(
      (task) => task.source === '分管负责人安排' && task.boardId === selectedBoardId.value
    )
  )
  const currentTasks = computed(() => [...hospitalWeeklyTasks.value, ...currentBoardTasks.value])
  const allCurrentItems = computed(() => [
    ...commonAssessmentItems.value,
    ...currentBoardItems.value
  ])
  const commonDrafts = computed(() =>
    buildAssessmentDraftMap(commonAssessmentItems.value, bootstrap.value?.assessmentRecords ?? {})
  )
  const boardDrafts = computed(() =>
    buildAssessmentDraftMap(boardAssessmentItems.value, bootstrap.value?.assessmentRecords ?? {})
  )
  const hospitalTaskDrafts = computed(() =>
    buildTaskDraftMap(hospitalWeeklyTasks.value, bootstrap.value?.taskRecords ?? {})
  )
  const boardTaskDrafts = computed(() =>
    buildTaskDraftMap(
      tasks.value.filter((task) => task.source === '分管负责人安排'),
      bootstrap.value?.taskRecords ?? {}
    )
  )
  const rectificationItems = computed(() => bootstrap.value?.rectifications ?? [])
  const reviewTodoItems = computed(() => bootstrap.value?.reviewTodoItems ?? [])
  const medicalRecordReviewTodoItems = computed(
    () => bootstrap.value?.medicalRecordReviewTodoItems ?? []
  )
  const reviewLogs = computed(() =>
    reviewLogList.value.length ? reviewLogList.value : (bootstrap.value?.reviewLogs ?? [])
  )
  const performanceResults = computed(() =>
    performanceResultList.value.length
      ? performanceResultList.value
      : (bootstrap.value?.performanceResults ?? [])
  )
  const myPerformanceResult = computed(() =>
    performanceResults.value.find(
      (item) =>
        item.userId === (currentEmployee.value as EmployeeProfile & { userId?: number }).userId
    )
  )
  const performanceSummary = computed(
    () =>
      bootstrap.value?.performanceSummary ?? {
        totalEmployees: 0,
        averageScore: 0,
        averageCompletionRate: 0,
        readyToArchiveCount: 0,
        archivedCount: 0,
        boardSummaries: []
      }
  )
  const riskSummary = computed(
    () =>
      bootstrap.value?.riskSummary ?? {
        overdueTaskCount: 0,
        unconfirmedEmployeeCount: 0,
        openRectificationCount: 0,
        redlineCount: 0,
        lowScoreEmployees: []
      }
  )
  const confirmationSummary = computed(
    () =>
      bootstrap.value?.confirmationSummary ?? {
        totalEmployees: 0,
        employeeConfirmedCount: 0,
        managerConfirmedCount: 0,
        reviewGroupConfirmedCount: 0,
        readyToArchiveCount: 0,
        unconfirmedCount: 0
      }
  )
  const confirmationGaps = computed(() => bootstrap.value?.confirmationGaps ?? [])
  const cycleStatusActions = computed(() => bootstrap.value?.cycleStatusActions ?? [])
  const myTodoSummary = computed(
    () =>
      bootstrap.value?.myTodoSummary ?? {
        pending: 0,
        reviewing: 0,
        returned: 0,
        rectifying: 0,
        completed: 0
      }
  )
  const myAssessmentGroups = computed(
    () =>
      bootstrap.value?.myAssessmentGroups ?? {
        pending: [],
        reviewing: [],
        returned: [],
        rectifying: [],
        completed: []
      }
  )
  const myPendingItems = computed(() => myAssessmentGroups.value.pending)
  const myReturnedItems = computed(() => myAssessmentGroups.value.returned)
  const myRectifyingItems = computed(() => myAssessmentGroups.value.rectifying)
  const myCompletedItems = computed(() => myAssessmentGroups.value.completed)
  const summary = computed(
    () =>
      bootstrap.value?.summary ??
      calculateScoreSummary(
        allCurrentItems.value,
        { ...commonDrafts.value, ...boardDrafts.value },
        redlineTriggered.value
      )
  )
  const cycleStatusText = computed(() => getCycleStatusLabel(currentAssessmentCycle.value.status))
  const permissionSummary = computed(() => {
    if (!bootstrap.value) return '正在读取账号权限'
    if (bootstrap.value.dataScope === 'all') return '可查看全院数据'
    if (bootstrap.value.dataScope === 'board')
      return `仅可查看 ${currentEmployee.value.position || currentBoard.value.name} 相关数据`
    return '仅可处理本人考核与整改'
  })
  const categoryStats = computed(() => [
    {
      label: '全员通用',
      count: commonAssessmentItems.value.length,
      done: countDone(
        commonAssessmentItems.value.map((item) => item.id),
        commonDrafts.value
      )
    },
    {
      label: '板块专项',
      count: currentBoardItems.value.length,
      done: countDone(
        currentBoardItems.value.map((item) => item.id),
        boardDrafts.value
      )
    },
    {
      label: '本周任务',
      count: currentTasks.value.length,
      done: countDone(
        currentTasks.value.map((item) => item.id),
        { ...hospitalTaskDrafts.value, ...boardTaskDrafts.value }
      )
    },
    {
      label: '整改台账',
      count: rectificationItems.value.length,
      done: rectificationItems.value.filter((item) => item.status === '已销号').length
    }
  ])
  const boardScoreBars = computed(() =>
    nonAllStaffBoards.value.map((board) => {
      const items = boardAssessmentItems.value.filter((item) => item.boardId === board.id)
      const score = calculateScoreSummary(items, boardDrafts.value, false)
      return { ...board, rate: score.completionRate, label: formatRate(score.completionRate) }
    })
  )
  const employeeTodoItems = computed(() =>
    buildEmployeeTodoItems({
      commonItems: commonAssessmentItems.value,
      boardItems: currentBoardItems.value,
      tasks: currentTasks.value,
      commonDrafts: commonDrafts.value,
      boardDrafts: boardDrafts.value,
      hospitalTaskDrafts: hospitalTaskDrafts.value,
      boardTaskDrafts: boardTaskDrafts.value,
      boards: boards.value,
      employee: currentEmployee.value,
      cycle: currentAssessmentCycle.value
    })
  )
  const employeeAssessmentSnapshot = computed(() =>
    buildEmployeeAssessmentSnapshot({
      employee: currentEmployee.value,
      cycle: currentAssessmentCycle.value,
      todoItems: employeeTodoItems.value,
      rectificationItems: rectificationItems.value,
      summary: summary.value
    })
  )

  async function loadBootstrap() {
    loading.value = true
    try {
      bootstrap.value = await fetchAssessmentBootstrap()
      const preferredBoard = bootstrap.value.user.boardId as BoardId
      const visibleIds = bootstrap.value.boards.map((board) => board.id)
      selectedBoardId.value = (
        visibleIds.includes(preferredBoard)
          ? preferredBoard
          : (visibleIds.find((id) => id !== 'allStaff') ?? visibleIds[0] ?? 'medical')
      ) as BoardId
    } finally {
      loading.value = false
    }
  }

  async function persistAssessment(itemId: string, scope: 'common' | 'board') {
    const draft = scope === 'common' ? commonDrafts.value[itemId] : boardDrafts.value[itemId]
    bootstrap.value = await saveAssessmentRecord({
      itemId,
      status: draft?.status ?? 'completed',
      remark: draft?.remark ?? '',
      rectification: draft?.rectification ?? ''
    })
  }

  async function toggleAssessment(itemId: string, scope: 'common' | 'board') {
    const drafts = scope === 'common' ? commonDrafts.value : boardDrafts.value
    const current = drafts[itemId] ?? createDefaultAssessmentDraft()
    await saveAndApply(() =>
      saveAssessmentRecord({
        itemId,
        status: nextStatus(current.status),
        remark: current.remark,
        rectification: current.rectification
      })
    )
  }

  async function toggleTask(taskId: string, scope: 'hospital' | 'board') {
    const drafts = scope === 'hospital' ? hospitalTaskDrafts.value : boardTaskDrafts.value
    const current = drafts[taskId] ?? createDefaultTaskDraft()
    await saveAndApply(() =>
      saveTaskRecord({
        taskId,
        status: nextTaskStatus(current.status),
        remark: current.remark,
        evidenceText: current.evidenceText
      })
    )
  }

  async function persistTask(taskId: string, scope: 'hospital' | 'board') {
    const draft =
      scope === 'hospital' ? hospitalTaskDrafts.value[taskId] : boardTaskDrafts.value[taskId]
    bootstrap.value = await saveTaskRecord({
      taskId,
      status: draft?.status ?? 'pending',
      remark: draft?.remark ?? '',
      evidenceText: draft?.evidenceText ?? ''
    })
  }

  async function uploadTaskAttachment(taskId: string, file: File) {
    await saveAndApply(() => uploadTaskEvidence(taskId, file))
  }

  async function removeTaskAttachment(attachmentId: string | number) {
    await saveAndApply(() => deleteTaskEvidence(attachmentId))
  }

  async function downloadTaskAttachment(attachmentId: string | number, fileName: string) {
    await downloadTaskEvidence(attachmentId, fileName)
  }

  function updateAssessmentDraftField(
    itemId: string,
    scope: 'common' | 'board',
    field: 'rectification' | 'remark',
    value: string
  ) {
    const draft = scope === 'common' ? commonDrafts.value[itemId] : boardDrafts.value[itemId]
    if (draft) draft[field] = value
  }

  function updateTaskDraftField(
    taskId: string,
    scope: 'hospital' | 'board',
    field: 'remark' | 'evidenceText',
    value: string
  ) {
    const draft =
      scope === 'hospital' ? hospitalTaskDrafts.value[taskId] : boardTaskDrafts.value[taskId]
    if (draft) draft[field] = value
  }

  async function submitCurrentCycle() {
    await saveAndApply(submitCurrentAssessment)
  }

  async function approveReview(recordType: 'assessment' | 'task', recordId: number) {
    await saveAndApply(() =>
      reviewAssessmentRecord(recordType, recordId, { action: 'approve', comment: '审核通过' })
    )
  }

  async function returnReview(recordType: 'assessment' | 'task', recordId: number) {
    await saveAndApply(() =>
      reviewAssessmentRecord(recordType, recordId, {
        action: 'return',
        comment: '资料不完整，请补充后重新提交。'
      })
    )
  }

  async function closeRectification(id: string | number) {
    await saveAndApply(() => closeAssessmentRectification(id, { comment: '整改已销号' }))
  }
  async function updateRectification(id: string | number, payload: RectificationUpdatePayload) {
    await saveAndApply(() => updateAssessmentRectification(id, payload))
  }

  async function reloadAdminConfig() {
    cycleList.value = await fetchAssessmentCycles()
    templateList.value = await fetchAssessmentTemplates()
  }

  async function updateTemplate(itemId: string, payload: TemplateUpdatePayload) {
    await updateAssessmentTemplate(itemId, payload)
    templateList.value = await fetchAssessmentTemplates()
    await loadBootstrap()
  }

  async function updateCycle(cycleId: string, payload: Partial<AssessmentCyclePayload>) {
    cycleList.value = await updateAssessmentCycle(cycleId, payload)
    await loadBootstrap()
  }

  async function updateCycleStatus(cycleId: string, status: string) {
    cycleList.value = await updateAssessmentCycleStatus(cycleId, status)
    await loadBootstrap()
  }

  async function reloadReviewLogs() {
    reviewLogList.value = await fetchReviewLogs()
  }

  async function reloadPerformanceResults() {
    performanceResultList.value = await fetchPerformanceResults()
  }

  async function confirmMyPerformance() {
    await saveAndApply(() => confirmPerformance('员工电子确认本周期绩效结果'))
    performanceResultList.value = bootstrap.value?.performanceResults ?? []
  }

  async function managerConfirmPerformanceResult(userId: number) {
    await saveAndApply(() => managerConfirmPerformance(userId, '负责人电子确认本周期绩效结果'))
    performanceResultList.value = bootstrap.value?.performanceResults ?? []
  }
  async function reviewGroupConfirmPerformanceResult(
    userId: number,
    payload: ReviewGroupConfirmPayload | string = '考核小组复核本周期绩效结果'
  ) {
    await saveAndApply(() => reviewGroupConfirmPerformance(userId, payload))
    performanceResultList.value = bootstrap.value?.performanceResults ?? []
  }

  async function reloadBoardResponsibilityConfig() {
    boardResponsibilityList.value = await fetchBoardResponsibilityConfig()
  }

  async function updateBoardResponsibility(
    boardId: string,
    payload: Partial<BoardResponsibilityConfig>
  ) {
    boardResponsibilityList.value = await updateBoardResponsibilityConfig(boardId, payload)
    await loadBootstrap()
  }

  async function reloadManagedBoardTasks() {
    managedBoardTaskList.value = await fetchManagedBoardTasks()
  }

  async function createManagerTask(payload: ManagerTaskPayload) {
    managedBoardTaskList.value = await createManagedBoardTask(payload)
    await loadBootstrap()
  }

  async function updateManagerTask(id: string, payload: ManagerTaskPayload) {
    managedBoardTaskList.value = await updateManagedBoardTask(id, payload)
    await loadBootstrap()
  }

  async function publishManagerTask(id: string) {
    managedBoardTaskList.value = await publishManagedBoardTask(id)
    await loadBootstrap()
  }

  async function exportCurrentResult() {
    const payload = await exportAssessmentResult()
    const rows = buildExportRows(payload)
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '周二考核')
    XLSX.writeFile(workbook, `周二考核-${payload.currentCycle.name || Date.now()}.xlsx`)
  }

  function setEmployeeBoard() {}
  function setRole() {}
  function setCurrentEmployee() {}
  async function resetDemoData() {
    await loadBootstrap()
  }

  return {
    loading,
    roles: computed(() => []),
    boards,
    hospitalEmployees,
    assessmentAdminConfig: computed(() => ({
      allowEmployeeSelfSubmit: true,
      requireEvidenceForPending: true,
      requireReviewBeforeClose: true,
      elderlyFriendlyMode: true,
      defaultReviewerName: '板块负责人'
    })),
    currentAssessmentCycle,
    commonAssessmentItems,
    boardAssessmentItems,
    hospitalWeeklyTasks,
    boardWeeklyTasks: computed(() => ({})),
    selectedRoleId: computed(() => currentEmployee.value.roleId),
    employeeBoardId: computed(() => currentEmployee.value.boardId),
    selectedBoardId,
    assignee: computed(() => currentEmployee.value.name),
    currentEmployeeId: computed(() => currentEmployee.value.id),
    redlineTriggered,
    commonDrafts,
    boardDrafts,
    hospitalTaskDrafts,
    boardTaskDrafts,
    selectedRole: computed(() => ({
      id: currentEmployee.value.roleId,
      name: currentEmployee.value.position || '当前账号'
    })),
    currentEmployee,
    visibleBoards,
    nonAllStaffBoards,
    permissionSummary,
    currentBoard,
    currentBoardItems,
    currentBoardTasks,
    currentTasks,
    allCurrentItems,
    summary,
    rectificationItems,
    categoryStats,
    boardScoreBars,
    employeeTodoItems,
    reviewTodoItems,
    medicalRecordReviewTodoItems,
    reviewLogs,
    performanceResults,
    myPerformanceResult,
    performanceSummary,
    riskSummary,
    confirmationSummary,
    confirmationGaps,
    cycleStatusActions,
    cycleList,
    templateList,
    managedBoardTaskList,
    boardResponsibilityList,
    myTodoSummary,
    myAssessmentGroups,
    myPendingItems,
    myReturnedItems,
    myRectifyingItems,
    myCompletedItems,
    employeeAssessmentSnapshot,
    cycleStatusText,
    loadBootstrap,
    setRole,
    setEmployeeBoard,
    toggleAssessment,
    toggleTask,
    persistAssessment,
    persistTask,
    uploadTaskAttachment,
    removeTaskAttachment,
    downloadTaskAttachment,
    updateAssessmentDraftField,
    updateTaskDraftField,
    submitAssessment: persistAssessment,
    approveAssessment: persistAssessment,
    returnAssessment: persistAssessment,
    closeAssessment: persistAssessment,
    submitCurrentCycle,
    approveReview,
    returnReview,
    updateRectification,
    closeRectification,
    reloadAdminConfig,
    updateTemplate,
    updateCycle,
    updateCycleStatus,
    reloadReviewLogs,
    reloadPerformanceResults,
    confirmMyPerformance,
    reviewGroupConfirmPerformanceResult,
    managerConfirmPerformanceResult,
    reloadBoardResponsibilityConfig,
    updateBoardResponsibility,
    reloadManagedBoardTasks,
    createManagerTask,
    updateManagerTask,
    publishManagerTask,
    setCurrentEmployee,
    resetDemoData,
    exportCurrentResult,
    getStatusLabel,
    getWorkflowStatusLabel,
    formatRate
  }
}

async function ensureLoaded() {
  if (bootstrap.value || loadPromise) return loadPromise
  loadPromise = fetchAssessmentBootstrap()
    .then((payload) => {
      bootstrap.value = payload
      const preferredBoard = payload.user.boardId as BoardId
      const visibleIds = payload.boards.map((board) => board.id)
      selectedBoardId.value = (
        visibleIds.includes(preferredBoard)
          ? preferredBoard
          : (visibleIds.find((id) => id !== 'allStaff') ?? visibleIds[0] ?? 'medical')
      ) as BoardId
    })
    .finally(() => {
      loadPromise = null
    })
  return loadPromise
}

async function saveAndApply(action: () => Promise<AssessmentBootstrapPayload>) {
  loading.value = true
  try {
    bootstrap.value = await action()
  } finally {
    loading.value = false
  }
}

function buildAssessmentDraftMap(
  items: AssessmentItem[],
  records: Record<string, AssessmentRecordDraft>
) {
  return Object.fromEntries(
    items.map((item) => [item.id, records[item.id] ?? createDefaultAssessmentDraft()])
  )
}

function buildTaskDraftMap(items: TaskItem[], records: Record<string, TaskRecordDraft>) {
  return Object.fromEntries(
    items.map((item) => [item.id, records[item.id] ?? createDefaultTaskDraft()])
  )
}

function createDefaultAssessmentDraft(): AssessmentRecordDraft {
  return { status: 'completed', remark: '', rectification: '', workflowStatus: 'draft' }
}

function createDefaultTaskDraft(): TaskRecordDraft {
  return {
    status: 'pending',
    remark: '',
    evidenceText: '',
    workflowStatus: 'draft',
    attachments: []
  }
}

function nextStatus(status: AssessmentStatus): AssessmentStatus {
  if (status === 'completed') return 'pending'
  if (status === 'pending') return 'na'
  return 'completed'
}

function nextTaskStatus(status: AssessmentStatus): AssessmentStatus {
  return status === 'completed' ? 'pending' : 'completed'
}

function countDone(ids: string[], drafts: Record<string, { status: string }>) {
  return ids.filter((id) => drafts[id]?.status === 'completed').length
}

function emptyEmployee(): EmployeeProfile {
  return {
    id: '',
    name: '当前账号',
    employeeNo: '',
    boardId: 'medical',
    roleId: 'employee',
    systemRole: 'R_EMPLOYEE',
    position: '',
    status: 'active'
  }
}

function buildExportRows(payload: any) {
  const rows: Array<Record<string, string | number>> = [
    { 类型: '基础信息', 项目: '医院', 内容: payload.hospitalName },
    { 类型: '基础信息', 项目: '周期', 内容: payload.currentCycle.name },
    { 类型: '基础信息', 项目: '员工', 内容: payload.user.name },
    { 类型: '基础信息', 项目: '最终得分', 内容: payload.summary.finalScore }
  ]
  payload.assessmentItems.forEach((item: AssessmentItem) => {
    const draft = payload.assessmentRecords[item.id] ?? createDefaultAssessmentDraft()
    rows.push({
      类型: item.category,
      项目: item.moduleName,
      内容: item.title,
      状态: getStatusLabel(draft.status),
      备注: draft.remark,
      整改措施: draft.rectification
    })
  })
  payload.tasks.forEach((task: TaskItem) => {
    const draft = payload.taskRecords[task.id] ?? createDefaultTaskDraft()
    rows.push({
      类型: '本周任务',
      项目: task.source,
      内容: task.title,
      状态: getStatusLabel(draft.status),
      备注: draft.remark
    })
  })
  payload.rectifications.forEach((item: any) =>
    rows.push({
      类型: '整改闭环',
      项目: item.boardName,
      内容: item.description,
      状态: item.status,
      整改措施: item.rectification,
      责任人: item.owner
    })
  )
  payload.signatureRows.forEach((item: string) =>
    rows.push({ 类型: '签字确认', 项目: item, 内容: '' })
  )
  return rows
}
