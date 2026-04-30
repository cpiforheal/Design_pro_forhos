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
  position: string
  mobile: string
  elderlyFriendly: boolean
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

export interface SaveAssessmentRecordPayload {
  itemId: string
  status: 'completed' | 'pending' | 'na'
  remark?: string
  rectification?: string
}

export interface SaveTaskRecordPayload {
  taskId: string
  status: 'completed' | 'pending' | 'na'
  remark?: string
}

export interface ReviewActionPayload {
  action: 'approve' | 'return'
  comment?: string
}

export interface ManagerTaskPayload {
  boardId?: string
  title: string
  deadline: string
  owner: string
  enabled?: boolean
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
    SELECT u.*, r.code AS role_code, r.name AS role_name
    FROM users u
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
    position: String(row.position || ''),
    mobile: String(row.mobile || ''),
    elderlyFriendly: Number(row.elderly_friendly || 0) === 1
  }))
}

export async function createAccountUser(payload: CreateAccountPayload): Promise<void> {
  const database = await getDatabase()
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
  runPrepared(database, 'DELETE FROM user_roles WHERE user_id = $userId', { $userId: userId })
  runPrepared(
    database,
    'INSERT INTO user_roles (user_id, role_id) SELECT $userId, id FROM roles WHERE code = $roleCode',
    { $userId: userId, $roleCode: roleCode }
  )
  persistDatabase()
}

export async function getUserPermissions(userId: number): Promise<AccountPermission> {
  const rows = await queryRows(
    `
    SELECT r.code AS role_code, r.action_permissions, r.menu_permissions, r.data_scope
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $userId
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
  const tasks = await getTasks(visibleBoardIds)
  const assessmentRecords = await getAssessmentRecordMap(currentCycle.id, actor.user.id)
  const taskRecords = await getTaskRecordMap(currentCycle.id, actor.user.id)
  const rectifications = await getRectifications(actor)
  const reviewTodoItems = await getReviewTodoItems(actor)
  const reviewLogs = await getReviewLogsForActor(actor)
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
    cycleStatusActions,
    myTodoSummary,
    myAssessmentGroups,
    summary: calculateSummary([...assessmentItems, ...tasks], {
      ...assessmentRecords,
      ...taskRecords
    })
  }
}

export async function saveAssessmentRecord(userId: number, payload: SaveAssessmentRecordPayload) {
  const actor = await requireActor(userId)
  const cycle = await getCurrentCycle()
  const item = (
    await queryRows('SELECT * FROM assessment_items WHERE id = $id AND enabled = 1 LIMIT 1', {
      $id: payload.itemId
    })
  )[0]
  if (!item) throw new Error('考核项不存在或已停用')
  ensureCanAccessBoard(actor, String(item.board_id))

  await runSql(
    `
    INSERT INTO assessment_records (cycle_id, user_id, item_id, status, remark, rectification, workflow_status, updated_at)
    VALUES ($cycleId, $userId, $itemId, $status, $remark, $rectification, 'draft', CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id, user_id, item_id) DO UPDATE SET
      status = excluded.status,
      remark = excluded.remark,
      rectification = excluded.rectification,
      workflow_status = CASE WHEN assessment_records.workflow_status IN ('submitted', 'approved', 'rectifying', 'closed') THEN assessment_records.workflow_status ELSE 'draft' END,
      updated_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: cycle.id,
      $userId: actor.user.id,
      $itemId: payload.itemId,
      $status: payload.status,
      $remark: payload.remark || '',
      $rectification: payload.rectification || ''
    }
  )

  const record = await getAssessmentRecord(cycle.id, actor.user.id, payload.itemId)
  if (record && payload.status === 'pending') {
    await upsertRectification({
      cycleId: cycle.id,
      sourceType: 'assessment',
      sourceRecordId: Number(record.id),
      boardId: String(item.board_id),
      ownerUserId: actor.user.id,
      description: String(item.title),
      rectification: payload.rectification || '待补充整改措施',
      deadline: cycle.submitDeadline,
      evidenceText: payload.evidenceText || ''
    })
  }
  if (record && payload.status !== 'pending') {
    await runSql(
      `UPDATE rectifications SET status = '已销号', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE source_type = 'assessment' AND source_record_id = $recordId AND status != '已销号'`,
      { $recordId: Number(record.id) }
    )
  }
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function saveTaskRecord(userId: number, payload: SaveTaskRecordPayload) {
  const actor = await requireActor(userId)
  const cycle = await getCurrentCycle()
  const task = (
    await queryRows('SELECT * FROM tasks WHERE id = $id AND enabled = 1 LIMIT 1', {
      $id: payload.taskId
    })
  )[0]
  if (!task) throw new Error('任务不存在或已停用')
  ensureCanAccessBoard(actor, String(task.board_id))

  await runSql(
    `
    INSERT INTO task_records (cycle_id, user_id, task_id, status, remark, workflow_status, updated_at)
    VALUES ($cycleId, $userId, $taskId, $status, $remark, 'draft', CURRENT_TIMESTAMP)
    ON CONFLICT(cycle_id, user_id, task_id) DO UPDATE SET
      status = excluded.status,
      remark = excluded.remark,
      workflow_status = CASE WHEN task_records.workflow_status IN ('submitted', 'approved', 'closed') THEN task_records.workflow_status ELSE 'draft' END,
      updated_at = CURRENT_TIMESTAMP
  `,
    {
      $cycleId: cycle.id,
      $userId: actor.user.id,
      $taskId: payload.taskId,
      $status: payload.status,
      $remark: payload.remark || ''
    }
  )
  const record = await getTaskRecord(cycle.id, actor.user.id, payload.taskId)
  if (record && payload.status === 'pending') {
    await upsertRectification({
      cycleId: cycle.id,
      sourceType: 'task',
      sourceRecordId: Number(record.id),
      boardId: String(task.board_id),
      ownerUserId: actor.user.id,
      description: String(task.title),
      rectification: payload.remark || '任务未完成，请补充整改说明',
      deadline: String(task.deadline || cycle.submitDeadline),
      evidenceText: ''
    })
  }
  if (record && payload.status !== 'pending') {
    await runSql(
      `UPDATE rectifications SET status = '已销号', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE source_type = 'task' AND source_record_id = $recordId AND status != '已销号'`,
      { $recordId: Number(record.id) }
    )
  }
  persistDatabase()
  return getAssessmentBootstrap(userId)
}

export async function submitAssessment(userId: number) {
  const actor = await requireActor(userId)
  const cycle = await getCurrentCycle()
  const boardIds = (await getVisibleBoardsForActor(actor)).map((board) => String(board.id))
  const items = await getAssessmentItems(boardIds)
  const tasks = await getTasks(boardIds)

  for (const item of items) {
    if (!(await getAssessmentRecord(cycle.id, actor.user.id, item.id))) {
      await saveAssessmentRecord(userId, { itemId: item.id, status: 'completed' })
    }
  }
  for (const task of tasks) {
    if (!(await getTaskRecord(cycle.id, actor.user.id, task.id))) {
      await saveTaskRecord(userId, { taskId: task.id, status: 'completed' })
    }
  }

  await runSql(
    `UPDATE assessment_records SET workflow_status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE cycle_id = $cycleId AND user_id = $userId`,
    { $cycleId: cycle.id, $userId: actor.user.id }
  )
  await runSql(
    `UPDATE task_records SET workflow_status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE cycle_id = $cycleId AND user_id = $userId`,
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
  ensureCanReviewBoard(actor, String(record.board_id))

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
  const maxSortRow = (await queryRows('SELECT MAX(sort_order) AS max_sort FROM tasks'))[0]
  await runSql(
    `
    INSERT INTO tasks (id, source, board_id, title, deadline, owner, sort_order, enabled)
    VALUES ($id, '分管负责人安排', $boardId, $title, $deadline, $owner, $sortOrder, $enabled)
  `,
    {
      $id: `manager-${boardId}-${Date.now()}`,
      $boardId: boardId,
      $title: payload.title.trim(),
      $deadline: payload.deadline,
      $owner: payload.owner.trim(),
      $sortOrder: Number(maxSortRow?.max_sort || 0) + 1,
      $enabled: payload.enabled ? 1 : 0
    }
  )
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
  await runSql(
    `
    UPDATE tasks
    SET board_id = $boardId, title = $title, deadline = $deadline, owner = $owner, enabled = $enabled
    WHERE id = $id AND source = '分管负责人安排'
  `,
    {
      $id: taskId,
      $boardId: boardId,
      $title: payload.title.trim(),
      $deadline: payload.deadline,
      $owner: payload.owner.trim(),
      $enabled:
        payload.enabled === undefined ? Number(current.enabled || 0) : payload.enabled ? 1 : 0
    }
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
  await runSql(
    `
    UPDATE assessment_cycles
    SET status = $status, archived_at = CASE WHEN $status = 'archived' THEN CURRENT_TIMESTAMP ELSE archived_at END
    WHERE id = $id
  `,
    { $status: status, $id: cycleId }
  )
  persistDatabase()
  return listAssessmentCycles()
}

export async function getReviewLogs(userId: number) {
  const actor = await requireActor(userId)
  return getReviewLogsForActor(actor)
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
      data_scope TEXT NOT NULL
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
      owner TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
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
      workflow_status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TEXT,
      reviewed_at TEXT,
      reviewer TEXT,
      review_comment TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cycle_id, user_id, task_id)
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
  `)

  ensureColumn(database, 'users', 'board_id', "TEXT NOT NULL DEFAULT 'medical'")
  ensureColumn(database, 'users', 'position', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'users', 'mobile', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'users', 'elderly_friendly', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(database, 'assessment_cycles', 'archived_at', 'TEXT')
  ensureColumn(database, 'assessment_items', 'score', 'REAL NOT NULL DEFAULT 1')
  ensureColumn(database, 'assessment_items', 'deduct_score', 'REAL NOT NULL DEFAULT 1')
  ensureColumn(database, 'assessment_items', 'require_evidence', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'rectifications', 'deadline', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'rectifications', 'review_comment', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'rectifications', 'evidence_text', "TEXT NOT NULL DEFAULT ''")

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
    description: String(row.description)
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
    color: String(row.color)
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
      isRedline: Number(row.is_redline) === 1
    }))
}

async function getTasks(boardIds: string[]) {
  const rows = await queryRows('SELECT * FROM tasks WHERE enabled = 1 ORDER BY sort_order ASC')
  return rows.filter((row) => boardIds.includes(String(row.board_id))).map(mapTaskItem)
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
  return rows.filter((row) => visibleBoardIds.includes(String(row.board_id))).map(mapTaskItem)
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
  return {
    id: String(row.id),
    source: String(row.source),
    boardId: String(row.board_id),
    title: String(row.title),
    deadline: String(row.deadline),
    owner: String(row.owner),
    enabled: Number(row.enabled || 0) === 1
  }
}

function ensureValidManagerTaskPayload(payload: ManagerTaskPayload): void {
  if (!payload.title?.trim()) throw new Error('请填写工作内容')
  if (!payload.deadline) throw new Error('请选择完成时限')
  if (!payload.owner?.trim()) throw new Error('请填写责任人')
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
  return Object.fromEntries(rows.map((row) => [String(row.task_id), mapTaskRecordDraft(row)]))
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
    WHERE ar.workflow_status IN ('submitted', 'returned', 'rectifying')
    ORDER BY ar.updated_at DESC
  `)
  const taskRows = await queryRows(`
    SELECT tr.id, tr.task_id, tr.status, tr.workflow_status, tr.remark, tr.user_id, tr.cycle_id, t.title, t.board_id, b.name AS board_name, u.display_name AS owner_name, t.deadline
    FROM task_records tr
    INNER JOIN tasks t ON t.id = tr.task_id
    INNER JOIN boards b ON b.id = t.board_id
    INNER JOIN users u ON u.id = tr.user_id
    WHERE tr.workflow_status IN ('submitted', 'returned')
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
  const taskTodos = taskRows
    .filter((row) => canSeeUserRow(actor, String(row.board_id), Number(row.user_id)))
    .map((row) => ({
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
      actionText: row.workflow_status === 'submitted' ? '立即审核' : '跟进任务'
    }))
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
      status = CASE WHEN rectifications.status = '已销号' THEN '整改中' ELSE rectifications.status END,
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
