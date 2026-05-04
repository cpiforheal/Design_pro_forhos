export type MedicalRecordStatus = 'draft' | 'submitted' | 'approved'

export type MedicalRecordValue = string | string[]

export type MedicalRecordStageKey =
  | 'frontDesk'
  | 'nursing'
  | 'doctor'
  | 'checks'
  | 'surgery'
  | 'discharge'
  | 'audit'

export const medicalRecordStageOptions: Array<{ label: string; value: MedicalRecordStageKey }> = [
  { label: '前台建档', value: 'frontDesk' },
  { label: '护理填写', value: 'nursing' },
  { label: '医生填写', value: 'doctor' },
  { label: '检查录入', value: 'checks' },
  { label: '手术记录', value: 'surgery' },
  { label: '出院整理', value: 'discharge' },
  { label: '负责人审核', value: 'audit' }
]

export interface MedicalRecordCase {
  id: number
  caseNo: string
  templateKey: string
  title: string
  status: MedicalRecordStatus
  assignedDoctorUserId?: number | null
  assignedDoctorName?: string
  values: Record<string, MedicalRecordValue>
  createdBy: number
  createdByName: string
  updatedBy: number
  updatedByName: string
  createdAt: string
  updatedAt: string
}

export interface MedicalRecordSavePayload {
  title: string
  status?: MedicalRecordStatus
  assignedDoctorUserId?: number | null
  values: Record<string, MedicalRecordValue>
}

export interface MedicalRecordDoctor {
  id: number
  name: string
  position: string
  boardId: string
}
