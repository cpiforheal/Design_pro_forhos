import fs from 'node:fs'
import path from 'node:path'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import bcrypt from 'bcryptjs'
import {
  assessmentCycles,
  boardAssessmentItems,
  boardWeeklyTasks,
  boards,
  commonAssessmentItems,
  hospitalWeeklyTasks
} from '../src/data/assessmentData'

export interface AccountUser {
  id: number
  username: string
  passwordHash: string
  displayName: string
  employeeNo: string
  email: string
  status: 'active' | 'disabled'
  boardId: string
  position: string
  mobile: string
  elderlyFriendly: boolean
}

export interface AccountPermission {
  roleCode: string
  actionPermissions: string[]
  menuPermissions: string[]
  dataScope: 'all' | 'board' | 'self'
}

export interface AccountUserListItem {
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
  updatedAt: string
}

export interface RoleGrantItem {
  id: number
  roleCode: string
  roleName: string
  description: string
  menuPermissions: string[]
  actionPermissions: string[]
  dataScope: 'all' | 'board' | 'self'
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateRoleGrantPayload {
  roleName?: string
  description?: string
  menuPermissions?: string[]
  actionPermissions?: string[]
  dataScope?: 'all' | 'board' | 'self'
  enabled?: boolean
}

export interface CreateAccountPayload {
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

export interface UpdateAccountProfilePayload {
  displayName?: string
  employeeNo?: string
  email?: string
  status?: 'active' | 'disabled'
  boardId?: string
  position?: string
  mobile?: string
  elderlyFriendly?: boolean
}

export interface SaveAssessmentRecordPayload {
  itemId: string
  status: 'completed' | 'pending' | 'na'
  remark?: string
  rectification?: string
  evidenceText?: string
  targetUserId?: number
}

export interface SaveTaskRecordPayload {
  taskId: string
  status: 'completed' | 'pending' | 'na'
  remark?: string
  evidenceText?: string
  targetUserId?: number
}

export interface TaskEvidenceFilePayload {
  taskId: string
  targetUserId?: number
  originalName: string
  storedName: string
  mimeType: string
  size: number
  filePath: string
}

export interface TaskEvidenceDownload {
  filePath: string
  originalName: string
  mimeType: string
}

export interface TaskEvidenceDeleteResult {
  filePath: string
  bootstrap: Awaited<ReturnType<typeof getAssessmentBootstrap>>
}

export interface ReviewActionPayload {
  action: 'approve' | 'return'
  comment?: string
}

export interface ManagerTaskPayload {
  boardId?: string
  title: string
  deadline: string
  deadlineAt?: string
  taskCategory?: string
  owner: string
  deployerUserId?: number
  acceptorUserId?: number
  acceptanceStatus?: string
  collaborationNote?: string
  enabled?: boolean
  assigneeMode?: 'board' | 'users'
  assigneeUserIds?: number[]
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

export interface AssessmentCyclePayload {
  id?: string
  name: string
  type: string
  startDate: string
  endDate: string
  submitDeadline: string
  reviewDeadline: string
  status?: string
  description?: string
}

export interface CycleStatusPayload {
  status: string
}

const dbDir = path.resolve(process.cwd(), 'server/data')
const dbPath = path.join(dbDir, 'hospital-assessment.sqlite')
let SQL: SqlJsStatic | null = null
let db: Database | null = null

export async function getDatabase(): Promise<Database> {
  if (db) return db
  SQL = await initSqlJs()
  fs.mkdirSync(dbDir, { recursive: true })
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database()
  await migrateAndSeed(db)
  persistDatabase()
  return db
}

export function persistDatabase(): void {
  if (!db) return
  fs.mkdirSync(dbDir, { recursive: true })
  fs.writeFileSync(dbPath, Buffer.from(db.export()))
}

export async function findUserByUsername(username: string): Promise<AccountUser | null> {
  const rows = await queryRows('SELECT * FROM users WHERE username = $username LIMIT 1', {
    $username: username
  })
  return rows[0] ? mapAccountUser(rows[0]) : null
}

export async function findUserById(userId: number): Promise<AccountUser | null> {
  const rows = await queryRows('SELECT * FROM users WHERE id = $userId LIMIT 1', {
    $userId: userId
  })
  return rows[0] ? mapAccountUser(rows[0]) : null
}

export async function listAccountUsers(): Promise<AccountUserListItem[]> {
  const rows = await queryRows(`
    SELECT u.*, r.code AS role_code, r.name AS role_name, b.name AS board_name
    FROM users u
    LEFT JOIN boards b ON b.id = u.board_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ORDER BY u.id ASC
  `)

  return rows.map((row) => ({
    id: Number(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    employeeNo: String(row.employee_no),
    email: String(row.email),
    status: String(row.status) === 'disabled' ? 'disabled' : 'active',
    roleCode: String(row.role_code || 'R_EMPLOYEE'),
    roleName: String(row.role_name || '普通员工'),
    boardId: String(row.board_id || 'medical'),
    boardName: String(row.board_name || ''),
    position: String(row.position || ''),
    mobile: String(row.mobile || ''),
    elderlyFriendly: Number(row.elderly_friendly || 0) === 1,
    updatedAt: String(row.updated_at || '')
  }))
}

export async function createAccountUser(payload: CreateAccountPayload): Promise<void> {
  const database = await getDatabase()
  await ensureRoleAssignable(payload.roleCode)
  await ensureAssignableBoard(payload.boardId || 'medical')
  const passwordHash = await bcrypt.hash(payload.password, 10)
  runPrepared(
    database,
    `
    INSERT INTO users (username, password_hash, display_name, employee_no, email, status, board_id, position, mobile, elderly_friendly)
    VALUES ($username, $passwordHash, $displayName, $employeeNo, $email, 'active', $boardId, $position, $mobile, $elderlyFriendly)
  `,
    {
      $username: payload.username,
      $passwordHash: passwordHash,
      $displayName: payload.displayName,
      $employeeNo: payload.employeeNo,
      $email: payload.email,
      $boardId: payload.boardId || 'medical',
      $position: payload.position || '',
      $mobile: payload.mobile || '',
      $elderlyFriendly: payload.elderlyFriendly === false ? 0 : 1
    }
  )
  runPrepared(
    database,
    `
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id FROM users u, roles r
    WHERE u.username = $username AND r.code = $roleCode
  `,
    { $username: payload.username, $roleCode: payload.roleCode }
  )
  persistDatabase()
}

export async function updateAccountUserRole(userId: number, roleCode: string): Promise<void> {
  const database = await getDatabase()
  await ensureRoleAssignable(roleCode)
  runPrepared(database, 'DELETE FROM user_roles WHERE user_id = $userId', { $userId: userId })
  runPrepared(
    database,
    'INSERT INTO user_roles (user_id, role_id) SELECT $userId, id FROM roles WHERE code = $roleCode',
    { $userId: userId, $roleCode: roleCode }
  )
  persistDatabase()
}

export async function updateAccountUserProfile(
  userId: number,
  payload: UpdateAccountProfilePayload
): Promise<void> {
  const user = await findUserById(userId)
  if (!user) throw new Error('员工账号不存在')
  const boardId = payload.boardId ?? user.boardId
  await ensureAssignableBoard(boardId)
  const status = payload.status ?? user.status
  if (!['active', 'disabled'].includes(status)) throw new Error('账号状态不正确')
  const displayName = (payload.displayName ?? user.displayName).trim()
  const employeeNo = (payload.employeeNo ?? user.employeeNo).trim()
  const email = (payload.email ?? user.email).trim()
  if (!displayName || !employeeNo || !email) throw new Error('姓名、工号和邮箱不能为空')
  await runSql(
    `
    UPDATE users
    SET display_name = $displayName,
        employee_no = $employeeNo,
        email = $email,
        status = $status,
        board_id = $boardId,
        position = $position,
        mobile = $mobile,
        elderly_friendly = $elderlyFriendly,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $userId
  `,
    {
      $userId: userId,
      $displayName: displayName,
      $employeeNo: employeeNo,
      $email: email,
      $status: status,
      $boardId: boardId,
      $position: (payload.position ?? user.position).trim(),
      $mobile: (payload.mobile ?? user.mobile).trim(),
      $elderlyFriendly: (payload.elderlyFriendly ?? user.elderlyFriendly) ? 1 : 0
    }
  )
  persistDatabase()
}

export async function listRoleGrants(): Promise<RoleGrantItem[]> {
  const rows = await queryRows('SELECT * FROM roles ORDER BY id ASC')
  return rows.map(mapRoleGrant)
}

export async function updateRoleGrant(
  roleId: number,
  payload: UpdateRoleGrantPayload
): Promise<RoleGrantItem[]> {
  const current = (
    await queryRows('SELECT * FROM roles WHERE id = $id LIMIT 1', { $id: roleId })
  )[0]
  if (!current) throw new Error('角色不存在')
  if (String(current.code) === 'R_SUPER' && payload.enabled === false) {
    throw new Error('超级管理员角色不能停用')
  }
  await runSql(
    `
    UPDATE roles
    SET name = $name,
        description = $description,
        menu_permissions = $menuPermissions,
        action_permissions = $actionPermissions,
        data_scope = $dataScope,
        enabled = $enabled,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $id
  `,
    {
      $id: roleId,
      $name: payload.roleName ?? String(current.name),
      $description: payload.description ?? String(current.description || ''),
      $menuPermissions: JSON.stringify(
        payload.menuPermissions ?? JSON.parse(String(current.menu_permissions || '[]'))
      ),
      $actionPermissions: JSON.stringify(
        payload.actionPermissions ?? JSON.parse(String(current.action_permissions || '[]'))
      ),
      $dataScope: payload.dataScope ?? String(current.data_scope || 'self'),
      $enabled:
        payload.enabled === undefined ? Number(current.enabled ?? 1) : payload.enabled ? 1 : 0
    }
  )
  persistDatabase()
  return listRoleGrants()
}

export async function getUserPermissions(userId: number): Promise<AccountPermission> {
  const rows = await queryRows(
    `
    SELECT r.code AS role_code, r.action_permissions, r.menu_permissions, r.data_scope
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $userId AND COALESCE(r.enabled, 1) = 1
  `,
    { $userId: userId }
  )

  const roleCodes: string[] = []
  const actionPermissions = new Set<string>()
  const menuPermissions = new Set<string>()
  let dataScope: AccountPermission['dataScope'] = 'self'

  rows.forEach((row) => {
    roleCodes.push(String(row.role_code))
    JSON.parse(String(row.action_permissions || '[]')).forEach((item: string) =>
      actionPermissions.add(item)
    )
    JSON.parse(String(row.menu_permissions || '[]')).forEach((item: string) =>
      menuPermissions.add(item)
    )
    if (row.data_scope === 'all') dataScope = 'all'
    if (row.data_scope === 'board' && dataScope !== 'all') dataScope = 'board'
  })

  return {
    roleCode: roleCodes[0] ?? 'R_EMPLOYEE',
    actionPermissions: [...actionPermissions],
    menuPermissions: [...menuPermissions],
    dataScope
  }
}
export async function getAssessmentBootstrap(userId: number) {
  const actor = await requireActor(userId)
  const visibleBoards = await getVisibleBoardsForActor(actor)
  const visibleBoardIds = visibleBoards.map((board) => String(board.id))
  const currentCycle = await getCurrentCycle()
  const assessmentItems = await getAssessmentItems(visibleBoardIds)
  const tasks = await getTasks(
    visibleBoardIds,
    actor.permissions.dataScope === 'self' ? actor.user.id : undefined
  )
  const assessmentRecords = await getAssessmentRecordMap(currentCycle.id, actor.user.id)
  const taskRecords = await getTaskRecordMap(currentCycle.id, actor.user.id)
  const rectifications = await getRectifications(actor)
  const reviewTodoItems = await getReviewTodoItems(actor)
  const reviewLogs = await getReviewLogsForActor(actor)
  await ensurePerformanceResultsForActor(actor, currentCycle)
  const performanceResults = await getPerformanceResultsForActor(actor, currentCycle.id)
  const confirmationSummary = buildConfirmationSummary(performanceResults)
  const confirmationGaps = buildConfirmationGaps(performanceResults)
  const riskSummary = await buildRiskSummary(actor, currentCycle.id, performanceResults)
  const performanceSummary = buildPerformanceSummary(performanceResults)
  const cycleStatusActions = getCycleStatusActions(actor.permissions.roleCode, currentCycle.status)
  const employees = (await getUsersByIds(await getSubjectUserIds(actor))).map((user) =>
    mapEmployee(user, user.id === actor.user.id ? actor.permissions.roleCode : 'R_EMPLOYEE')
  )
  const myAssessmentGroups = buildMyAssessmentGroups({
    actor,
    visibleBoards,
    assessmentItems,
    tasks,
    assessmentRecords,
    taskRecords,
    rectifications,
    currentCycle
  })
  const myTodoSummary = buildMyTodoSummary(myAssessmentGroups)

  return {
    user: mapEmployee(actor.user, actor.permissions.roleCode),
    roleCode: actor.permissions.roleCode,
    dataScope: actor.permissions.dataScope,
    boards: visibleBoards,
    employees,
    currentCycle,
    assessmentItems,
    tasks,
    assessmentRecords,
    taskRecords,
    rectifications,
    reviewTodoItems,
    reviewLogs,
    performanceResults,
    performanceSummary,
    riskSummary,
    confirmationSummary,
    confirmationGaps,
    cycleStatusActions,
    myTodoSummary,
    myAssessmentGroups,
    summary: calculateSummary([...assessmentItems, ...tasks], {
      ...assessmentRecords,
      ...taskRecords
    })
  }
}

export async function getAssessmentAssist(userId: number, targetUserId: number) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  const target = await findUserById(targetUserId)
  if (!target || target.status !== 'active') throw new Error('员工不存在或已停用')
  ensureCanReviewBoard(actor, target.boardId)
  const currentCycle = await getCurrentCycle()
  const boardIds = ['allStaff', target.boardId]
  const assessmentItems = await getAssessmentItems(boardIds)
  const tasks = await getTasks(boardIds, target.id)
  return {
    targetUser: mapEmployee(target, 'R_EMPLOYEE'),
    currentCycle,
    assessmentItems,
    tasks,
    assessmentRecords: await getAssessmentRecordMap(currentCycle.id, target.id),
    taskRecords: await getTaskRecordMap(currentCycle.id, target.id)
  }
}

export async function saveAssessmentRecord(userId: number, payload: SaveAssessmentRecordPayload) {
  const actor = await requireActor(userId)
  const target = await resolveRecordTarget(actor, payload.targetUserId)
  const cycle = await getCurrentCycle()
  const item = (
    await queryRows('SELECT * FROM assessment_items WHERE id = $id AND enabled = 1 LIMIT 1', {
      $id: payload.itemId
    })
  )[0]
  if (!item) throw new Error('考核项不存在或已停用')
  ensureCanAccessBoard(actor, String(item.board_id))
  await ensureCycleCanBeEditedByEmployee(cycle, target.id)
  const existingRecord = await getAssessmentRecord(cycle.id, target.id, payload.itemId)
  ensureEditableRecordWorkflow(String(existingRecord?.workflow_status || 'draft'), '考核记录')
  const nextWorkflowStatus = resolveEditableWorkflowStatus(
    String(existingRecord?.workflow_status || 'draft')
  )

  await runSql(
    `
    INSERT INTO assessment_records (cycle_id, user_id, item_id, status, remark, rectification, workflow_status, updated_at)
    VALUES ($cycleId, $userId, $itemId, $status, $remark, $rectification, $workflowStatus, CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id, user_id, item_id) DO UPDATE SET
      status = excluded.status,
      remark = excluded.remark,
      rectification = excluded.rectification,
      workflow_status = $workflowStatus,
      updated_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: cycle.id,
      $userId: target.id,
      $itemId: payload.itemId,
      $status: payload.status,
      $remark: payload.remark || '',
      $rectification: payload.rectification || '',
      $workflowStatus: nextWorkflowStatus
    }
  )

  const record = await getAssessmentRecord(cycle.id, target.id, payload.itemId)
  if (record && payload.status === 'pending') {
    await upsertRectification({
      cycleId: cycle.id,
      sourceType: 'assessment',
      sourceRecordId: Number(record.id),
      boardId: String(item.board_id),
      ownerUserId: target.id,
      description: String(item.title),
      rectification: payload.rectification || '待补充整改措施',
      deadline: cycle.submitDeadline,
      evidenceText: payload.evidenceText || ''
    })
  }
  if (record && nextWorkflowStatus === 'rectifying') {
    await reopenRectificationForRectifyingRecord('assessment', Number(record.id))
  }
  if (record && payload.status !== 'pending') {
    await closeDraftRectification('assessment', Number(record.id), nextWorkflowStatus)
  }
  if (target.id !== actor.user.id && record) {
    await insertReviewLog(
      cycle.id,
      'assessment',
      Number(record.id),
      target.id,
      actor.user.id,
      'assist',
      `负责人协助录入：${payload.status}`
    )
  }
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function saveTaskRecord(userId: number, payload: SaveTaskRecordPayload) {
  const actor = await requireActor(userId)
  const target = await resolveRecordTarget(actor, payload.targetUserId)
  const cycle = await getCurrentCycle()
  const task = (
    await queryRows('SELECT * FROM tasks WHERE id = $id AND enabled = 1 LIMIT 1', {
      $id: payload.taskId
    })
  )[0]
  if (!task) throw new Error('任务不存在或已停用')
  ensureCanAccessBoard(actor, String(task.board_id))
  if (!(await canUserSeeTask(String(task.id), target.id))) throw new Error('该任务未分配给当前员工')
  await ensureCycleCanBeEditedByEmployee(cycle, target.id)
  if (isAfterDeadline(task.deadline_at)) {
    await runSql(`UPDATE tasks SET overdue_locked = 1 WHERE id = $id`, { $id: payload.taskId })
    persistDatabase()
    throw new Error('任务已超过截止时间，需负责人延期后才能提交')
  }
  const existingRecord = await getTaskRecord(cycle.id, target.id, payload.taskId)
  ensureEditableRecordWorkflow(String(existingRecord?.workflow_status || 'draft'), '任务记录')
  if (payload.status === 'completed') {
    if (!existingRecord) throw new Error('请先上传至少 1 份佐证材料，再标记任务已完成')
    const attachmentCount = await getTaskEvidenceAttachmentCount(Number(existingRecord.id))
    if (attachmentCount < 1) throw new Error('请先上传至少 1 份佐证材料，再标记任务已完成')
  }
  const nextWorkflowStatus = resolveEditableWorkflowStatus(
    String(existingRecord?.workflow_status || 'draft')
  )

  await runSql(
    `
    INSERT INTO task_records (cycle_id, user_id, task_id, status, remark, evidence_text, workflow_status, updated_at)
    VALUES ($cycleId, $userId, $taskId, $status, $remark, $evidenceText, $workflowStatus, CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id, user_id, task_id) DO UPDATE SET
      status = excluded.status,
      remark = excluded.remark,
      evidence_text = excluded.evidence_text,
      workflow_status = $workflowStatus,
      updated_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: cycle.id,
      $userId: target.id,
      $taskId: payload.taskId,
      $status: payload.status,
      $remark: payload.remark || '',
      $evidenceText: payload.evidenceText || '',
      $workflowStatus: nextWorkflowStatus
    }
  )
  const record = await getTaskRecord(cycle.id, target.id, payload.taskId)
  if (record && payload.status === 'pending') {
    await upsertRectification({
      cycleId: cycle.id,
      sourceType: 'task',
      sourceRecordId: Number(record.id),
      boardId: String(task.board_id),
      ownerUserId: target.id,
      description: String(task.title),
      rectification: payload.remark || '任务未完成，请补充整改说明',
      deadline: String(task.deadline || cycle.submitDeadline),
      evidenceText: ''
    })
  }
  if (record && nextWorkflowStatus === 'rectifying') {
    await reopenRectificationForRectifyingRecord('task', Number(record.id))
  }
  if (record && payload.status !== 'pending') {
    await closeDraftRectification('task', Number(record.id), nextWorkflowStatus)
  }
  if (target.id !== actor.user.id && record) {
    await insertReviewLog(
      cycle.id,
      'task',
      Number(record.id),
      target.id,
      actor.user.id,
      'assist',
      `负责人协助录入：${payload.status}`
    )
  }
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function addTaskEvidenceAttachment(userId: number, payload: TaskEvidenceFilePayload) {
  const { actor, cycle, target, record } = await ensureEditableTaskEvidenceContext(
    userId,
    payload.taskId,
    payload.targetUserId
  )
  await runSql(
    `
    INSERT INTO task_evidence_attachments (
      record_id, original_name, stored_name, mime_type, file_size, file_path, uploaded_by, uploaded_at
    )
    VALUES ($recordId, $originalName, $storedName, $mimeType, $fileSize, $filePath, $uploadedBy, CURRENT_TIMESTAMP)
  `,
    {
      $recordId: Number(record.id),
      $originalName: payload.originalName,
      $storedName: payload.storedName,
      $mimeType: payload.mimeType,
      $fileSize: payload.size,
      $filePath: payload.filePath,
      $uploadedBy: actor.user.id
    }
  )
  await insertReviewLog(
    cycle.id,
    'task',
    Number(record.id),
    target.id,
    actor.user.id,
    'draft',
    `上传佐证材料：${payload.originalName}`
  )
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function deleteTaskEvidenceAttachment(
  userId: number,
  attachmentId: number
): Promise<TaskEvidenceDeleteResult> {
  const actor = await requireActor(userId)
  const row = await getTaskEvidenceAttachmentRow(attachmentId)
  if (!row) throw new Error('佐证材料不存在')
  if (!canSeeUserRow(actor, String(row.board_id), Number(row.user_id)))
    throw new Error('无权访问该佐证材料')
  if (Number(row.user_id) !== actor.user.id) {
    ensureReviewer(actor)
    ensureCanReviewBoard(actor, String(row.board_id))
  }
  await ensureCycleIsWritable(String(row.cycle_id))
  ensureEditableRecordWorkflow(String(row.workflow_status || 'draft'), '任务记录')
  await runSql(`DELETE FROM task_evidence_attachments WHERE id = $id`, { $id: attachmentId })
  await insertReviewLog(
    String(row.cycle_id),
    'task',
    Number(row.record_id),
    Number(row.user_id),
    actor.user.id,
    'draft',
    `删除佐证材料：${String(row.original_name)}`
  )
  persistDatabase()
  return {
    filePath: String(row.file_path || ''),
    bootstrap: await getAssessmentBootstrap(userId)
  }
}

export async function getTaskEvidenceAttachmentForDownload(
  userId: number,
  attachmentId: number
): Promise<TaskEvidenceDownload> {
  const actor = await requireActor(userId)
  const row = await getTaskEvidenceAttachmentRow(attachmentId)
  if (!row) throw new Error('佐证材料不存在')
  if (!canSeeUserRow(actor, String(row.board_id), Number(row.user_id)))
    throw new Error('无权访问该佐证材料')
  return {
    filePath: String(row.file_path || ''),
    originalName: String(row.original_name || '佐证材料'),
    mimeType: String(row.mime_type || 'application/octet-stream')
  }
}

export async function submitAssessment(userId: number) {
  const actor = await requireActor(userId)
  const cycle = await getCurrentCycle()
  await ensureCycleCanBeEditedByEmployee(cycle, actor.user.id)
  const boardIds = (await getVisibleBoardsForActor(actor)).map((board) => String(board.id))
  const items = await getAssessmentItems(boardIds)
  const tasks = await getTasks(boardIds, actor.user.id)

  for (const item of items) {
    if (!(await getAssessmentRecord(cycle.id, actor.user.id, item.id))) {
      await saveAssessmentRecord(userId, { itemId: item.id, status: 'completed' })
    }
  }
  for (const task of tasks) {
    if (!(await getTaskRecord(cycle.id, actor.user.id, task.id))) {
      await saveTaskRecord(userId, { taskId: task.id, status: 'pending' })
    }
  }

  await runSql(
    `UPDATE assessment_records SET workflow_status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE cycle_id = $cycleId AND user_id = $userId AND workflow_status IN ('draft', 'returned')`,
    { $cycleId: cycle.id, $userId: actor.user.id }
  )
  await runSql(
    `UPDATE task_records SET workflow_status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE cycle_id = $cycleId AND user_id = $userId AND workflow_status IN ('draft', 'returned')`,
    { $cycleId: cycle.id, $userId: actor.user.id }
  )
  await insertReviewLog(
    cycle.id,
    'cycle',
    0,
    actor.user.id,
    actor.user.id,
    'submitted',
    '员工提交本周期考核'
  )
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function reviewRecord(
  userId: number,
  recordType: 'assessment' | 'task',
  recordId: number,
  payload: ReviewActionPayload
) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  const table = recordType === 'assessment' ? 'assessment_records' : 'task_records'
  const rows = await queryRows(
    `SELECT r.*, u.board_id FROM ${table} r INNER JOIN users u ON u.id = r.user_id WHERE r.id = $id`,
    { $id: recordId }
  )
  const record = rows[0]
  if (!record) throw new Error('审核记录不存在')
  await ensureCycleIsWritable(String(record.cycle_id))
  ensureCanReviewBoard(actor, String(record.board_id))
  if (String(record.workflow_status) !== 'submitted') {
    throw new Error('只有待审核记录可以执行审核操作')
  }

  const workflowStatus =
    payload.action === 'return'
      ? 'returned'
      : String(record.status) === 'pending'
        ? 'rectifying'
        : 'approved'
  const comment =
    payload.comment || (payload.action === 'return' ? '资料不完整，请补充后重新提交。' : '审核通过')
  await runSql(
    `
    UPDATE ${table}
    SET workflow_status = $workflowStatus, reviewer = $reviewer, reviewed_at = CURRENT_TIMESTAMP, review_comment = $comment, updated_at = CURRENT_TIMESTAMP
    WHERE id = $id
  `,
    {
      $workflowStatus: workflowStatus,
      $reviewer: actor.user.displayName,
      $comment: comment,
      $id: recordId
    }
  )
  await insertReviewLog(
    String(record.cycle_id),
    recordType,
    recordId,
    Number(record.user_id),
    actor.user.id,
    workflowStatus,
    comment
  )
  if (workflowStatus === 'rectifying') {
    await runSql(
      `UPDATE rectifications SET status = '整改中', review_comment = $comment, updated_at = CURRENT_TIMESTAMP WHERE source_type = $recordType AND source_record_id = $recordId`,
      { $recordType: recordType, $recordId: recordId, $comment: comment }
    )
  }
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function closeRectification(
  userId: number,
  rectificationId: number,
  comment = '整改已销号'
) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  const rectification = (
    await queryRows('SELECT * FROM rectifications WHERE id = $id LIMIT 1', { $id: rectificationId })
  )[0]
  if (!rectification) throw new Error('整改记录不存在')
  await ensureCycleIsWritable(String(rectification.cycle_id))
  ensureCanReviewBoard(actor, String(rectification.board_id))
  await runSql(
    `UPDATE rectifications SET status = '已销号', closed_by = $closedBy, closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $id`,
    { $closedBy: actor.user.id, $id: rectificationId }
  )
  if (String(rectification.source_type) === 'assessment') {
    await runSql(
      `UPDATE assessment_records SET workflow_status = 'closed', review_comment = $comment, updated_at = CURRENT_TIMESTAMP WHERE id = $id`,
      { $comment: comment, $id: Number(rectification.source_record_id) }
    )
  }
  if (String(rectification.source_type) === 'task') {
    await runSql(
      `UPDATE task_records SET workflow_status = 'closed', review_comment = $comment, updated_at = CURRENT_TIMESTAMP WHERE id = $id`,
      { $comment: comment, $id: Number(rectification.source_record_id) }
    )
  }
  await insertReviewLog(
    String(rectification.cycle_id),
    'rectification',
    rectificationId,
    Number(rectification.owner_user_id),
    actor.user.id,
    'closed',
    comment
  )
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function getAssessmentExport(userId: number) {
  const payload = await getAssessmentBootstrap(userId)
  return {
    generatedAt: new Date().toISOString(),
    hospitalName: '固始中医肛肠医院',
    title: '每周二全院基本工作综合考核清单',
    ...payload,
    signatureRows: ['员工签字', '分管负责人签字', '综合办公室确认', '院领导确认']
  }
}

export async function listManagedBoardTasks(userId: number) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  return getManagedBoardTasksForActor(actor)
}

export async function createManagedBoardTask(userId: number, payload: ManagerTaskPayload) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  const boardId = payload.boardId || actor.user.boardId
  ensureCanReviewBoard(actor, boardId)
  ensureValidManagerTaskPayload(payload)
  await ensureValidTaskAssignees(actor, boardId, payload)
  const taskId = `manager-${boardId}-${Date.now()}`
  const maxSortRow = (await queryRows('SELECT MAX(sort_order) AS max_sort FROM tasks'))[0]
  await runSql(
    `
    INSERT INTO tasks (id, source, board_id, title, deadline, deadline_at, task_category, deployer_user_id, acceptor_user_id, acceptance_status, overdue_locked, collaboration_note, owner, sort_order, enabled)
    VALUES ($id, '分管负责人安排', $boardId, $title, $deadline, $deadlineAt, $taskCategory, $deployerUserId, $acceptorUserId, $acceptanceStatus, 0, $collaborationNote, $owner, $sortOrder, $enabled)
  `,
    {
      $id: taskId,
      $boardId: boardId,
      $title: payload.title.trim(),
      $deadline: payload.deadline,
      $deadlineAt: normalizeDateTime(payload.deadlineAt || payload.deadline),
      $taskCategory: payload.taskCategory || '分管负责人任务',
      $deployerUserId: payload.deployerUserId || actor.user.id,
      $acceptorUserId: payload.acceptorUserId || null,
      $acceptanceStatus: payload.acceptanceStatus || '待验收',
      $collaborationNote: payload.collaborationNote || '',
      $owner: payload.owner.trim(),
      $sortOrder: Number(maxSortRow?.max_sort || 0) + 1,
      $enabled: payload.enabled ? 1 : 0
    }
  )
  await replaceTaskAssignees(taskId, boardId, actor, payload)
  await insertReviewLog('', 'task', 0, actor.user.id, actor.user.id, 'draft', '负责人创建任务草稿')
  persistDatabase()
  return getManagedBoardTasksForActor(actor)
}

export async function updateManagedBoardTask(
  userId: number,
  taskId: string,
  payload: ManagerTaskPayload
) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  const current = await getManagedTaskRowForActor(actor, taskId)
  const boardId = payload.boardId || String(current.board_id)
  ensureCanReviewBoard(actor, boardId)
  ensureValidManagerTaskPayload(payload)
  await ensureValidTaskAssignees(actor, boardId, payload)
  await runSql(
    `
    UPDATE tasks
    SET board_id = $boardId,
        title = $title,
        deadline = $deadline,
        deadline_at = $deadlineAt,
        task_category = $taskCategory,
        deployer_user_id = $deployerUserId,
        acceptor_user_id = $acceptorUserId,
        acceptance_status = $acceptanceStatus,
        overdue_locked = CASE WHEN $deadlineAt != '' AND datetime($deadlineAt) <= datetime('now') THEN 1 ELSE 0 END,
        collaboration_note = $collaborationNote,
        owner = $owner,
        enabled = $enabled
    WHERE id = $id AND source = '分管负责人安排'
  `,
    {
      $id: taskId,
      $boardId: boardId,
      $title: payload.title.trim(),
      $deadline: payload.deadline,
      $deadlineAt: normalizeDateTime(payload.deadlineAt || payload.deadline),
      $taskCategory: payload.taskCategory || String(current.task_category || '分管负责人任务'),
      $deployerUserId: payload.deployerUserId || Number(current.deployer_user_id || actor.user.id),
      $acceptorUserId: payload.acceptorUserId || Number(current.acceptor_user_id || 0) || null,
      $acceptanceStatus: payload.acceptanceStatus || String(current.acceptance_status || '待验收'),
      $collaborationNote: payload.collaborationNote ?? String(current.collaboration_note || ''),
      $owner: payload.owner.trim(),
      $enabled:
        payload.enabled === undefined ? Number(current.enabled || 0) : payload.enabled ? 1 : 0
    }
  )
  await replaceTaskAssignees(taskId, boardId, actor, payload)
  await insertReviewLog(
    '',
    'task',
    0,
    actor.user.id,
    actor.user.id,
    'updated',
    '负责人更新任务配置'
  )
  persistDatabase()
  return getManagedBoardTasksForActor(actor)
}

export async function publishManagedBoardTask(userId: number, taskId: string) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  await getManagedTaskRowForActor(actor, taskId)
  await runSql(`UPDATE tasks SET enabled = 1 WHERE id = $id AND source = '分管负责人安排'`, {
    $id: taskId
  })
  await insertReviewLog('', 'task', 0, actor.user.id, actor.user.id, 'published', '负责人推送任务')
  persistDatabase()
  return getManagedBoardTasksForActor(actor)
}

export async function listAssessmentTemplates() {
  const rows = await queryRows(`
    SELECT ai.*, b.name AS board_name
    FROM assessment_items ai
    INNER JOIN boards b ON b.id = ai.board_id
    ORDER BY ai.category ASC, ai.board_id ASC, ai.sort_order ASC
  `)
  return rows.map(mapTemplateItem)
}

export async function updateAssessmentTemplate(itemId: string, payload: TemplateUpdatePayload) {
  const current = (
    await queryRows('SELECT * FROM assessment_items WHERE id = $id LIMIT 1', { $id: itemId })
  )[0]
  if (!current) throw new Error('考核模板不存在')
  await runSql(
    `
    UPDATE assessment_items
    SET title = $title, standard = $standard, enabled = $enabled, sort_order = $sortOrder, score = $score, deduct_score = $deductScore, require_evidence = $requireEvidence, updated_at = CURRENT_TIMESTAMP
    WHERE id = $id
  `,
    {
      $title: payload.title ?? String(current.title),
      $standard: payload.standard ?? String(current.standard),
      $enabled: payload.enabled === undefined ? Number(current.enabled) : payload.enabled ? 1 : 0,
      $sortOrder: payload.sortOrder ?? Number(current.sort_order),
      $score: payload.score ?? Number(current.score || 1),
      $deductScore: payload.deductScore ?? Number(current.deduct_score || 1),
      $requireEvidence:
        payload.requireEvidence === undefined
          ? Number(current.require_evidence || 0)
          : payload.requireEvidence
            ? 1
            : 0,
      $id: itemId
    }
  )
  persistDatabase()
}
export async function listAssessmentCycles() {
  const rows = await queryRows('SELECT * FROM assessment_cycles ORDER BY start_date DESC')
  return rows.map(mapCycleItem)
}

export async function createAssessmentCycle(payload: AssessmentCyclePayload) {
  const id = payload.id || `cycle-${Date.now()}`
  await runSql(
    `
    INSERT INTO assessment_cycles (id, name, type, start_date, end_date, submit_deadline, review_deadline, status, description)
    VALUES ($id, $name, $type, $startDate, $endDate, $submitDeadline, $reviewDeadline, $status, $description)
  `,
    {
      $id: id,
      $name: payload.name,
      $type: payload.type,
      $startDate: payload.startDate,
      $endDate: payload.endDate,
      $submitDeadline: payload.submitDeadline,
      $reviewDeadline: payload.reviewDeadline,
      $status: payload.status || 'notStarted',
      $description: payload.description || ''
    }
  )
  persistDatabase()
  return listAssessmentCycles()
}

export async function updateAssessmentCycle(
  cycleId: string,
  payload: Partial<AssessmentCyclePayload>
) {
  await runSql(
    `
    UPDATE assessment_cycles
    SET name = COALESCE($name, name),
        type = COALESCE($type, type),
        start_date = COALESCE($startDate, start_date),
        end_date = COALESCE($endDate, end_date),
        submit_deadline = COALESCE($submitDeadline, submit_deadline),
        review_deadline = COALESCE($reviewDeadline, review_deadline),
        status = COALESCE($status, status),
        description = COALESCE($description, description)
    WHERE id = $id
  `,
    {
      $id: cycleId,
      $name: payload.name ?? null,
      $type: payload.type ?? null,
      $startDate: payload.startDate ?? null,
      $endDate: payload.endDate ?? null,
      $submitDeadline: payload.submitDeadline ?? null,
      $reviewDeadline: payload.reviewDeadline ?? null,
      $status: payload.status ?? null,
      $description: payload.description ?? null
    }
  )
  persistDatabase()
  return listAssessmentCycles()
}

export async function updateAssessmentCycleStatus(cycleId: string, status: string) {
  if (status === 'archived') {
    await generatePerformanceResultsForCycle(cycleId, false)
    await ensureCycleReadyToArchive(cycleId)
  }
  await runSql(
    `
    UPDATE assessment_cycles
    SET status = $status, archived_at = CASE WHEN $status = 'archived' THEN CURRENT_TIMESTAMP ELSE archived_at END
    WHERE id = $id
  `,
    { $status: status, $id: cycleId }
  )
  if (status === 'completed' || status === 'archived') {
    await generatePerformanceResultsForCycle(cycleId, status === 'archived')
  }
  persistDatabase()
  return listAssessmentCycles()
}

export async function getReviewLogs(userId: number) {
  const actor = await requireActor(userId)
  return getReviewLogsForActor(actor)
}

export async function listPerformanceResults(userId: number) {
  const actor = await requireActor(userId)
  const cycle = await getCurrentCycle()
  await ensurePerformanceResultsForActor(actor, cycle)
  return getPerformanceResultsForActor(actor, cycle.id)
}

export async function confirmPerformance(userId: number, comment = '员工电子确认') {
  const actor = await requireActor(userId)
  const cycle = await getCurrentCycle()
  if (cycle.status === 'archived') throw new Error('当前周期已归档，不能重复确认')
  await ensurePerformanceResultForUser(cycle, actor.user)
  await upsertPerformanceConfirmation(cycle.id, actor.user.id, 'employee', actor.user.id, comment)
  await insertReviewLog(
    cycle.id,
    'performance',
    actor.user.id,
    actor.user.id,
    actor.user.id,
    'confirmed',
    comment
  )
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function managerConfirmPerformance(
  userId: number,
  targetUserId: number,
  comment = '负责人电子确认'
) {
  const actor = await requireActor(userId)
  ensureReviewer(actor)
  const cycle = await getCurrentCycle()
  if (cycle.status === 'archived') throw new Error('当前周期已归档，不能重复确认')
  const target = await findUserById(targetUserId)
  if (!target) throw new Error('员工不存在')
  ensureCanReviewBoard(actor, target.boardId)
  await ensurePerformanceResultForUser(cycle, target)
  await upsertPerformanceConfirmation(cycle.id, target.id, 'manager', actor.user.id, comment)
  await insertReviewLog(
    cycle.id,
    'performance',
    target.id,
    target.id,
    actor.user.id,
    'managerConfirmed',
    comment
  )
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function listBoardResponsibilityConfig(userId: number) {
  const actor = await requireActor(userId)
  if (actor.permissions.roleCode !== 'R_SUPER') throw new Error('仅超级管理员可维护组织责任配置')
  return getBoardResponsibilityConfig()
}

export async function updateBoardResponsibilityConfig(
  userId: number,
  boardId: string,
  payload: {
    leaderUserId?: number | null
    managerUserId?: number | null
    officeCoordinatorUserId?: number | null
  }
) {
  const actor = await requireActor(userId)
  if (actor.permissions.roleCode !== 'R_SUPER') throw new Error('仅超级管理员可维护组织责任配置')
  await runSql(
    `
    UPDATE boards
    SET leader_user_id = $leaderUserId,
        manager_user_id = $managerUserId,
        office_coordinator_user_id = $officeCoordinatorUserId
    WHERE id = $boardId
  `,
    {
      $boardId: boardId,
      $leaderUserId: payload.leaderUserId ?? null,
      $managerUserId: payload.managerUserId ?? null,
      $officeCoordinatorUserId: payload.officeCoordinatorUserId ?? null
    }
  )
  persistDatabase()
  return getBoardResponsibilityConfig()
}
async function migrateAndSeed(database: Database): Promise<void> {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      employee_no TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      menu_permissions TEXT NOT NULL,
      action_permissions TEXT NOT NULL,
      data_scope TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL,
      leader_user_id INTEGER,
      manager_user_id INTEGER,
      office_coordinator_user_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS assessment_cycles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      submit_deadline TEXT NOT NULL,
      review_deadline TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE IF NOT EXISTS assessment_items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      board_id TEXT NOT NULL,
      module_name TEXT NOT NULL,
      title TEXT NOT NULL,
      standard TEXT NOT NULL,
      is_redline INTEGER NOT NULL DEFAULT 0,
      score REAL NOT NULL DEFAULT 1,
      deduct_score REAL NOT NULL DEFAULT 1,
      require_evidence INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      deadline TEXT NOT NULL,
      deadline_at TEXT,
      task_category TEXT NOT NULL DEFAULT '分管负责人任务',
      deployer_user_id INTEGER,
      acceptor_user_id INTEGER,
      acceptance_status TEXT NOT NULL DEFAULT '待验收',
      overdue_locked INTEGER NOT NULL DEFAULT 0,
      collaboration_note TEXT NOT NULL DEFAULT '',
      owner TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS assessment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      status TEXT NOT NULL,
      remark TEXT NOT NULL DEFAULT '',
      rectification TEXT NOT NULL DEFAULT '',
      workflow_status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TEXT,
      reviewed_at TEXT,
      reviewer TEXT,
      review_comment TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, user_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS task_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      remark TEXT NOT NULL DEFAULT '',
      evidence_text TEXT NOT NULL DEFAULT '',
      workflow_status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TEXT,
      reviewed_at TEXT,
      reviewer TEXT,
      review_comment TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, user_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS task_evidence_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rectifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_record_id INTEGER NOT NULL,
      board_id TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      rectification TEXT NOT NULL,
      deadline TEXT NOT NULL DEFAULT '',
      review_comment TEXT NOT NULL DEFAULT '',
      evidence_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '待整改',
      closed_by INTEGER,
      closed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_type, source_record_id)
    );
    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      operator_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      operated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS performance_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      board_id TEXT NOT NULL,
      completion_rate REAL NOT NULL DEFAULT 0,
      daily_score REAL NOT NULL DEFAULT 0,
      redline_penalty REAL NOT NULL DEFAULT 0,
      final_score REAL NOT NULL DEFAULT 0,
      unfinished_count INTEGER NOT NULL DEFAULT 0,
      rectification_count INTEGER NOT NULL DEFAULT 0,
      overdue_count INTEGER NOT NULL DEFAULT 0,
      archived_status TEXT NOT NULL DEFAULT 'draft',
      employee_confirmed_at TEXT,
      manager_confirmed_at TEXT,
      manager_user_id INTEGER,
      generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS performance_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      confirmer_user_id INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, user_id, role)
    );
  `)

  ensureColumn(database, 'users', 'board_id', "TEXT NOT NULL DEFAULT 'medical'")
  ensureColumn(database, 'users', 'position', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'users', 'mobile', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'users', 'elderly_friendly', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(database, 'users', 'updated_at', 'TEXT')
  ensureColumn(database, 'roles', 'enabled', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(database, 'roles', 'created_at', 'TEXT')
  ensureColumn(database, 'roles', 'updated_at', 'TEXT')
  ensureColumn(database, 'boards', 'leader_user_id', 'INTEGER')
  ensureColumn(database, 'boards', 'manager_user_id', 'INTEGER')
  ensureColumn(database, 'boards', 'office_coordinator_user_id', 'INTEGER')
  ensureColumn(database, 'assessment_cycles', 'archived_at', 'TEXT')
  ensureColumn(database, 'assessment_items', 'score', 'REAL NOT NULL DEFAULT 1')
  ensureColumn(database, 'assessment_items', 'deduct_score', 'REAL NOT NULL DEFAULT 1')
  ensureColumn(database, 'assessment_items', 'require_evidence', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'tasks', 'deadline_at', 'TEXT')
  ensureColumn(database, 'tasks', 'task_category', "TEXT NOT NULL DEFAULT '分管负责人任务'")
  ensureColumn(database, 'tasks', 'deployer_user_id', 'INTEGER')
  ensureColumn(database, 'tasks', 'acceptor_user_id', 'INTEGER')
  ensureColumn(database, 'tasks', 'acceptance_status', "TEXT NOT NULL DEFAULT '待验收'")
  ensureColumn(database, 'tasks', 'overdue_locked', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'tasks', 'collaboration_note', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'task_records', 'evidence_text', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'rectifications', 'deadline', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'rectifications', 'review_comment', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'rectifications', 'evidence_text', "TEXT NOT NULL DEFAULT ''")

  database.exec(`
    UPDATE users
    SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE updated_at IS NULL;

    UPDATE roles
    SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE created_at IS NULL OR updated_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_task_evidence_attachments_record
    ON task_evidence_attachments(record_id);
  `)

  database.exec(`
    UPDATE rectifications
    SET status = '整改中', closed_by = NULL, closed_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE status = '已销号'
      AND (
        (source_type = 'assessment' AND EXISTS (
          SELECT 1 FROM assessment_records ar
          WHERE ar.id = rectifications.source_record_id AND ar.workflow_status = 'rectifying'
        ))
        OR
        (source_type = 'task' AND EXISTS (
          SELECT 1 FROM task_records tr
          WHERE tr.id = rectifications.source_record_id AND tr.workflow_status = 'rectifying'
        ))
      );
  `)

  seedRole(
    database,
    'R_SUPER',
    '超级管理员',
    '系统最高权限，可管理员工、账号、菜单权限和所有考核数据。',
    [
      'assessment',
      'employee-view',
      'employee-add',
      'permission-assign',
      'organization-config',
      'cycle-template',
      'review-desk',
      'leader-dashboard'
    ],
    [
      'employee:create',
      'employee:update',
      'employee:disable',
      'permission:update',
      'cycle:update',
      'template:update',
      'review:all'
    ],
    'all'
  )
  seedRole(
    database,
    'R_LEADER',
    '院领导',
    '查看全院汇总、趋势、排名、风险和整改闭环结果。',
    ['assessment', 'leader-dashboard', 'review-desk'],
    ['review:view', 'summary:export'],
    'all'
  )
  seedRole(
    database,
    'R_MANAGER',
    '板块负责人',
    '审核本板块员工考核、任务和整改事项。',
    ['assessment', 'review-desk'],
    ['review:board', 'rectification:close'],
    'board'
  )
  seedRole(
    database,
    'R_EMPLOYEE',
    '普通员工',
    '处理本人考核、任务、整改和结果查看。',
    ['assessment'],
    ['assessment:submit', 'task:submit'],
    'self'
  )
  addRolePermissions(database, 'R_SUPER', ['organization-config'], [])

  await seedUser(
    database,
    'admin',
    'admin123',
    '系统超级管理员',
    'HOS000',
    'admin@hospital.local',
    'R_SUPER',
    'generalOffice',
    '系统管理员'
  )
  await seedUser(
    database,
    'leader',
    'leader123',
    '院领导账号',
    'HOS008',
    'leader@hospital.local',
    'R_LEADER',
    'medical',
    '院领导'
  )
  await seedUser(
    database,
    'manager',
    'manager123',
    '板块负责人',
    'HOS003',
    'manager@hospital.local',
    'R_MANAGER',
    'medical',
    '医疗中心负责人'
  )
  await seedUser(
    database,
    'employee',
    'employee123',
    '普通员工',
    'HOS001',
    'employee@hospital.local',
    'R_EMPLOYEE',
    'medical',
    '临床员工'
  )
  seedBusinessData(database)
}

function seedBusinessData(database: Database): void {
  boards.forEach((board, index) =>
    runPrepared(
      database,
      `INSERT OR IGNORE INTO boards (id, name, owner, description, color, sort_order) VALUES ($id, $name, $owner, $description, $color, $sortOrder)`,
      {
        $id: board.id,
        $name: board.name,
        $owner: board.owner,
        $description: board.description,
        $color: board.color,
        $sortOrder: index
      }
    )
  )
  assessmentCycles.forEach((cycle) =>
    runPrepared(
      database,
      `INSERT OR IGNORE INTO assessment_cycles (id, name, type, start_date, end_date, submit_deadline, review_deadline, status, description) VALUES ($id, $name, $type, $startDate, $endDate, $submitDeadline, $reviewDeadline, $status, $description)`,
      {
        $id: cycle.id,
        $name: cycle.name,
        $type: cycle.type,
        $startDate: cycle.startDate,
        $endDate: cycle.endDate,
        $submitDeadline: cycle.submitDeadline,
        $reviewDeadline: cycle.reviewDeadline,
        $status: cycle.status,
        $description: cycle.description
      }
    )
  )
  ;[...commonAssessmentItems, ...boardAssessmentItems].forEach((item, index) =>
    runPrepared(
      database,
      `INSERT OR IGNORE INTO assessment_items (id, category, board_id, module_name, title, standard, is_redline, sort_order, enabled) VALUES ($id, $category, $boardId, $moduleName, $title, $standard, $isRedline, $sortOrder, 1)`,
      {
        $id: item.id,
        $category: item.category,
        $boardId: item.boardId,
        $moduleName: item.moduleName,
        $title: item.title,
        $standard: item.standard,
        $isRedline: item.isRedline ? 1 : 0,
        $sortOrder: index
      }
    )
  )
  ;[...hospitalWeeklyTasks, ...Object.values(boardWeeklyTasks).flat()].forEach((task, index) =>
    runPrepared(
      database,
      `INSERT OR IGNORE INTO tasks (id, source, board_id, title, deadline, owner, sort_order, enabled) VALUES ($id, $source, $boardId, $title, $deadline, $owner, $sortOrder, 1)`,
      {
        $id: task.id,
        $source: task.source,
        $boardId: task.boardId,
        $title: task.title,
        $deadline: task.deadline,
        $owner: task.owner,
        $sortOrder: index
      }
    )
  )
  seedBoardResponsibilities(database)
}

function seedBoardResponsibilities(database: Database): void {
  const managerRow = getSeedUserId(database, 'manager')
  const leaderRow = getSeedUserId(database, 'leader')
  const adminRow = getSeedUserId(database, 'admin')
  if (!managerRow && !leaderRow && !adminRow) return
  runPrepared(
    database,
    `
    UPDATE boards
    SET leader_user_id = COALESCE(leader_user_id, $leaderId),
        manager_user_id = COALESCE(manager_user_id, CASE WHEN id = 'medical' THEN $managerId ELSE manager_user_id END),
        office_coordinator_user_id = COALESCE(office_coordinator_user_id, $adminId)
  `,
    {
      $leaderId: leaderRow ?? null,
      $managerId: managerRow ?? null,
      $adminId: adminRow ?? null
    }
  )
}

function getSeedUserId(database: Database, username: string): number | null {
  const stmt = database.prepare('SELECT id FROM users WHERE username = $username LIMIT 1')
  stmt.bind({ $username: username })
  const id = stmt.step() ? Number(stmt.getAsObject().id) : null
  stmt.free()
  return id
}

function seedRole(
  database: Database,
  code: string,
  name: string,
  description: string,
  menuPermissions: string[],
  actionPermissions: string[],
  dataScope: string
): void {
  runPrepared(
    database,
    `
    INSERT INTO roles (code, name, description, menu_permissions, action_permissions, data_scope)
    SELECT $code, $name, $description, $menuPermissions, $actionPermissions, $dataScope
    WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code = $code)
  `,
    {
      $code: code,
      $name: name,
      $description: description,
      $menuPermissions: JSON.stringify(menuPermissions),
      $actionPermissions: JSON.stringify(actionPermissions),
      $dataScope: dataScope
    }
  )
}

function addRolePermissions(
  database: Database,
  roleCode: string,
  menuPermissions: string[],
  actionPermissions: string[]
): void {
  const stmt = database.prepare(
    'SELECT menu_permissions, action_permissions FROM roles WHERE code = $roleCode LIMIT 1'
  )
  stmt.bind({ $roleCode: roleCode })
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  if (!row) return

  const currentMenuPermissions = parseJsonList(row.menu_permissions)
  const currentActionPermissions = parseJsonList(row.action_permissions)
  const nextMenuPermissions = [...new Set([...currentMenuPermissions, ...menuPermissions])]
  const nextActionPermissions = [...new Set([...currentActionPermissions, ...actionPermissions])]

  runPrepared(
    database,
    `
    UPDATE roles
    SET menu_permissions = $menuPermissions,
        action_permissions = $actionPermissions,
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE code = $roleCode
  `,
    {
      $roleCode: roleCode,
      $menuPermissions: JSON.stringify(nextMenuPermissions),
      $actionPermissions: JSON.stringify(nextActionPermissions)
    }
  )
}

function parseJsonList(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || '[]'))
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

async function seedUser(
  database: Database,
  username: string,
  password: string,
  displayName: string,
  employeeNo: string,
  email: string,
  roleCode: string,
  boardId: string,
  position: string
): Promise<void> {
  const exists = database.prepare('SELECT id FROM users WHERE username = $username LIMIT 1')
  exists.bind({ $username: username })
  const hasUser = exists.step()
  exists.free()
  if (!hasUser) {
    const passwordHash = await bcrypt.hash(password, 10)
    runPrepared(
      database,
      `INSERT INTO users (username, password_hash, display_name, employee_no, email, status, board_id, position, elderly_friendly) VALUES ($username, $passwordHash, $displayName, $employeeNo, $email, 'active', $boardId, $position, 1)`,
      {
        $username: username,
        $passwordHash: passwordHash,
        $displayName: displayName,
        $employeeNo: employeeNo,
        $email: email,
        $boardId: boardId,
        $position: position
      }
    )
  }
  runPrepared(
    database,
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.username = $username AND r.code = $roleCode`,
    { $username: username, $roleCode: roleCode }
  )
}
async function requireActor(userId: number) {
  const user = await findUserById(userId)
  if (!user || user.status !== 'active') throw new Error('账号不存在或已停用')
  return { user, permissions: await getUserPermissions(user.id) }
}

async function ensureRoleAssignable(roleCode: string) {
  const role = (
    await queryRows('SELECT id, enabled FROM roles WHERE code = $roleCode LIMIT 1', {
      $roleCode: roleCode
    })
  )[0]
  if (!role) throw new Error('角色不存在')
  if (Number(role.enabled ?? 1) !== 1) throw new Error('该角色已停用，不能分配给员工')
}

async function ensureAssignableBoard(boardId: string) {
  const board = (
    await queryRows('SELECT id FROM boards WHERE id = $boardId LIMIT 1', {
      $boardId: boardId
    })
  )[0]
  if (!board || boardId === 'allStaff') throw new Error('请选择有效的员工所属板块')
}

async function getCurrentCycle() {
  const row = (
    await queryRows(
      `SELECT * FROM assessment_cycles ORDER BY CASE status WHEN 'filling' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, start_date DESC LIMIT 1`
    )
  )[0]
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    submitDeadline: String(row.submit_deadline),
    reviewDeadline: String(row.review_deadline),
    status: String(row.status),
    description: String(row.description),
    archivedAt: String(row.archived_at || '')
  }
}

async function getVisibleBoardsForActor(actor: {
  user: AccountUser
  permissions: AccountPermission
}) {
  const all = await queryRows('SELECT * FROM boards ORDER BY sort_order ASC')
  const allowed =
    actor.permissions.dataScope === 'all'
      ? all
      : all.filter((board) => board.id === 'allStaff' || board.id === actor.user.boardId)
  return allowed.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    owner: String(row.owner),
    description: String(row.description),
    color: String(row.color),
    leaderUserId: row.leader_user_id ? Number(row.leader_user_id) : undefined,
    managerUserId: row.manager_user_id ? Number(row.manager_user_id) : undefined,
    officeCoordinatorUserId: row.office_coordinator_user_id
      ? Number(row.office_coordinator_user_id)
      : undefined
  }))
}

async function getAssessmentItems(boardIds: string[]) {
  const rows = await queryRows(
    `SELECT * FROM assessment_items WHERE enabled = 1 ORDER BY category ASC, sort_order ASC`
  )
  return rows
    .filter((row) => boardIds.includes(String(row.board_id)))
    .map((row) => ({
      id: String(row.id),
      category: String(row.category),
      boardId: String(row.board_id),
      moduleName: String(row.module_name),
      title: String(row.title),
      standard: String(row.standard),
      isRedline: Number(row.is_redline) === 1,
      score: Number(row.score || 1),
      deductScore: Number(row.deduct_score || 1),
      requireEvidence: Number(row.require_evidence || 0) === 1
    }))
}

async function getTasks(boardIds: string[], subjectUserId?: number) {
  const rows = await queryRows('SELECT * FROM tasks WHERE enabled = 1 ORDER BY sort_order ASC')
  const visibleRows = rows.filter((row) => boardIds.includes(String(row.board_id)))
  const tasks = []
  for (const row of visibleRows) {
    if (subjectUserId && !(await canUserSeeTask(String(row.id), subjectUserId))) continue
    tasks.push(await mapTaskItemWithAssignees(row))
  }
  return tasks
}

async function getManagedBoardTasksForActor(actor: {
  user: AccountUser
  permissions: AccountPermission
}) {
  const visibleBoards = await getVisibleBoardsForActor(actor)
  const visibleBoardIds = visibleBoards.map((board) => String(board.id))
  const rows = await queryRows(
    `SELECT * FROM tasks WHERE source = '分管负责人安排' ORDER BY enabled ASC, sort_order ASC`
  )
  const tasks = []
  for (const row of rows.filter((row) => visibleBoardIds.includes(String(row.board_id)))) {
    tasks.push(await mapTaskItemWithAssignees(row))
  }
  return tasks
}

async function getManagedTaskRowForActor(
  actor: { user: AccountUser; permissions: AccountPermission },
  taskId: string
) {
  const task = (
    await queryRows(`SELECT * FROM tasks WHERE id = $id AND source = '分管负责人安排' LIMIT 1`, {
      $id: taskId
    })
  )[0]
  if (!task) throw new Error('分管工作任务不存在')
  ensureCanReviewBoard(actor, String(task.board_id))
  return task
}

function mapTaskItem(row: Record<string, unknown>) {
  const deadlineAt = String(row.deadline_at || '')
  const isOverdue = Boolean(deadlineAt) && Date.now() > Date.parse(deadlineAt)
  return {
    id: String(row.id),
    source: String(row.source),
    boardId: String(row.board_id),
    title: String(row.title),
    deadline: String(row.deadline),
    deadlineAt,
    taskCategory: String(row.task_category || '分管负责人任务'),
    deployerUserId: row.deployer_user_id ? Number(row.deployer_user_id) : undefined,
    acceptorUserId: row.acceptor_user_id ? Number(row.acceptor_user_id) : undefined,
    acceptanceStatus: String(row.acceptance_status || '待验收'),
    overdueLocked: Number(row.overdue_locked || 0) === 1 || isOverdue,
    overdue: isOverdue,
    collaborationNote: String(row.collaboration_note || ''),
    owner: String(row.owner),
    enabled: Number(row.enabled || 0) === 1,
    assigneeMode: 'board',
    assigneeUserIds: [] as number[],
    assigneeNames: [] as string[]
  }
}

async function mapTaskItemWithAssignees(row: Record<string, unknown>) {
  const assignees = await getTaskAssignees(String(row.id))
  return {
    ...mapTaskItem(row),
    assigneeMode: assignees.length ? 'users' : 'board',
    assigneeUserIds: assignees.map((item) => item.userId),
    assigneeNames: assignees.map((item) => item.name)
  }
}

async function getTaskAssignees(taskId: string) {
  const rows = await queryRows(
    `
    SELECT u.id, u.display_name
    FROM task_assignees ta
    INNER JOIN users u ON u.id = ta.user_id
    WHERE ta.task_id = $taskId
    ORDER BY u.display_name ASC
  `,
    { $taskId: taskId }
  )
  return rows.map((row) => ({
    userId: Number(row.id),
    name: String(row.display_name)
  }))
}

async function canUserSeeTask(taskId: string, userId: number) {
  const assigneeCount = Number(
    (
      await queryRows('SELECT COUNT(*) AS count FROM task_assignees WHERE task_id = $taskId', {
        $taskId: taskId
      })
    )[0]?.count || 0
  )
  if (assigneeCount === 0) return true
  const assigned = (
    await queryRows(
      'SELECT 1 FROM task_assignees WHERE task_id = $taskId AND user_id = $userId LIMIT 1',
      { $taskId: taskId, $userId: userId }
    )
  )[0]
  return Boolean(assigned)
}

async function ensureValidTaskAssignees(
  actor: { user: AccountUser; permissions: AccountPermission },
  boardId: string,
  payload: ManagerTaskPayload
) {
  if (payload.assigneeMode !== 'users') return
  const userIds = [
    ...new Set((payload.assigneeUserIds || []).map((id) => Number(id)).filter(Boolean))
  ]
  if (!userIds.length) throw new Error('请选择需要接收任务的员工，或切换为全板块推送')
  const placeholders = userIds.map((_, index) => `$userId${index}`)
  const params = Object.fromEntries(userIds.map((id, index) => [`$userId${index}`, id]))
  const rows = await queryRows(
    `
    SELECT u.id, u.board_id, u.status, COALESCE(r.code, 'R_EMPLOYEE') AS role_code
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id IN (${placeholders.join(',')})
  `,
    params
  )
  if (rows.length !== userIds.length) throw new Error('指定接收人中包含不存在的员工')
  const invalid = rows.find(
    (row) =>
      String(row.board_id) !== boardId ||
      String(row.status) !== 'active' ||
      String(row.role_code || 'R_EMPLOYEE') !== 'R_EMPLOYEE'
  )
  if (invalid) throw new Error('指定接收人必须是当前板块内启用的普通员工')
  ensureCanReviewBoard(actor, boardId)
}

async function replaceTaskAssignees(
  taskId: string,
  boardId: string,
  actor: { user: AccountUser; permissions: AccountPermission },
  payload: ManagerTaskPayload
) {
  await runSql('DELETE FROM task_assignees WHERE task_id = $taskId', { $taskId: taskId })
  if (payload.assigneeMode !== 'users') return
  await ensureValidTaskAssignees(actor, boardId, payload)
  const userIds = [
    ...new Set((payload.assigneeUserIds || []).map((id) => Number(id)).filter(Boolean))
  ]
  for (const userId of userIds) {
    await runSql(
      'INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES ($taskId, $userId)',
      { $taskId: taskId, $userId: userId }
    )
  }
}

function ensureValidManagerTaskPayload(payload: ManagerTaskPayload): void {
  if (!payload.title?.trim()) throw new Error('请填写工作内容')
  if (!payload.deadline) throw new Error('请选择完成时限')
  if (!payload.deadlineAt && !payload.deadline.includes(':'))
    throw new Error('中心负责人任务必须选择精确截止时间')
  if (!payload.owner?.trim()) throw new Error('请填写责任人')
}

function normalizeDateTime(value: string): string {
  if (!value) return ''
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const timestamp = Date.parse(normalized)
  if (Number.isNaN(timestamp)) return value
  return new Date(timestamp).toISOString()
}

function isAfterDeadline(deadlineAt: unknown): boolean {
  const value = String(deadlineAt || '')
  if (!value) return false
  const timestamp = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'))
  return !Number.isNaN(timestamp) && Date.now() > timestamp
}

async function getAssessmentRecordMap(cycleId: string, userId: number) {
  const rows = await queryRows(
    'SELECT * FROM assessment_records WHERE cycle_id = $cycleId AND user_id = $userId',
    { $cycleId: cycleId, $userId: userId }
  )
  return Object.fromEntries(rows.map((row) => [String(row.item_id), mapAssessmentRecordDraft(row)]))
}

async function getTaskRecordMap(cycleId: string, userId: number) {
  const rows = await queryRows(
    'SELECT * FROM task_records WHERE cycle_id = $cycleId AND user_id = $userId',
    { $cycleId: cycleId, $userId: userId }
  )
  const entries = await Promise.all(
    rows.map(async (row) => [
      String(row.task_id),
      { ...mapTaskRecordDraft(row), attachments: await getTaskEvidenceAttachments(Number(row.id)) }
    ])
  )
  return Object.fromEntries(entries)
}

async function getAssessmentRecord(cycleId: string, userId: number, itemId: string) {
  return (
    await queryRows(
      'SELECT * FROM assessment_records WHERE cycle_id = $cycleId AND user_id = $userId AND item_id = $itemId LIMIT 1',
      { $cycleId: cycleId, $userId: userId, $itemId: itemId }
    )
  )[0]
}

async function getTaskRecord(cycleId: string, userId: number, taskId: string) {
  return (
    await queryRows(
      'SELECT * FROM task_records WHERE cycle_id = $cycleId AND user_id = $userId AND task_id = $taskId LIMIT 1',
      { $cycleId: cycleId, $userId: userId, $taskId: taskId }
    )
  )[0]
}

async function ensureEditableTaskEvidenceContext(
  userId: number,
  taskId: string,
  targetUserId?: number
) {
  const actor = await requireActor(userId)
  const target = await resolveRecordTarget(actor, targetUserId)
  const cycle = await getCurrentCycle()
  const task = (
    await queryRows('SELECT * FROM tasks WHERE id = $id AND enabled = 1 LIMIT 1', {
      $id: taskId
    })
  )[0]
  if (!task) throw new Error('任务不存在或已停用')
  ensureCanAccessBoard(actor, String(task.board_id))
  if (!(await canUserSeeTask(taskId, target.id))) throw new Error('该任务未分配给当前员工')
  await ensureCycleCanBeEditedByEmployee(cycle, target.id)
  if (isAfterDeadline(task.deadline_at)) {
    await runSql(`UPDATE tasks SET overdue_locked = 1 WHERE id = $id`, { $id: taskId })
    persistDatabase()
    throw new Error('任务已超过截止时间，需负责人延期后才能提交')
  }
  let record = await getTaskRecord(cycle.id, target.id, taskId)
  ensureEditableRecordWorkflow(String(record?.workflow_status || 'draft'), '任务记录')
  if (!record) {
    await runSql(
      `
      INSERT INTO task_records (cycle_id, user_id, task_id, status, remark, evidence_text, workflow_status, updated_at)
      VALUES ($cycleId, $userId, $taskId, 'pending', '', '', 'draft', CURRENT_TIMESTAMP)
    `,
      { $cycleId: cycle.id, $userId: target.id, $taskId: taskId }
    )
    record = await getTaskRecord(cycle.id, target.id, taskId)
  }
  if (!record) throw new Error('任务记录创建失败，请稍后重试')
  return { actor, target, cycle, task, record }
}

async function getTaskEvidenceAttachmentCount(recordId: number) {
  const row = (
    await queryRows(
      'SELECT COUNT(*) AS count FROM task_evidence_attachments WHERE record_id = $recordId',
      { $recordId: recordId }
    )
  )[0]
  return Number(row?.count || 0)
}

async function getTaskEvidenceAttachments(recordId: number) {
  const rows = await queryRows(
    `
    SELECT id, original_name, mime_type, uploaded_at
    FROM task_evidence_attachments
    WHERE record_id = $recordId
    ORDER BY uploaded_at DESC, id DESC
  `,
    { $recordId: recordId }
  )
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.original_name || '佐证材料'),
    type: String(row.mime_type || '').startsWith('image/') ? 'image' : 'file',
    url: `/api/assessment/tasks/evidence/${row.id}/download`,
    uploadedAt: String(row.uploaded_at || '')
  }))
}

async function getTaskEvidenceAttachmentRow(attachmentId: number) {
  return (
    await queryRows(
      `
      SELECT tea.*, tea.id AS attachment_id, tr.id AS record_id, tr.cycle_id, tr.user_id, tr.workflow_status, t.board_id
      FROM task_evidence_attachments tea
      INNER JOIN task_records tr ON tr.id = tea.record_id
      INNER JOIN tasks t ON t.id = tr.task_id
      WHERE tea.id = $id
      LIMIT 1
    `,
      { $id: attachmentId }
    )
  )[0]
}

async function getRectifications(actor: { user: AccountUser; permissions: AccountPermission }) {
  const rows = await queryRows(`
    SELECT r.*, b.name AS board_name, u.display_name AS owner_name
    FROM rectifications r
    INNER JOIN boards b ON b.id = r.board_id
    INNER JOIN users u ON u.id = r.owner_user_id
    ORDER BY r.updated_at DESC
  `)
  return rows
    .filter((row) => canSeeUserRow(actor, String(row.board_id), Number(row.owner_user_id)))
    .map((row) => ({
      id: String(row.id),
      source: String(row.source_type) === 'assessment' ? '考核项' : '任务',
      boardName: String(row.board_name),
      description: String(row.description),
      owner: String(row.owner_name),
      rectification: String(row.rectification),
      status: String(row.status),
      updatedAt: String(row.updated_at || ''),
      closedAt: String(row.closed_at || '')
    }))
}

async function getReviewTodoItems(actor: { user: AccountUser; permissions: AccountPermission }) {
  if (actor.permissions.roleCode === 'R_EMPLOYEE') return []
  const assessmentRows = await queryRows(`
    SELECT ar.id, ar.item_id, ar.status, ar.workflow_status, ar.remark, ar.user_id, ar.cycle_id, ai.title, ai.standard, ai.board_id, b.name AS board_name, u.display_name AS owner_name, c.submit_deadline
    FROM assessment_records ar
    INNER JOIN assessment_items ai ON ai.id = ar.item_id
    INNER JOIN boards b ON b.id = ai.board_id
    INNER JOIN users u ON u.id = ar.user_id
    INNER JOIN assessment_cycles c ON c.id = ar.cycle_id
    WHERE ar.workflow_status = 'submitted'
    ORDER BY ar.updated_at DESC
  `)
  const taskRows = await queryRows(`
    SELECT tr.id, tr.task_id, tr.status, tr.workflow_status, tr.remark, tr.evidence_text, tr.user_id, tr.cycle_id, t.title, t.board_id, b.name AS board_name, u.display_name AS owner_name, t.deadline
    FROM task_records tr
    INNER JOIN tasks t ON t.id = tr.task_id
    INNER JOIN boards b ON b.id = t.board_id
    INNER JOIN users u ON u.id = tr.user_id
    WHERE tr.workflow_status = 'submitted'
    ORDER BY tr.updated_at DESC
  `)
  const assessmentTodos = assessmentRows
    .filter((row) => canSeeUserRow(actor, String(row.board_id), Number(row.user_id)))
    .map((row) => ({
      id: `assessment:${row.id}`,
      recordType: 'assessment',
      recordId: Number(row.id),
      title: String(row.title),
      description: String(row.standard || row.remark || ''),
      source: 'review',
      boardId: String(row.board_id),
      boardName: String(row.board_name),
      owner: String(row.owner_name),
      deadline: String(row.submit_deadline),
      priority: row.workflow_status === 'returned' ? 'urgent' : 'warning',
      workflowStatus: String(row.workflow_status),
      actionText: row.workflow_status === 'submitted' ? '立即审核' : '跟进整改'
    }))
  const visibleTaskRows = taskRows.filter((row) =>
    canSeeUserRow(actor, String(row.board_id), Number(row.user_id))
  )
  const taskTodos = await Promise.all(
    visibleTaskRows.map(async (row) => ({
      id: `task:${row.id}`,
      recordType: 'task',
      recordId: Number(row.id),
      title: String(row.title),
      description: String(row.remark || '本周任务'),
      source: 'review',
      boardId: String(row.board_id),
      boardName: String(row.board_name),
      owner: String(row.owner_name),
      deadline: String(row.deadline),
      priority: row.workflow_status === 'returned' ? 'urgent' : 'warning',
      workflowStatus: String(row.workflow_status),
      actionText: row.workflow_status === 'submitted' ? '立即审核' : '跟进任务',
      evidenceText: String(row.evidence_text || ''),
      attachments: await getTaskEvidenceAttachments(Number(row.id))
    }))
  )
  return [...assessmentTodos, ...taskTodos]
}

async function getSubjectUserIds(actor: { user: AccountUser; permissions: AccountPermission }) {
  if (actor.permissions.dataScope === 'all')
    return (await queryRows('SELECT id FROM users WHERE status = "active"')).map((row) =>
      Number(row.id)
    )
  if (actor.permissions.dataScope === 'board')
    return (
      await queryRows('SELECT id FROM users WHERE status = "active" AND board_id = $boardId', {
        $boardId: actor.user.boardId
      })
    ).map((row) => Number(row.id))
  return [actor.user.id]
}

async function getUsersByIds(ids: number[]) {
  const users: AccountUser[] = []
  for (const id of ids) {
    const user = await findUserById(id)
    if (user) users.push(user)
  }
  return users
}
function calculateSummary(
  items: Array<{ id: string; isRedline?: boolean }>,
  records: Record<string, { status: string }>
) {
  const applicable = items.filter((item) => (records[item.id]?.status || 'completed') !== 'na')
  const completedCount = applicable.filter(
    (item) => (records[item.id]?.status || 'completed') === 'completed'
  ).length
  const pendingCount = applicable.filter((item) => records[item.id]?.status === 'pending').length
  const redlinePenalty = applicable.some(
    (item) => item.isRedline && records[item.id]?.status === 'pending'
  )
    ? 12
    : 0
  return {
    totalApplicable: applicable.length,
    completedCount,
    pendingCount,
    completionRate: applicable.length ? completedCount / applicable.length : 0,
    dailyScore: completedCount,
    redlinePenalty,
    finalScore: completedCount - redlinePenalty
  }
}

async function ensurePerformanceResultsForActor(
  actor: { user: AccountUser; permissions: AccountPermission },
  cycle: { id: string; status: string }
) {
  const users = await getPerformanceSubjectUsers(await getSubjectUserIds(actor))
  for (const user of users) await ensurePerformanceResultForUser(cycle, user)
}

async function generatePerformanceResultsForCycle(cycleId: string, archive: boolean) {
  const cycleRow = (
    await queryRows('SELECT * FROM assessment_cycles WHERE id = $id LIMIT 1', {
      $id: cycleId
    })
  )[0]
  if (!cycleRow) return
  const cycle = {
    id: String(cycleRow.id),
    status: String(cycleRow.status),
    submitDeadline: String(cycleRow.submit_deadline),
    reviewDeadline: String(cycleRow.review_deadline)
  }
  const users = await getPerformanceSubjectUsers(
    (await queryRows('SELECT id FROM users WHERE status = "active"')).map((row) => Number(row.id))
  )
  for (const user of users) await ensurePerformanceResultForUser(cycle, user)
  if (archive) {
    await runSql(
      `UPDATE performance_results SET archived_status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE cycle_id = $cycleId`,
      { $cycleId: cycleId }
    )
  }
}

async function getPerformanceSubjectUsers(ids: number[]) {
  const users = await getUsersByIds(ids)
  const subjects: AccountUser[] = []
  for (const user of users) {
    const permissions = await getUserPermissions(user.id)
    if (permissions.roleCode !== 'R_SUPER') subjects.push(user)
  }
  return subjects
}

async function ensureCycleReadyToArchive(cycleId: string) {
  const totalSubjects = Number(
    (
      await queryRows(`
        SELECT COUNT(DISTINCT u.id) AS count
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.status = 'active' AND COALESCE(r.code, 'R_EMPLOYEE') != 'R_SUPER'
      `)
    )[0]?.count || 0
  )
  const readyCount = Number(
    (
      await queryRows(
        `
        SELECT COUNT(*) AS count
        FROM performance_results pr
        INNER JOIN users u ON u.id = pr.user_id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE pr.cycle_id = $cycleId
          AND u.status = 'active'
          AND COALESCE(r.code, 'R_EMPLOYEE') != 'R_SUPER'
          AND pr.employee_confirmed_at IS NOT NULL
          AND pr.employee_confirmed_at != ''
          AND pr.manager_confirmed_at IS NOT NULL
          AND pr.manager_confirmed_at != ''
      `,
        { $cycleId: cycleId }
      )
    )[0]?.count || 0
  )
  if (readyCount < totalSubjects) {
    throw new Error(`周期归档前需完成员工和负责人两级电子确认：${readyCount}/${totalSubjects}`)
  }
}

async function ensurePerformanceResultForUser(
  cycle: { id: string; status: string; submitDeadline?: string; reviewDeadline?: string },
  user: AccountUser
) {
  const boardIds = ['allStaff', user.boardId]
  const items = await getAssessmentItems(boardIds)
  const tasks = await getTasks(boardIds, user.id)
  const assessmentRecords = await getAssessmentRecordMap(cycle.id, user.id)
  const taskRecords = await getTaskRecordMap(cycle.id, user.id)
  const summary = calculateSummary([...items, ...tasks], { ...assessmentRecords, ...taskRecords })
  const rectificationCount = Number(
    (
      await queryRows(
        `SELECT COUNT(*) AS count FROM rectifications WHERE cycle_id = $cycleId AND owner_user_id = $userId AND status != '已销号'`,
        { $cycleId: cycle.id, $userId: user.id }
      )
    )[0]?.count || 0
  )
  const overdueCount = await countOverdueTasksForUser(cycle.id, user.id, boardIds)
  const employeeConfirmation = await getPerformanceConfirmation(cycle.id, user.id, 'employee')
  const managerConfirmation = await getPerformanceConfirmation(cycle.id, user.id, 'manager')
  const archivedStatus =
    cycle.status === 'archived' ? 'archived' : managerConfirmation ? 'ready' : 'draft'
  await runSql(
    `
    INSERT INTO performance_results (
      cycle_id, user_id, board_id, completion_rate, daily_score, redline_penalty, final_score,
      unfinished_count, rectification_count, overdue_count, archived_status,
      employee_confirmed_at, manager_confirmed_at, manager_user_id, generated_at, updated_at
    )
    VALUES (
      $cycleId, $userId, $boardId, $completionRate, $dailyScore, $redlinePenalty, $finalScore,
      $unfinishedCount, $rectificationCount, $overdueCount, $archivedStatus,
      $employeeConfirmedAt, $managerConfirmedAt, $managerUserId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT(cycle_id, user_id) DO UPDATE SET
      board_id = excluded.board_id,
      completion_rate = excluded.completion_rate,
      daily_score = excluded.daily_score,
      redline_penalty = excluded.redline_penalty,
      final_score = excluded.final_score,
      unfinished_count = excluded.unfinished_count,
      rectification_count = excluded.rectification_count,
      overdue_count = excluded.overdue_count,
      archived_status = excluded.archived_status,
      employee_confirmed_at = COALESCE(excluded.employee_confirmed_at, performance_results.employee_confirmed_at),
      manager_confirmed_at = COALESCE(excluded.manager_confirmed_at, performance_results.manager_confirmed_at),
      manager_user_id = COALESCE(excluded.manager_user_id, performance_results.manager_user_id),
      updated_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: cycle.id,
      $userId: user.id,
      $boardId: user.boardId,
      $completionRate: summary.completionRate,
      $dailyScore: summary.dailyScore,
      $redlinePenalty: summary.redlinePenalty,
      $finalScore: summary.finalScore,
      $unfinishedCount: summary.pendingCount,
      $rectificationCount: rectificationCount,
      $overdueCount: overdueCount,
      $archivedStatus: archivedStatus,
      $employeeConfirmedAt: employeeConfirmation?.confirmedAt ?? null,
      $managerConfirmedAt: managerConfirmation?.confirmedAt ?? null,
      $managerUserId: managerConfirmation?.confirmerUserId ?? null
    }
  )
}

async function countOverdueTasksForUser(cycleId: string, userId: number, boardIds: string[]) {
  const tasks = await getTasks(boardIds, userId)
  let count = 0
  for (const task of tasks) {
    if (!isAfterDeadline(task.deadlineAt)) continue
    const record = await getTaskRecord(cycleId, userId, task.id)
    const recordStatus = String(record?.status || '')
    const workflowStatus = String(record?.workflow_status || '')
    if (recordStatus !== 'completed' || !['approved', 'closed'].includes(workflowStatus)) count += 1
  }
  return count
}

async function getPerformanceConfirmation(cycleId: string, userId: number, role: string) {
  const row = (
    await queryRows(
      'SELECT * FROM performance_confirmations WHERE cycle_id = $cycleId AND user_id = $userId AND role = $role LIMIT 1',
      { $cycleId: cycleId, $userId: userId, $role: role }
    )
  )[0]
  if (!row) return null
  return {
    id: Number(row.id),
    cycleId: String(row.cycle_id),
    userId: Number(row.user_id),
    role: String(row.role),
    confirmerUserId: Number(row.confirmer_user_id),
    comment: String(row.comment || ''),
    confirmedAt: String(row.confirmed_at)
  }
}

async function upsertPerformanceConfirmation(
  cycleId: string,
  userId: number,
  role: string,
  confirmerUserId: number,
  comment: string
) {
  await runSql(
    `
    INSERT INTO performance_confirmations (cycle_id, user_id, role, confirmer_user_id, comment, confirmed_at)
    VALUES ($cycleId, $userId, $role, $confirmerUserId, $comment, CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id, user_id, role) DO UPDATE SET
      confirmer_user_id = excluded.confirmer_user_id,
      comment = excluded.comment,
      confirmed_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: cycleId,
      $userId: userId,
      $role: role,
      $confirmerUserId: confirmerUserId,
      $comment: comment
    }
  )
  await runSql(
    `
    UPDATE performance_results
    SET employee_confirmed_at = CASE WHEN $role = 'employee' THEN CURRENT_TIMESTAMP ELSE employee_confirmed_at END,
        manager_confirmed_at = CASE WHEN $role = 'manager' THEN CURRENT_TIMESTAMP ELSE manager_confirmed_at END,
        manager_user_id = CASE WHEN $role = 'manager' THEN $confirmerUserId ELSE manager_user_id END,
        archived_status = CASE WHEN $role = 'manager' THEN 'ready' ELSE archived_status END,
        updated_at = CURRENT_TIMESTAMP
    WHERE cycle_id = $cycleId AND user_id = $userId
  `,
    { $cycleId: cycleId, $userId: userId, $role: role, $confirmerUserId: confirmerUserId }
  )
}

async function getPerformanceResultsForActor(
  actor: { user: AccountUser; permissions: AccountPermission },
  cycleId: string
) {
  const rows = await queryRows(`
    SELECT pr.*, u.display_name, u.employee_no, b.name AS board_name, mu.display_name AS manager_name, r.code AS role_code
    FROM performance_results pr
    INNER JOIN users u ON u.id = pr.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN boards b ON b.id = pr.board_id
    LEFT JOIN users mu ON mu.id = pr.manager_user_id
    WHERE pr.cycle_id = '${cycleId.replace(/'/g, "''")}'
    ORDER BY pr.final_score ASC, pr.overdue_count DESC
  `)
  return rows
    .filter(
      (row) =>
        String(row.role_code || 'R_EMPLOYEE') !== 'R_SUPER' &&
        canSeeUserRow(actor, String(row.board_id), Number(row.user_id))
    )
    .map(mapPerformanceResult)
}

function mapPerformanceResult(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    cycleId: String(row.cycle_id),
    userId: Number(row.user_id),
    employeeName: String(row.display_name || ''),
    employeeNo: String(row.employee_no || ''),
    boardId: String(row.board_id),
    boardName: String(row.board_name || ''),
    completionRate: Number(row.completion_rate || 0),
    dailyScore: Number(row.daily_score || 0),
    redlinePenalty: Number(row.redline_penalty || 0),
    finalScore: Number(row.final_score || 0),
    unfinishedCount: Number(row.unfinished_count || 0),
    rectificationCount: Number(row.rectification_count || 0),
    overdueCount: Number(row.overdue_count || 0),
    archivedStatus: String(row.archived_status || 'draft'),
    employeeConfirmedAt: String(row.employee_confirmed_at || ''),
    managerConfirmedAt: String(row.manager_confirmed_at || ''),
    managerUserId: row.manager_user_id ? Number(row.manager_user_id) : undefined,
    managerName: String(row.manager_name || ''),
    updatedAt: String(row.updated_at || '')
  }
}

function buildConfirmationSummary(results: Array<ReturnType<typeof mapPerformanceResult>>) {
  const totalEmployees = results.length
  const employeeConfirmedCount = results.filter((item) => item.employeeConfirmedAt).length
  const managerConfirmedCount = results.filter((item) => item.managerConfirmedAt).length
  return {
    totalEmployees,
    employeeConfirmedCount,
    managerConfirmedCount,
    readyToArchiveCount: results.filter((item) => item.archivedStatus === 'ready').length,
    unconfirmedCount: Math.max(totalEmployees - employeeConfirmedCount, 0)
  }
}

function buildConfirmationGaps(results: Array<ReturnType<typeof mapPerformanceResult>>) {
  return results
    .filter((item) => !item.employeeConfirmedAt || !item.managerConfirmedAt)
    .map((item) => ({
      userId: item.userId,
      employeeName: item.employeeName,
      employeeNo: item.employeeNo,
      boardId: item.boardId,
      boardName: item.boardName,
      missingEmployeeConfirmation: !item.employeeConfirmedAt,
      missingManagerConfirmation: !item.managerConfirmedAt,
      archivedStatus: item.archivedStatus
    }))
}

function buildPerformanceSummary(results: Array<ReturnType<typeof mapPerformanceResult>>) {
  const totalEmployees = results.length
  const averageScore = totalEmployees
    ? results.reduce((total, item) => total + item.finalScore, 0) / totalEmployees
    : 0
  const averageCompletionRate = totalEmployees
    ? results.reduce((total, item) => total + item.completionRate, 0) / totalEmployees
    : 0
  const boardMap = new Map<string, Array<ReturnType<typeof mapPerformanceResult>>>()
  results.forEach((item) => {
    boardMap.set(item.boardId, [...(boardMap.get(item.boardId) ?? []), item])
  })
  return {
    totalEmployees,
    averageScore,
    averageCompletionRate,
    readyToArchiveCount: results.filter((item) => item.archivedStatus === 'ready').length,
    archivedCount: results.filter((item) => item.archivedStatus === 'archived').length,
    boardSummaries: [...boardMap.entries()].map(([boardId, rows]) => ({
      boardId,
      boardName: rows[0]?.boardName || boardId,
      completionRate: rows.reduce((total, item) => total + item.completionRate, 0) / rows.length,
      averageScore: rows.reduce((total, item) => total + item.finalScore, 0) / rows.length,
      overdueTaskCount: rows.reduce((total, item) => total + item.overdueCount, 0)
    }))
  }
}

async function buildRiskSummary(
  actor: { user: AccountUser; permissions: AccountPermission },
  cycleId: string,
  results: Array<ReturnType<typeof mapPerformanceResult>>
) {
  const rectifications = await getRectifications(actor)
  const redlineRows = await queryRows(`
    SELECT ar.user_id, u.board_id
    FROM assessment_records ar
    INNER JOIN assessment_items ai ON ai.id = ar.item_id
    INNER JOIN users u ON u.id = ar.user_id
    WHERE ar.cycle_id = '${cycleId.replace(/'/g, "''")}' AND ar.status = 'pending' AND ai.is_redline = 1
  `)
  const redlineCount = redlineRows.filter((row) =>
    canSeeUserRow(actor, String(row.board_id), Number(row.user_id))
  ).length
  return {
    overdueTaskCount: results.reduce((total, item) => total + item.overdueCount, 0),
    unconfirmedEmployeeCount: results.filter((item) => !item.employeeConfirmedAt).length,
    openRectificationCount: rectifications.filter((item) => item.status !== '已销号').length,
    redlineCount,
    lowScoreEmployees: results
      .filter((item) => item.finalScore < 0 || item.unfinishedCount > 0 || item.overdueCount > 0)
      .slice(0, 10)
  }
}

function mapTemplateItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    category: String(row.category),
    boardId: String(row.board_id),
    boardName: String(row.board_name || ''),
    moduleName: String(row.module_name),
    title: String(row.title),
    standard: String(row.standard),
    isRedline: Number(row.is_redline || 0) === 1,
    enabled: Number(row.enabled || 0) === 1,
    sortOrder: Number(row.sort_order || 0),
    score: Number(row.score || 1),
    deductScore: Number(row.deduct_score || 1),
    requireEvidence: Number(row.require_evidence || 0) === 1
  }
}

function mapCycleItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    submitDeadline: String(row.submit_deadline),
    reviewDeadline: String(row.review_deadline),
    status: String(row.status),
    description: String(row.description || ''),
    archivedAt: String(row.archived_at || '')
  }
}

function mapRoleGrant(row: Record<string, unknown>): RoleGrantItem {
  return {
    id: Number(row.id),
    roleCode: String(row.code),
    roleName: String(row.name),
    description: String(row.description || ''),
    menuPermissions: JSON.parse(String(row.menu_permissions || '[]')),
    actionPermissions: JSON.parse(String(row.action_permissions || '[]')),
    dataScope: normalizeDataScope(String(row.data_scope || 'self')),
    enabled: Number(row.enabled ?? 1) === 1,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || '')
  }
}

function normalizeDataScope(value: string): RoleGrantItem['dataScope'] {
  if (value === 'all' || value === 'board' || value === 'self') return value
  return 'self'
}

function getCycleStatusActions(roleCode: string, status: string) {
  if (roleCode !== 'R_SUPER') return []
  const actions = [
    { status: 'notStarted', label: '设为未开始' },
    { status: 'filling', label: '开启填报' },
    { status: 'reviewing', label: '进入审核' },
    { status: 'completed', label: '完成周期' },
    { status: 'archived', label: '归档周期' }
  ]
  return actions.filter((item) => item.status !== status)
}

async function getReviewLogsForActor(actor: { user: AccountUser; permissions: AccountPermission }) {
  const rows = await queryRows(`
    SELECT rl.*, tu.display_name AS target_name, ou.display_name AS operator_name, tu.board_id, b.name AS board_name
    FROM review_logs rl
    INNER JOIN users tu ON tu.id = rl.target_user_id
    INNER JOIN users ou ON ou.id = rl.operator_user_id
    LEFT JOIN boards b ON b.id = tu.board_id
    ORDER BY rl.operated_at DESC
  `)
  return rows
    .filter((row) => canSeeUserRow(actor, String(row.board_id || ''), Number(row.target_user_id)))
    .map((row) => ({
      id: Number(row.id),
      cycleId: String(row.cycle_id),
      recordType: String(row.record_type),
      recordId: Number(row.record_id),
      targetUserId: Number(row.target_user_id),
      targetName: String(row.target_name),
      operatorUserId: Number(row.operator_user_id),
      operatorName: String(row.operator_name),
      boardName: String(row.board_name || ''),
      action: String(row.action),
      comment: String(row.comment || ''),
      operatedAt: String(row.operated_at)
    }))
}

async function getBoardResponsibilityConfig() {
  const rows = await queryRows(`
    SELECT b.*,
           lu.display_name AS leader_name,
           mu.display_name AS manager_name,
           ou.display_name AS office_coordinator_name
    FROM boards b
    LEFT JOIN users lu ON lu.id = b.leader_user_id
    LEFT JOIN users mu ON mu.id = b.manager_user_id
    LEFT JOIN users ou ON ou.id = b.office_coordinator_user_id
    ORDER BY b.sort_order ASC
  `)
  return rows.map((row) => ({
    boardId: String(row.id),
    boardName: String(row.name),
    leaderUserId: row.leader_user_id ? Number(row.leader_user_id) : undefined,
    leaderName: String(row.leader_name || ''),
    managerUserId: row.manager_user_id ? Number(row.manager_user_id) : undefined,
    managerName: String(row.manager_name || ''),
    officeCoordinatorUserId: row.office_coordinator_user_id
      ? Number(row.office_coordinator_user_id)
      : undefined,
    officeCoordinatorName: String(row.office_coordinator_name || '')
  }))
}
function buildMyAssessmentGroups(options: {
  actor: { user: AccountUser; permissions: AccountPermission }
  visibleBoards: Array<{ id: string; name: string }>
  assessmentItems: Array<{
    id: string
    title: string
    standard: string
    boardId: string
    moduleName: string
    isRedline?: boolean
  }>
  tasks: Array<{
    id: string
    title: string
    source: string
    boardId: string
    deadline: string
    owner: string
  }>
  assessmentRecords: Record<
    string,
    { status: string; workflowStatus?: string; remark?: string; rectification?: string }
  >
  taskRecords: Record<string, { status: string; workflowStatus?: string; remark?: string }>
  rectifications: Array<{
    id: string
    source: string
    boardName: string
    description: string
    owner: string
    rectification: string
    status: string
  }>
  currentCycle: { submitDeadline: string }
}) {
  const boardNameMap = Object.fromEntries(
    options.visibleBoards.map((board) => [board.id, board.name])
  )
  const groups = createEmptyMyAssessmentGroups()

  options.assessmentItems.forEach((item) => {
    const draft = options.assessmentRecords[item.id]
    const workflowStatus = normalizeWorkflowStatus(draft?.workflowStatus)
    const groupKey = resolveMyGroupKey(workflowStatus)
    groups[groupKey].push({
      id: `my-assessment-${item.id}`,
      title: item.title,
      description: item.standard,
      source: 'assessment',
      boardId: item.boardId,
      boardName: boardNameMap[item.boardId] ?? item.moduleName,
      owner: options.actor.user.displayName,
      deadline: options.currentCycle.submitDeadline,
      priority:
        item.isRedline || workflowStatus === 'returned'
          ? 'urgent'
          : workflowStatus === 'submitted' || workflowStatus === 'rectifying'
            ? 'warning'
            : 'normal',
      workflowStatus,
      actionText: getMyActionText(workflowStatus)
    })
  })

  options.tasks.forEach((task) => {
    const draft = options.taskRecords[task.id]
    const workflowStatus = normalizeWorkflowStatus(draft?.workflowStatus)
    const groupKey = resolveMyGroupKey(workflowStatus)
    groups[groupKey].push({
      id: `my-task-${task.id}`,
      title: task.title,
      description: `${task.source} · ${task.owner}`,
      source: 'task',
      boardId: task.boardId,
      boardName: boardNameMap[task.boardId] ?? '本周任务',
      owner: options.actor.user.displayName,
      deadline: task.deadline,
      priority:
        workflowStatus === 'returned'
          ? 'urgent'
          : workflowStatus === 'submitted'
            ? 'warning'
            : 'normal',
      workflowStatus,
      actionText: getMyActionText(workflowStatus)
    })
  })

  options.rectifications.forEach((item) => {
    const workflowStatus =
      item.status === '已销号' ? 'closed' : item.status === '整改中' ? 'rectifying' : 'returned'
    const groupKey = resolveMyGroupKey(workflowStatus)
    groups[groupKey].push({
      id: `my-rectification-${item.id}`,
      title: item.description,
      description: item.rectification || item.source,
      source: 'rectification',
      boardId: options.actor.user.boardId,
      boardName: item.boardName,
      owner: item.owner,
      deadline: options.currentCycle.submitDeadline,
      priority: workflowStatus === 'closed' ? 'normal' : 'urgent',
      workflowStatus,
      actionText: workflowStatus === 'closed' ? '已销号' : '处理整改'
    })
  })

  return groups
}

function createEmptyMyAssessmentGroups() {
  return {
    pending: [],
    reviewing: [],
    returned: [],
    rectifying: [],
    completed: []
  } as Record<
    'pending' | 'reviewing' | 'returned' | 'rectifying' | 'completed',
    Array<Record<string, string>>
  >
}

function buildMyTodoSummary(groups: ReturnType<typeof createEmptyMyAssessmentGroups>) {
  return {
    pending: groups.pending.length,
    reviewing: groups.reviewing.length,
    returned: groups.returned.length,
    rectifying: groups.rectifying.length,
    completed: groups.completed.length
  }
}

function normalizeWorkflowStatus(status?: string) {
  if (
    status === 'submitted' ||
    status === 'approved' ||
    status === 'returned' ||
    status === 'rectifying' ||
    status === 'closed'
  )
    return status
  return 'draft'
}

function resolveMyGroupKey(status: string) {
  if (status === 'submitted') return 'reviewing'
  if (status === 'returned') return 'returned'
  if (status === 'rectifying') return 'rectifying'
  if (status === 'approved' || status === 'closed') return 'completed'
  return 'pending'
}

function getMyActionText(status: string) {
  if (status === 'submitted') return '等待审核'
  if (status === 'returned') return '补充后重交'
  if (status === 'rectifying') return '继续整改'
  if (status === 'approved') return '已通过'
  if (status === 'closed') return '已销号'
  return '去处理'
}

function ensureEditableRecordWorkflow(workflowStatus: string, label: string) {
  if (workflowStatus === 'submitted') throw new Error(`${label}已提交审核，不能直接修改`)
  if (workflowStatus === 'approved') throw new Error(`${label}已审核通过，不能直接修改`)
  if (workflowStatus === 'closed') throw new Error(`${label}已销号归档，不能直接修改`)
}

async function resolveRecordTarget(
  actor: { user: AccountUser; permissions: AccountPermission },
  targetUserId?: number
) {
  if (!targetUserId || targetUserId === actor.user.id) return actor.user
  ensureReviewer(actor)
  const target = await findUserById(targetUserId)
  if (!target || target.status !== 'active') throw new Error('员工不存在或已停用')
  ensureCanReviewBoard(actor, target.boardId)
  return target
}

async function ensureCycleCanBeEditedByEmployee(
  cycle: { id: string; status: string },
  userId: number
) {
  if (cycle.status === 'archived') throw new Error('当前周期已归档，不能继续修改')
  const confirmed = await hasPerformanceConfirmation(cycle.id, userId, 'employee')
  if (confirmed) throw new Error('本人已电子确认本周期绩效结果，不能继续修改')
}

async function ensureCycleIsWritable(cycleId: string) {
  const cycle = (
    await queryRows('SELECT status FROM assessment_cycles WHERE id = $id LIMIT 1', {
      $id: cycleId
    })
  )[0]
  if (String(cycle?.status || '') === 'archived') throw new Error('当前周期已归档，不能继续修改')
}

async function hasPerformanceConfirmation(cycleId: string, userId: number, role: string) {
  const row = (
    await queryRows(
      'SELECT id FROM performance_confirmations WHERE cycle_id = $cycleId AND user_id = $userId AND role = $role LIMIT 1',
      { $cycleId: cycleId, $userId: userId, $role: role }
    )
  )[0]
  return Boolean(row)
}

function resolveEditableWorkflowStatus(workflowStatus: string) {
  if (workflowStatus === 'rectifying') return 'rectifying'
  return 'draft'
}

async function closeDraftRectification(
  sourceType: 'assessment' | 'task',
  recordId: number,
  workflowStatus: string
) {
  if (workflowStatus === 'rectifying') return
  await runSql(
    `UPDATE rectifications SET status = '已销号', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE source_type = $sourceType AND source_record_id = $recordId AND status != '已销号'`,
    { $sourceType: sourceType, $recordId: recordId }
  )
}

async function reopenRectificationForRectifyingRecord(
  sourceType: 'assessment' | 'task',
  recordId: number
) {
  await runSql(
    `UPDATE rectifications SET status = '整改中', closed_by = NULL, closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE source_type = $sourceType AND source_record_id = $recordId AND status = '已销号'`,
    { $sourceType: sourceType, $recordId: recordId }
  )
}

async function upsertRectification(options: {
  cycleId: string
  sourceType: string
  sourceRecordId: number
  boardId: string
  ownerUserId: number
  description: string
  rectification: string
  deadline?: string
  evidenceText?: string
}) {
  await runSql(
    `
    INSERT INTO rectifications (cycle_id, source_type, source_record_id, board_id, owner_user_id, description, rectification, deadline, evidence_text, status, updated_at)
    VALUES ($cycleId, $sourceType, $sourceRecordId, $boardId, $ownerUserId, $description, $rectification, $deadline, $evidenceText, '待整改', CURRENT_TIMESTAMP)
    ON CONFLICT(source_type, source_record_id) DO UPDATE SET
      rectification = excluded.rectification,
      deadline = excluded.deadline,
      evidence_text = excluded.evidence_text,
      status = CASE WHEN rectifications.status = '已销号' THEN '待整改' ELSE rectifications.status END,
      updated_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: options.cycleId,
      $sourceType: options.sourceType,
      $sourceRecordId: options.sourceRecordId,
      $boardId: options.boardId,
      $ownerUserId: options.ownerUserId,
      $description: options.description,
      $rectification: options.rectification,
      $deadline: options.deadline || '',
      $evidenceText: options.evidenceText || ''
    }
  )
}

async function insertReviewLog(
  cycleId: string,
  recordType: string,
  recordId: number,
  targetUserId: number,
  operatorUserId: number,
  action: string,
  comment: string
) {
  await runSql(
    `INSERT INTO review_logs (cycle_id, record_type, record_id, target_user_id, operator_user_id, action, comment) VALUES ($cycleId, $recordType, $recordId, $targetUserId, $operatorUserId, $action, $comment)`,
    {
      $cycleId: cycleId,
      $recordType: recordType,
      $recordId: recordId,
      $targetUserId: targetUserId,
      $operatorUserId: operatorUserId,
      $action: action,
      $comment: comment
    }
  )
}

function ensureCanAccessBoard(
  actor: { user: AccountUser; permissions: AccountPermission },
  boardId: string
): void {
  if (actor.permissions.dataScope === 'all') return
  if (boardId === 'allStaff' || boardId === actor.user.boardId) return
  throw new Error('无权访问该板块数据')
}

function ensureCanReviewBoard(
  actor: { user: AccountUser; permissions: AccountPermission },
  boardId: string
): void {
  if (actor.permissions.dataScope === 'all') return
  if (actor.permissions.dataScope === 'board' && boardId === actor.user.boardId) return
  throw new Error('无权审核该板块数据')
}

function ensureReviewer(actor: { permissions: AccountPermission }): void {
  if (actor.permissions.roleCode === 'R_EMPLOYEE') throw new Error('普通员工无审核权限')
}

function canSeeUserRow(
  actor: { user: AccountUser; permissions: AccountPermission },
  boardId: string,
  ownerUserId: number
): boolean {
  if (actor.permissions.dataScope === 'all') return true
  if (actor.permissions.dataScope === 'board')
    return boardId === actor.user.boardId || boardId === 'allStaff'
  return ownerUserId === actor.user.id
}

function mapAccountUser(row: Record<string, unknown>): AccountUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    displayName: String(row.display_name),
    employeeNo: String(row.employee_no),
    email: String(row.email),
    status: String(row.status) === 'disabled' ? 'disabled' : 'active',
    boardId: String(row.board_id || 'medical'),
    position: String(row.position || ''),
    mobile: String(row.mobile || ''),
    elderlyFriendly: Number(row.elderly_friendly || 0) === 1
  }
}

function mapEmployee(user: AccountUser, roleCode: string) {
  return {
    id: `user-${user.id}`,
    userId: user.id,
    name: user.displayName,
    employeeNo: user.employeeNo,
    boardId: user.boardId,
    roleId: getEmployeeRoleId(roleCode),
    systemRole: roleCode,
    position: user.position,
    mobile: user.mobile,
    status: user.status === 'active' ? 'active' : 'inactive',
    elderlyFriendly: user.elderlyFriendly
  }
}

function getEmployeeRoleId(roleCode: string) {
  if (roleCode === 'R_SUPER') return 'superAdmin'
  if (roleCode === 'R_LEADER') return 'leader'
  if (roleCode === 'R_MANAGER') return 'medicalDirector'
  return 'employee'
}

function mapAssessmentRecordDraft(row: Record<string, unknown>) {
  return {
    recordId: Number(row.id),
    status: String(row.status),
    remark: String(row.remark || ''),
    rectification: String(row.rectification || ''),
    workflowStatus: String(row.workflow_status || 'draft'),
    submittedAt: String(row.submitted_at || ''),
    reviewedAt: String(row.reviewed_at || ''),
    reviewer: String(row.reviewer || ''),
    reviewComment: String(row.review_comment || '')
  }
}

function mapTaskRecordDraft(row: Record<string, unknown>) {
  return {
    recordId: Number(row.id),
    status: String(row.status),
    remark: String(row.remark || ''),
    evidenceText: String(row.evidence_text || ''),
    workflowStatus: String(row.workflow_status || 'draft'),
    submittedAt: String(row.submitted_at || ''),
    reviewedAt: String(row.reviewed_at || ''),
    reviewer: String(row.reviewer || ''),
    reviewComment: String(row.review_comment || '')
  }
}

async function queryRows(
  sql: string,
  params: Record<string, unknown> = {}
): Promise<Array<Record<string, unknown>>> {
  const database = await getDatabase()
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows: Array<Record<string, unknown>> = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

async function runSql(sql: string, params: Record<string, unknown> = {}): Promise<void> {
  const database = await getDatabase()
  runPrepared(database, sql, params)
}

function runPrepared(database: Database, sql: string, params: Record<string, unknown> = {}): void {
  const stmt = database.prepare(sql)
  stmt.run(params)
  stmt.free()
}

function ensureColumn(
  database: Database,
  tableName: string,
  columnName: string,
  definition: string
): void {
  const result = database.exec(`PRAGMA table_info(${tableName})`)
  const exists = result[0]?.values.some((row) => row[1] === columnName)
  if (!exists) database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}
