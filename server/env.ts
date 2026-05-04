export interface ServerEnvConfig {
  port: number
  isProduction: boolean
  jwtSecret: string
  corsOrigins: string[]
  taskEvidenceUploadDir: string
  taskEvidenceMaxSize: number
}

export function loadServerEnv(): ServerEnvConfig {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    port: Number(process.env.HOSPITAL_API_PORT || 3010),
    isProduction,
    jwtSecret: readRequiredSecret(
      'HOSPITAL_JWT_SECRET',
      'hospital-assessment-local-secret',
      isProduction
    ),
    corsOrigins: parseCsv(process.env.HOSPITAL_CORS_ORIGINS),
    taskEvidenceUploadDir:
      process.env.HOSPITAL_TASK_EVIDENCE_UPLOAD_DIR || 'server/data/uploads/task-evidence',
    taskEvidenceMaxSize: Number(process.env.HOSPITAL_TASK_EVIDENCE_MAX_SIZE || 20 * 1024 * 1024)
  }
}

function readRequiredSecret(name: string, fallback: string, isProduction: boolean): string {
  const value = process.env[name]?.trim()
  if (value) return value
  if (isProduction) throw new Error(`生产环境必须配置 ${name}`)
  console.warn(`[Hospital API] ${name} 未配置，仅允许本地开发使用默认值`)
  return fallback
}

function parseCsv(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
