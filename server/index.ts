import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import express, { NextFunction, Request, RequestHandler, Response } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { loadServerEnv } from './env'
import {
  addTaskEvidenceAttachment,
  closeRectification,
  confirmPerformance,
  createAccountUser,
  createManagedBoardTask,
  createMedicalRecordCase,
  findUserById,
  findUserByUsername,
  getAssessmentBootstrap,
  getAssessmentAssist,
  getAssessmentExport,
  getMedicalRecordCase,
  getTaskEvidenceAttachmentForDownload,
  getDatabase,
  getReviewLogs,
  getUserPermissions,
  listLoginLogs,
  listBoardResponsibilityConfig,
  listAccountUsers,
  listAssessmentCycles,
  listAssessmentTemplates,
  listManagedBoardTasks,
  listMedicalRecordCases,
  listMedicalRecordDoctors,
  listPerformanceResults,
  listRoleGrants,
  listStaffingPositions,
  managerConfirmPerformance,
  publishManagedBoardTask,
  recordLoginLog,
  reviewGroupConfirmPerformance,
  reviewRecord,
  createAssessmentCycle,
  deleteTaskEvidenceAttachment,
  resetAccountUserPassword,
  saveAssessmentRecord,
  saveTaskRecord,
  submitAssessment,
  updateAccountUserProfile,
  updateAccountUserRole,
  updateAssessmentCycle,
  updateAssessmentCycleStatus,
  updateAssessmentTemplate,
  updateBoardResponsibilityConfig,
  updateRectification,
  updateRoleGrant,
  updateStaffingPosition,
  updateManagedBoardTask,
  updateMedicalRecordCase
} from './sqlite'

const serverEnv = loadServerEnv()
const app = express()
const { port, isProduction, jwtSecret, corsOrigins } = serverEnv
const taskEvidenceUploadDir = path.resolve(process.cwd(), serverEnv.taskEvidenceUploadDir)
const taskEvidenceMaxSize = serverEnv.taskEvidenceMaxSize
const taskEvidenceAllowedTypes: Record<string, Set<string>> = {
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/png': new Set(['.png']),
  'image/gif': new Set(['.gif']),
  'image/webp': new Set(['.webp']),
  'application/pdf': new Set(['.pdf']),
  'application/msword': new Set(['.doc']),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': new Set(['.docx']),
  'application/vnd.ms-excel': new Set(['.xls']),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': new Set(['.xlsx']),
  'application/vnd.ms-powerpoint': new Set(['.ppt']),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': new Set(['.pptx']),
  'application/zip': new Set(['.zip']),
  'application/x-zip-compressed': new Set(['.zip']),
  'application/x-rar-compressed': new Set(['.rar']),
  'application/x-7z-compressed': new Set(['.7z'])
}
const taskEvidenceMimeTypes = new Set(Object.keys(taskEvidenceAllowedTypes))
const taskEvidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdirSync(taskEvidenceUploadDir, { recursive: true })
      callback(null, taskEvidenceUploadDir)
    },
    filename: (_req, file, callback) => {
      const ext = normalizeFileExtension(file.originalname)
      callback(null, `${Date.now()}-${randomUUID()}${ext}`)
    }
  }),
  limits: { fileSize: taskEvidenceMaxSize },
  fileFilter: (_req, file, callback) => {
    const ext = normalizeFileExtension(file.originalname)
    const allowedExtensions = taskEvidenceAllowedTypes[file.mimetype]
    if (taskEvidenceMimeTypes.has(file.mimetype) && allowedExtensions?.has(ext)) {
      callback(null, true)
      return
    }
    callback(
      new Error('仅支持图片、PDF、Office 文档和压缩包作为佐证材料，且文件扩展名需与类型一致')
    )
  }
})

export interface JwtPayload {
  userId: number
  username: string
}

function normalizeFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase()
}

function isSafeStoredPath(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  const uploadRoot = path.resolve(taskEvidenceUploadDir)
  return resolved === uploadRoot || resolved.startsWith(`${uploadRoot}${path.sep}`)
}

function hasBodyKey(body: unknown, key: string): body is Record<string, unknown> {
  return Boolean(
    body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, key)
  )
}

function readStringArrayBody(body: unknown, key: string): string[] | undefined {
  if (!hasBodyKey(body, key)) return undefined
  const value = body[key]
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }
      if (!isProduction && corsOrigins.length === 0) {
        callback(null, true)
        return
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('当前来源不允许访问医院考核 API'))
    },
    credentials: true
  })
)
app.use(express.json({ limit: '1mb' }))

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
    const username = userName?.trim() || ''
    if (!userName || !password) {
      await writeLoginLog(req, null, username, 'failed', '请输入账号和密码')
      res.status(400).json({ code: 400, msg: '请输入账号和密码', data: null })
      return
    }
    const user = await findUserByUsername(username)
    if (!user || user.status !== 'active') {
      await writeLoginLog(req, user?.id ?? null, username, 'failed', '账号不存在或已停用')
      res.status(401).json({ code: 401, msg: '账号不存在或已停用', data: null })
      return
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash)
    if (!validPassword) {
      await writeLoginLog(req, user.id, username, 'failed', '账号或密码错误')
      res.status(401).json({ code: 401, msg: '账号或密码错误', data: null })
      return
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, {
      expiresIn: '8h'
    })
    const refreshToken = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, {
      expiresIn: '7d'
    })
    await writeLoginLog(req, user.id, username, 'success', '登录成功')
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
        medicalRecordStages: user.medicalRecordStages,
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
    } = req.body as Record<string, string | boolean | string[]>
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
      elderlyFriendly: typeof elderlyFriendly === 'boolean' ? elderlyFriendly : undefined,
      medicalRecordStages: readStringArrayBody(req.body, 'medicalRecordStages')
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
        medicalRecordStages: readStringArrayBody(req.body, 'medicalRecordStages'),
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

app.put(
  '/api/admin/users/:id/password',
  authMiddleware,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id)
      const { password } = req.body as { password?: string }
      if (!userId || !password) {
        res.status(400).json({ code: 400, msg: '请输入新密码', data: null })
        return
      }
      await resetAccountUserPassword(userId, password)
      res.json({ code: 200, msg: '密码已重置', data: null })
    } catch (error) {
      next(error)
    }
  }
)

app.get('/api/admin/login-logs', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: 'ok',
      data: await listLoginLogs(Number(req.query.limit || 200))
    })
  } catch (error) {
    next(error)
  }
})

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
        data: await updateAssessmentCycle(String(req.params.id), req.body)
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
        data: await updateAssessmentCycleStatus(String(req.params.id), status)
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
      await updateAssessmentTemplate(String(req.params.id), req.body)
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
        data: await updateBoardResponsibilityConfig(
          req.auth!.userId,
          String(req.params.id),
          req.body
        )
      })
    } catch (error) {
      next(error)
    }
  }
)

app.get('/api/admin/staffing', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listStaffingPositions(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/staffing/:id', authMiddleware, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '定编定岗已更新',
      data: await updateStaffingPosition(req.auth!.userId, String(req.params.id), req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/medical-records', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listMedicalRecordCases(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/medical-records/doctors', authMiddleware, async (req, res, next) => {
  try {
    res.json({ code: 200, msg: 'ok', data: await listMedicalRecordDoctors(req.auth!.userId) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/medical-records', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '病历已创建',
      data: await createMedicalRecordCase(req.auth!.userId, req.body)
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/medical-records/:id', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: 'ok',
      data: await getMedicalRecordCase(req.auth!.userId, Number(req.params.id))
    })
  } catch (error) {
    next(error)
  }
})

app.put('/api/medical-records/:id', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '病历已保存',
      data: await updateMedicalRecordCase(req.auth!.userId, Number(req.params.id), req.body)
    })
  } catch (error) {
    next(error)
  }
})

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

app.post('/api/assessment/tasks/evidence', authMiddleware, (req, res, next) => {
  taskEvidenceUpload.single('file')(req, res, async (error) => {
    if (error) {
      const message =
        error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
          ? '佐证材料单个文件不能超过 20MB'
          : error instanceof Error
            ? error.message
            : '佐证材料上传失败'
      res.status(400).json({ code: 400, msg: message, data: null })
      return
    }
    const file = req.file
    try {
      const taskId = String(req.body.taskId || '')
      if (!taskId || !file) {
        if (file?.path) fs.unlink(file.path, () => {})
        res.status(400).json({ code: 400, msg: '请选择任务和佐证材料', data: null })
        return
      }
      res.json({
        code: 200,
        msg: '佐证材料已上传',
        data: await addTaskEvidenceAttachment(req.auth!.userId, {
          taskId,
          targetUserId: req.body.targetUserId ? Number(req.body.targetUserId) : undefined,
          originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          filePath: file.path
        })
      })
    } catch (uploadError) {
      if (file?.path) fs.unlink(file.path, () => {})
      next(uploadError)
    }
  })
})

app.delete('/api/assessment/tasks/evidence/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await deleteTaskEvidenceAttachment(req.auth!.userId, Number(req.params.id))
    if (result.filePath) fs.unlink(result.filePath, () => {})
    res.json({ code: 200, msg: '佐证材料已删除', data: result.bootstrap })
  } catch (error) {
    next(error)
  }
})

app.get('/api/assessment/tasks/evidence/:id/download', authMiddleware, async (req, res, next) => {
  try {
    const attachment = await getTaskEvidenceAttachmentForDownload(
      req.auth!.userId,
      Number(req.params.id)
    )
    if (!isSafeStoredPath(attachment.filePath)) {
      res.status(403).json({ code: 403, msg: '佐证材料路径不合法', data: null })
      return
    }
    if (!fs.existsSync(attachment.filePath)) {
      res.status(404).json({ code: 404, msg: '佐证材料文件不存在', data: null })
      return
    }
    res.download(attachment.filePath, path.basename(attachment.originalName))
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
  requireAnyActionPermission(['review:board', 'review:all']),
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

app.post(
  '/api/assessment/performance/review-group-confirm/:userId',
  authMiddleware,
  requireAnyActionPermission(['review:all']),
  async (req, res, next) => {
    try {
      const { comment, leaderFinalScore, leaderScoreComment } = req.body as {
        comment?: string
        leaderFinalScore?: number
        leaderScoreComment?: string
      }
      res.json({
        code: 200,
        msg: '考核小组复核已完成',
        data: await reviewGroupConfirmPerformance(req.auth!.userId, Number(req.params.userId), {
          comment,
          leaderFinalScore,
          leaderScoreComment
        })
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

app.post(
  '/api/assessment/manager/tasks',
  authMiddleware,
  requireAnyActionPermission(['review:board', 'review:all']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        code: 200,
        msg: '分管工作已保存为草稿',
        data: await createManagedBoardTask(req.auth!.userId, req.body)
      })
    } catch (error) {
      next(error)
    }
  }
)

app.put(
  '/api/assessment/manager/tasks/:id',
  authMiddleware,
  requireAnyActionPermission(['review:board', 'review:all']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        code: 200,
        msg: '分管工作已更新',
        data: await updateManagedBoardTask(req.auth!.userId, String(req.params.id), req.body)
      })
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  '/api/assessment/manager/tasks/:id/publish',
  authMiddleware,
  requireAnyActionPermission(['review:board', 'review:all']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        code: 200,
        msg: '分管工作已推送',
        data: await publishManagedBoardTask(req.auth!.userId, String(req.params.id))
      })
    } catch (error) {
      next(error)
    }
  }
)

app.put('/api/assessment/rectifications/:id', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      code: 200,
      msg: '整改闭环信息已更新',
      data: await updateRectification(req.auth!.userId, Number(req.params.id), req.body)
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

function requireAnyActionPermission(actionPermissions: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ code: 401, msg: '未登录或登录已过期', data: null })
      return
    }
    const permissions = await getUserPermissions(userId)
    const allowed =
      permissions.roleCode === 'R_SUPER' ||
      actionPermissions.some((permission) => permissions.actionPermissions.includes(permission))
    if (!allowed) {
      res.status(403).json({ code: 403, msg: '无权执行此操作', data: null })
      return
    }
    next()
  }
}

async function writeLoginLog(
  req: Request,
  userId: number | null,
  username: string,
  status: 'success' | 'failed',
  message: string
): Promise<void> {
  try {
    await recordLoginLog({
      userId,
      username,
      status,
      message,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || ''
    })
  } catch (error) {
    console.error('[Hospital API] 登录日志写入失败:', error)
  }
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  console.error('[Hospital API] 服务异常:', error)
  const message = error instanceof Error ? error.message : '服务异常，请稍后重试'
  const statusCode =
    /SQL|syntax|constraint|database|prepare|bind/i.test(message) || !(error instanceof Error)
      ? 500
      : 400
  res.status(statusCode).json({
    code: statusCode,
    msg: message,
    data: null
  })
})

await getDatabase()

app.listen(port, () => {
  console.log(`Hospital assessment API is running at http://localhost:${port}`)
  if (!isProduction) console.log('Default super admin: admin / admin123')
})
