import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  closeRectification,
  confirmPerformance,
  createAccountUser,
  createManagedBoardTask,
  findUserById,
  findUserByUsername,
  getAssessmentBootstrap,
  getAssessmentAssist,
  getAssessmentExport,
  getDatabase,
  getReviewLogs,
  getUserPermissions,
  listBoardResponsibilityConfig,
  listAccountUsers,
  listAssessmentCycles,
  listAssessmentTemplates,
  listManagedBoardTasks,
  listPerformanceResults,
  listRoleGrants,
  managerConfirmPerformance,
  publishManagedBoardTask,
  reviewRecord,
  createAssessmentCycle,
  saveAssessmentRecord,
  saveTaskRecord,
  submitAssessment,
  updateAccountUserProfile,
  updateAccountUserRole,
  updateAssessmentCycle,
  updateAssessmentCycleStatus,
  updateAssessmentTemplate,
  updateBoardResponsibilityConfig,
  updateRoleGrant,
  updateManagedBoardTask
} from './sqlite'

const app = express()
const port = Number(process.env.HOSPITAL_API_PORT || 3010)
const jwtSecret = process.env.HOSPITAL_JWT_SECRET || 'hospital-assessment-local-secret'

interface JwtPayload {
  userId: number
  username: string
}

function hasBodyKey(body: unknown, key: string): body is Record<string, unknown> {
  return Boolean(
    body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, key)
  )
}

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    code: 200,
    msg: 'ok',
    data: { service: 'hospital-assessment-api', database: 'sqlite' }
  })
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { userName, password } = req.body as { userName?: string; password?: string }
    if (!userName || !password) {
      res.status(400).json({ code: 400, msg: '请输入账号和密码', data: null })
      return
    }
    const user = await findUserByUsername(userName.trim())
    if (!user || user.status !== 'active') {
      res.status(401).json({ code: 401, msg: '账号不存在或已停用', data: null })
      return
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash)
    if (!validPassword) {
      res.status(401).json({ code: 401, msg: '账号或密码错误', data: null })
      return
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, {
      expiresIn: '8h'
    })
    const refreshToken = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, {
      expiresIn: '7d'
    })
    res.json({ code: 200, msg: '登录成功', data: { token: `Bearer ${token}`, refreshToken } })
  } catch (error) {
    next(error)
  }
})

app.get('/api/user/info', authMiddleware, async (req, res, next) => {
  try {
    const user = await findUserById(req.auth!.userId)
    if (!user || user.status !== 'active') {
      res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', data: null })
      return
    }
    const permissions = await getUserPermissions(user.id)
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        buttons: permissions.actionPermissions,
        roles: [permissions.roleCode],
        userId: user.id,
        userName: user.displayName,
        email: user.email,
        avatar: '',
        employeeNo: user.employeeNo,
        boardId: user.boardId,
        position: user.position,
        mobile: user.mobile,
        elderlyFriendly: user.elderlyFriendly,
        dataScope: permissions.dataScope,
        menuPermissions: permissions.menuPermissions
      }
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/users', authMiddleware, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listAccountUsers() })
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/users', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      username,
      password,
      displayName,
      employeeNo,
      email,
      roleCode,
      boardId,
      position,
      mobile,
      elderlyFriendly
    } = req.body as Record<string, string | boolean>
    if (!username || !password || !displayName || !employeeNo || !email || !roleCode) {
      res
        .status(400)
        .json({ code: 400, msg: '请完整填写账号、密码、姓名、工号、邮箱和权限角色', data: null })
      return
    }
    await createAccountUser({
      username: String(username),
      password: String(password),
      displayName: String(displayName),
      employeeNo: String(employeeNo),
      email: String(email),
      roleCode: String(roleCode),
      boardId: boardId ? String(boardId) : undefined,
      position: position ? String(position) : undefined,
      mobile: mobile ? String(mobile) : undefined,
      elderlyFriendly: typeof elderlyFriendly === 'boolean' ? elderlyFriendly : undefined
    })
    res.json({ code: 200, msg: '账号已创建', data: null })
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/users/:id/role', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    const { roleCode } = req.body as { roleCode?: string }
    if (!userId || !roleCode) {
      res.status(400).json({ code: 400, msg: '请选择账号和权限角色', data: null })
      return
    }
    await updateAccountUserRole(userId, roleCode)
    res.json({ code: 200, msg: '权限已更新', data: null })
  } catch (error) {
    next(error)
  }
})

app.put(
  '/api/admin/users/:id/profile',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id)
      if (!userId) {
        res.status(400).json({ code: 400, msg: '请选择要维护的员工账号', data: null })
        return
      }
      await updateAccountUserProfile(userId, {
        displayName: hasBodyKey(req.body, 'displayName') ? String(req.body.displayName) : undefined,
        employeeNo: hasBodyKey(req.body, 'employeeNo') ? String(req.body.employeeNo) : undefined,
        email: hasBodyKey(req.body, 'email') ? String(req.body.email) : undefined,
        boardId: hasBodyKey(req.body, 'boardId') ? String(req.body.boardId) : undefined,
        position: hasBodyKey(req.body, 'position') ? String(req.body.position) : undefined,
        mobile: hasBodyKey(req.body, 'mobile') ? String(req.body.mobile) : undefined,
        status:
          req.body.status === 'disabled'
            ? 'disabled'
            : req.body.status === 'active'
              ? 'active'
              : undefined,
        elderlyFriendly:
          typeof req.body.elderlyFriendly === 'boolean' ? req.body.elderlyFriendly : undefined
      })
      res.json({ code: 200, msg: '员工信息已更新', data: null })
    } catch (error) {
      next(error)
    }
  }
)

app.get('/api/admin/roles', authMiddleware, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listRoleGrants() })
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/roles/:id', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '角色权限已更新',
      data: await updateRoleGrant(Number(req.params.id), req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.get(
  '/api/admin/assessment/cycles',
  authMiddleware,
  requireSuperAdmin,
  async (_req, res, next) => {
    try {
      res.json({ code: 200, msg: 'ok', data: await listAssessmentCycles() })
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  '/api/admin/assessment/cycles',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      res.json({ code: 200, msg: '考核周期已创建', data: await createAssessmentCycle(req.body) })
    } catch (error) {
      next(error)
    }
  }
)

app.put(
  '/api/admin/assessment/cycles/:id',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      res.json({
        code: 200,
        msg: '考核截止时间已更新',
        data: await updateAssessmentCycle(req.params.id, req.body)
      })
    } catch (error) {
      next(error)
    }
  }
)

app.put(
  '/api/admin/assessment/cycles/:id/status',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const { status } = req.body as { status?: string }
      if (!status) {
        res.status(400).json({ code: 400, msg: '请选择周期状态', data: null })
        return
      }
      res.json({
        code: 200,
        msg: '周期状态已更新',
        data: await updateAssessmentCycleStatus(req.params.id, status)
      })
    } catch (error) {
      next(error)
    }
  }
)
app.get(
  '/api/admin/assessment/templates',
  authMiddleware,
  requireSuperAdmin,
  async (_req, res, next) => {
    try {
      res.json({ code: 200, msg: 'ok', data: await listAssessmentTemplates() })
    } catch (error) {
      next(error)
    }
  }
)

app.put(
  '/api/admin/assessment/templates/:id',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await updateAssessmentTemplate(req.params.id, req.body)
      res.json({ code: 200, msg: '考核模板已更新', data: null })
    } catch (error) {
      next(error)
    }
  }
)

app.get(
  '/api/admin/organization/boards',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      res.json({
        code: 200,
        msg: 'ok',
        data: await listBoardResponsibilityConfig(req.auth!.userId)
      })
    } catch (error) {
      next(error)
    }
  }
)

app.put(
  '/api/admin/organization/boards/:id',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      res.json({
        code: 200,
        msg: '组织责任配置已更新',
        data: await updateBoardResponsibilityConfig(req.auth!.userId, req.params.id, req.body)
      })
    } catch (error) {
      next(error)
    }
  }
)

app.get('/api/assessment/bootstrap', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await getAssessmentBootstrap(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/assessment/assist/:userId', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: 'ok',
      data: await getAssessmentAssist(req.auth!.userId, Number(req.params.userId))
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/records', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '考核记录已保存',
      data: await saveAssessmentRecord(req.auth!.userId, req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/tasks/records', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '任务记录已保存',
      data: await saveTaskRecord(req.auth!.userId, req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/submit', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: '本周期考核已提交', data: await submitAssessment(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/review/:recordType/:recordId', authMiddleware, async (req, res, next) => {
  try {
    const recordType = req.params.recordType === 'task' ? 'task' : 'assessment'
    res.json({
      code: 200,
      msg: '审核操作已完成',
      data: await reviewRecord(req.auth!.userId, recordType, Number(req.params.recordId), req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/rectifications/:id/close', authMiddleware, async (req, res, next) => {
  try {
    const { comment } = req.body as { comment?: string }
    res.json({
      code: 200,
      msg: '整改已销号',
      data: await closeRectification(req.auth!.userId, Number(req.params.id), comment)
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/assessment/review-logs', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await getReviewLogs(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/assessment/performance/results', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listPerformanceResults(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/performance/confirm', authMiddleware, async (req, res, next) => {
  try {
    const { comment } = req.body as { comment?: string }
    res.json({
      code: 200,
      msg: '绩效结果已确认',
      data: await confirmPerformance(req.auth!.userId, comment)
    })
  } catch (error) {
    next(error)
  }
})

app.post(
  '/api/assessment/performance/manager-confirm/:userId',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { comment } = req.body as { comment?: string }
      res.json({
        code: 200,
        msg: '负责人确认已完成',
        data: await managerConfirmPerformance(req.auth!.userId, Number(req.params.userId), comment)
      })
    } catch (error) {
      next(error)
    }
  }
)

app.get('/api/assessment/manager/tasks', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listManagedBoardTasks(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/manager/tasks', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '分管工作已保存为草稿',
      data: await createManagedBoardTask(req.auth!.userId, req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.put('/api/assessment/manager/tasks/:id', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '分管工作已更新',
      data: await updateManagedBoardTask(req.auth!.userId, req.params.id, req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/assessment/manager/tasks/:id/publish', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '分管工作已推送',
      data: await publishManagedBoardTask(req.auth!.userId, req.params.id)
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/assessment/export', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await getAssessmentExport(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : authorization
  if (!token) {
    res.status(401).json({ code: 401, msg: '未登录或登录已过期', data: null })
    return
  }
  try {
    req.auth = jwt.verify(token, jwtSecret) as JwtPayload
    next()
  } catch {
    res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', data: null })
  }
}

async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.auth?.userId
  if (!userId) {
    res.status(401).json({ code: 401, msg: '未登录或登录已过期', data: null })
    return
  }
  const permissions = await getUserPermissions(userId)
  if (permissions.roleCode !== 'R_SUPER') {
    res.status(403).json({ code: 403, msg: '仅超级管理员可执行此操作', data: null })
    return
  }
  next()
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  console.error('[Hospital API] 服务异常:', error)
  res.status(500).json({
    code: 500,
    msg: error instanceof Error ? error.message : '服务异常，请稍后重试',
    data: null
  })
})

await getDatabase()

app.listen(port, () => {
  console.log(`Hospital assessment API is running at http://localhost:${port}`)
  console.log('Default super admin: admin / admin123')
})

declare module 'express-serve-static-core' {
  interface Request {
    auth?: JwtPayload
  }
}
