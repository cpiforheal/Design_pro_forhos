import request from '@/utils/http'
import type {
  MedicalRecordCase,
  MedicalRecordDoctor,
  MedicalRecordSavePayload
} from '@/types/medicalRecord'

interface MedicalRecordRequestOptions {
  showErrorMessage?: boolean
  showSuccessMessage?: boolean
}

export function fetchMedicalRecordCases(options: MedicalRecordRequestOptions = {}) {
  return request.get<MedicalRecordCase[]>({
    url: '/api/medical-records',
    showErrorMessage: options.showErrorMessage
  })
}

export function fetchMedicalRecordDoctors(options: MedicalRecordRequestOptions = {}) {
  return request.get<MedicalRecordDoctor[]>({
    url: '/api/medical-records/doctors',
    showErrorMessage: options.showErrorMessage
  })
}

export function createMedicalRecordCase(params: MedicalRecordSavePayload) {
  return request.post<MedicalRecordCase>({
    url: '/api/medical-records',
    params,
    showSuccessMessage: true
  })
}

export function updateMedicalRecordCase(
  id: number,
  params: MedicalRecordSavePayload,
  options: MedicalRecordRequestOptions = {}
) {
  return request.put<MedicalRecordCase>({
    url: `/api/medical-records/${id}`,
    params,
    showSuccessMessage: options.showSuccessMessage ?? true,
    showErrorMessage: options.showErrorMessage
  })
}

export function approveMedicalRecordCase(id: number) {
  return request.post<MedicalRecordCase>({
    url: `/api/medical-records/${id}/approve`,
    showSuccessMessage: true
  })
}
