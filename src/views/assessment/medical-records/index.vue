<template>
  <div class="medical-record-page">
    <section class="record-hero art-card">
      <div>
        <ElTag type="success" size="large">专病病历 MVP</ElTag>
        <h1>混合痔 / 肠镜 / 套扎病历协作填写</h1>
        <p>
          左侧按岗位填写结构化字段，右侧实时预览最终文档。最小收敛版已对齐混合痔、肠镜、套扎表格关键字段；真实身份信息可按院内授权脱敏填写。
        </p>
      </div>
      <div class="hero-actions">
        <ElButton size="large" :disabled="!canCreateCase" @click="createCase">新建病历</ElButton>
        <ElButton
          size="large"
          type="primary"
          :loading="saving"
          :disabled="!draft"
          @click="saveCase()"
        >
          保存
        </ElButton>
        <ElButton size="large" :disabled="!draft || !canSubmitCase" @click="submitCase">
          推送给指定审核医师
        </ElButton>
        <ElButton
          v-if="draft?.status === 'submitted'"
          size="large"
          type="success"
          :disabled="!canApproveCase"
          @click="approveCase"
        >
          审核医师确认完成
        </ElButton>
        <ElButton size="large" :disabled="!draft" @click="printPreview">导出 / 打印</ElButton>
      </div>
    </section>

    <ElRow :gutter="20">
      <ElCol :xl="5" :lg="6" :xs="24">
        <div class="art-card side-card">
          <div class="art-card-header">
            <div class="title">
              <h4>病历列表</h4>
              <p>按最近保存排序</p>
            </div>
          </div>
          <ElSkeleton v-if="loading" :rows="5" animated />
          <ElEmpty v-else-if="!cases.length" description="暂无病历，点击新建开始" />
          <div v-else class="case-list">
            <button
              v-for="item in cases"
              :key="item.id"
              class="case-item"
              :class="{ active: item.id === draft?.id }"
              type="button"
              @click="selectCase(item)"
            >
              <strong>{{ item.title }}</strong>
              <span>{{ item.caseNo }} · {{ statusLabel(item.status) }}</span>
              <span>指定医师：{{ item.assignedDoctorName || '未指定' }}</span>
              <small>{{ item.updatedAt || '刚刚保存' }}</small>
            </button>
          </div>
        </div>

        <ElAlert
          class="privacy-alert"
          type="warning"
          show-icon
          :closable="false"
          title="隐私提示"
          description="MVP 默认使用患者代号和住院号尾号。正式导出真实身份信息建议后续再单独加授权开关。"
        />
      </ElCol>

      <ElCol :xl="10" :lg="18" :xs="24">
        <div class="art-card form-card">
          <div class="art-card-header">
            <div class="title">
              <h4>填写表单</h4>
              <p>{{ currentProgress }} · 当前权限：{{ currentStageText }} · {{ saveStateText }}</p>
            </div>
            <ElTag v-if="draft" :type="statusType(draft.status)">
              {{ statusLabel(draft.status) }}
            </ElTag>
          </div>
          <ElAlert
            v-if="draft"
            class="permission-alert"
            type="info"
            show-icon
            :closable="false"
            :title="permissionAlertTitle"
            :description="permissionAlertDescription"
          />

          <ElEmpty v-if="!draft" description="请先新建或选择一份病历" />
          <template v-else>
            <ElForm label-position="top">
              <ElFormItem label="指定审核医师">
                <ElSelect
                  v-if="isSuperAdmin"
                  v-model="draft.assignedDoctorUserId"
                  class="w-full"
                  clearable
                  filterable
                  :disabled="isLockedByStatus()"
                  placeholder="请选择最终审核医师"
                  @change="syncAssignedDoctorName"
                >
                  <ElOption
                    v-for="doctor in doctorOptions"
                    :key="doctor.id"
                    :label="doctorLabel(doctor)"
                    :value="doctor.id"
                  />
                </ElSelect>
                <div v-else class="assigned-doctor-view">
                  <ElTag :type="draft.assignedDoctorName ? 'success' : 'warning'" effect="plain">
                    {{ draft.assignedDoctorName || '暂未指定，请联系超级管理员' }}
                  </ElTag>
                </div>
              </ElFormItem>

              <ElFormItem label="病历标题">
                <ElInput
                  v-model="draft.title"
                  :disabled="!canEditTitle"
                  placeholder="例如：混合痔套扎住院病历"
                />
              </ElFormItem>

              <ElCollapse v-model="activeGroups">
                <ElCollapseItem v-for="group in fieldGroups" :key="group.key" :name="group.key">
                  <template #title>
                    <div class="group-title">
                      <span>{{ group.title }}</span>
                      <ElTag size="small" effect="plain">{{ groupCompleted(group) }}</ElTag>
                    </div>
                  </template>

                  <ElRow :gutter="14">
                    <ElCol
                      v-for="field in group.fields"
                      :key="field.key"
                      :xl="field.wide ? 24 : 12"
                      :lg="field.wide ? 24 : 12"
                      :xs="24"
                    >
                      <ElFormItem>
                        <template #label>
                          <span>{{ field.label }}</span>
                          <small class="role-hint">{{
                            field.roleHint || stageText(field.allowedStages)
                          }}</small>
                          <ElTag
                            v-if="!canEditField(field)"
                            class="locked-tag"
                            size="small"
                            type="info"
                            effect="plain"
                          >
                            只读
                          </ElTag>
                        </template>
                        <ElSelect
                          v-if="field.type === 'select'"
                          v-model="draft.values[field.key]"
                          class="w-full"
                          clearable
                          filterable
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请选择'"
                        >
                          <ElOption
                            v-for="option in field.options"
                            :key="option"
                            :label="option"
                            :value="option"
                          />
                        </ElSelect>
                        <ElSelect
                          v-else-if="field.type === 'multi'"
                          v-model="draft.values[field.key]"
                          class="w-full"
                          multiple
                          clearable
                          filterable
                          collapse-tags
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '可多选'"
                        >
                          <ElOption
                            v-for="option in field.options"
                            :key="option"
                            :label="option"
                            :value="option"
                          />
                        </ElSelect>
                        <ElInput
                          v-else-if="field.type === 'textarea'"
                          :model-value="stringValue(field.key)"
                          type="textarea"
                          :rows="field.rows || 3"
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请输入'"
                          @update:model-value="setStringValue(field.key, $event)"
                        />
                        <ElDatePicker
                          v-else-if="field.type === 'datetime'"
                          :model-value="stringValue(field.key)"
                          class="w-full"
                          type="datetime"
                          format="YYYY-MM-DD HH:mm"
                          value-format="YYYY-MM-DD HH:mm"
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请选择日期时间'"
                          @update:model-value="setStringValue(field.key, $event || '')"
                        />
                        <ElDatePicker
                          v-else-if="field.type === 'date'"
                          :model-value="stringValue(field.key)"
                          class="w-full"
                          type="date"
                          format="YYYY-MM-DD"
                          value-format="YYYY-MM-DD"
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请选择日期'"
                          @update:model-value="setStringValue(field.key, $event || '')"
                        />
                        <ElTimePicker
                          v-else-if="field.type === 'time'"
                          :model-value="stringValue(field.key)"
                          class="w-full"
                          format="HH:mm"
                          value-format="HH:mm"
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请选择时间'"
                          @update:model-value="setStringValue(field.key, $event || '')"
                        />
                        <ElInputNumber
                          v-else-if="field.type === 'number'"
                          :model-value="numberValue(field.key)"
                          class="w-full"
                          :min="field.min"
                          :max="field.max"
                          :precision="field.precision"
                          :controls="false"
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请输入数字'"
                          @update:model-value="setStringValue(field.key, $event ?? '')"
                        />
                        <ElInput
                          v-else
                          :model-value="stringValue(field.key)"
                          :disabled="!canEditField(field)"
                          :placeholder="field.placeholder || '请输入'"
                          @update:model-value="setStringValue(field.key, $event)"
                        />
                      </ElFormItem>
                    </ElCol>
                  </ElRow>
                </ElCollapseItem>
              </ElCollapse>
            </ElForm>
          </template>
        </div>
      </ElCol>

      <ElCol :xl="9" :lg="24" :xs="24">
        <div class="art-card preview-card">
          <div class="art-card-header no-print">
            <div class="title">
              <h4>实时预览</h4>
              <p>空字段会显示“待填写”</p>
            </div>
          </div>

          <div v-if="draft" ref="previewRef" class="document-preview">
            <header class="doc-header">
              <img :src="hospitalLogo" alt="医院标识" />
              <div>
                <h2>固始中医肛肠医院</h2>
                <p>专病病历协作填写单</p>
              </div>
            </header>

            <h3>{{ draft.title || '混合痔 / 肠镜 / 套扎病历' }}</h3>
            <div class="doc-meta">
              <span>病历编号：{{ draft.caseNo || '保存后生成' }}</span>
              <span>状态：{{ statusLabel(draft.status) }}</span>
              <span>指定医师：{{ draft.assignedDoctorName || '未指定' }}</span>
              <span>最近更新：{{ draft.updatedAt || '未保存' }}</span>
            </div>

            <section v-for="group in previewGroups" :key="group.key" class="doc-section">
              <h4>{{ group.title }}</h4>
              <dl>
                <template v-for="field in group.fields" :key="field.key">
                  <dt>{{ field.label }}</dt>
                  <dd>{{ valueText(draft.values[field.key]) }}</dd>
                </template>
              </dl>
            </section>

            <footer class="doc-footer">
              <span>填写人：{{ draft.updatedByName || '当前账号' }}</span>
              <span>说明：本预览为内部协作稿，正式病历请经医生确认后导出。</span>
            </footer>
          </div>
          <ElEmpty v-else description="选择病历后显示预览" />
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { onBeforeRouteLeave, useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import hospitalLogo from '@imgs/common/logo1.jpg'
  import { useUserStore } from '@/store/modules/user'
  import {
    approveMedicalRecordCase,
    createMedicalRecordCase,
    fetchMedicalRecordCases,
    fetchMedicalRecordDoctors,
    updateMedicalRecordCase
  } from '@/api/medical-records'
  import type {
    MedicalRecordCase,
    MedicalRecordDoctor,
    MedicalRecordSavePayload,
    MedicalRecordStageKey as MedicalStageKey,
    MedicalRecordStatus,
    MedicalRecordValue
  } from '@/types/medicalRecord'
  import { medicalRecordStageOptions } from '@/types/medicalRecord'

  type FieldType =
    | 'text'
    | 'textarea'
    | 'select'
    | 'multi'
    | 'date'
    | 'datetime'
    | 'time'
    | 'number'

  interface MedicalField {
    key: string
    label: string
    type: FieldType
    options?: string[]
    placeholder?: string
    roleHint?: string
    allowedStages?: MedicalStageKey[]
    rows?: number
    wide?: boolean
    min?: number
    max?: number
    precision?: number
  }

  interface MedicalFieldGroup {
    key: string
    title: string
    fields: MedicalField[]
  }

  type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed'

  interface SaveCaseOptions {
    silent?: boolean
  }

  interface DraftBackup {
    draft: MedicalRecordCase
    savedAt: string
  }

  const DRAFT_BACKUP_PREFIX = 'medical-record-draft-'
  const LAST_DRAFT_ID_KEY = 'medical-record-last-draft-id'
  const AUTO_SAVE_DELAY = 1200

  const stageLabels = Object.fromEntries(
    medicalRecordStageOptions.map((stage) => [stage.value, stage.label])
  ) as Record<MedicalStageKey, string>

  const route = useRoute()
  const userStore = useUserStore()
  const cases = ref<MedicalRecordCase[]>([])
  const draft = ref<MedicalRecordCase | null>(null)
  const doctorOptions = ref<MedicalRecordDoctor[]>([])
  const previewRef = ref<HTMLElement | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const dirty = ref(false)
  const saveState = ref<SaveState>('idle')
  const autoSaveTimer = ref<number | null>(null)
  const activeGroups = ref(['privacy', 'admission', 'diagnosis'])
  let hydratingDraft = false
  let draftEditVersion = 0

  const fieldGroups: MedicalFieldGroup[] = [
    {
      key: 'privacy',
      title: '患者识别与入院基础',
      fields: [
        {
          key: 'patientAlias',
          label: '患者代号 / 姓名',
          type: 'text',
          placeholder: '可填患者代号；正式授权后填写姓名',
          allowedStages: ['frontDesk']
        },
        {
          key: 'medicalRecordNo',
          label: '住院号尾号 / 院内编号',
          type: 'text',
          placeholder: '仅填可内部识别的编号',
          allowedStages: ['frontDesk']
        },
        {
          key: 'gender',
          label: '性别',
          type: 'select',
          options: ['男', '女'],
          allowedStages: ['frontDesk']
        },
        {
          key: 'age',
          label: '年龄',
          type: 'number',
          min: 0,
          max: 120,
          allowedStages: ['frontDesk']
        },
        {
          key: 'ethnicity',
          label: '民族',
          type: 'text',
          placeholder: '如 汉族',
          allowedStages: ['frontDesk']
        },
        {
          key: 'birthDate',
          label: '出生年月',
          type: 'date',
          allowedStages: ['frontDesk']
        },
        {
          key: 'maritalStatus',
          label: '婚姻状况',
          type: 'select',
          options: ['未婚', '已婚', '丧偶', '离婚', '其他'],
          allowedStages: ['frontDesk']
        },
        {
          key: 'occupation',
          label: '职业',
          type: 'text',
          allowedStages: ['frontDesk']
        },
        {
          key: 'idCardMasked',
          label: '身份证号（脱敏）',
          type: 'text',
          placeholder: '建议仅保留后 4 位或院内脱敏编号',
          allowedStages: ['frontDesk']
        },
        {
          key: 'paymentType',
          label: '医疗付费方式',
          type: 'select',
          options: ['城乡居民基本医疗保险', '职工基本医疗保险', '自费', '异地医保', '其他'],
          allowedStages: ['frontDesk']
        },
        {
          key: 'contactName',
          label: '联系人姓名',
          type: 'text',
          allowedStages: ['frontDesk']
        },
        {
          key: 'contactRelation',
          label: '与患者关系',
          type: 'text',
          allowedStages: ['frontDesk']
        },
        {
          key: 'contactNote',
          label: '联系电话 / 地址备注（脱敏）',
          type: 'text',
          placeholder: '建议仅填尾号、乡镇村组或院内授权备注',
          wide: true,
          allowedStages: ['frontDesk']
        },
        {
          key: 'allergyHistory',
          label: '过敏史',
          type: 'select',
          options: ['无', '有（见备注）', '未询问'],
          allowedStages: ['frontDesk', 'nursing', 'doctor']
        },
        {
          key: 'bloodType',
          label: '血型 / Rh',
          type: 'text',
          placeholder: '如 A 型 Rh 阳性 / 未查',
          allowedStages: ['frontDesk', 'checks']
        }
      ]
    },
    {
      key: 'admission',
      title: '住院诊疗基础信息',
      fields: [
        {
          key: 'admissionTime',
          label: '入院时间',
          type: 'datetime',
          allowedStages: ['frontDesk', 'nursing']
        },
        { key: 'dischargeTime', label: '出院时间', type: 'datetime', allowedStages: ['discharge'] },
        {
          key: 'hospitalDays',
          label: '实际住院天数',
          type: 'number',
          min: 0,
          max: 365,
          allowedStages: ['discharge']
        },
        {
          key: 'admissionPath',
          label: '入院途径',
          type: 'select',
          options: ['门诊', '急诊', '转入', '其他医疗机构转入', '其他'],
          allowedStages: ['frontDesk']
        },
        {
          key: 'department',
          label: '入院 / 出院科室',
          type: 'select',
          options: ['肛肠科一病区', '肛肠科二病区', '门诊', '其他'],
          allowedStages: ['frontDesk', 'nursing']
        },
        { key: 'bedNo', label: '床位号', type: 'text', allowedStages: ['frontDesk', 'nursing'] },
        {
          key: 'treatmentType',
          label: '治疗类别',
          type: 'select',
          options: ['中医', '西医', '中西医结合'],
          allowedStages: ['doctor']
        }
      ]
    },
    {
      key: 'condition',
      title: '主诉、体征与专科检查',
      fields: [
        {
          key: 'chiefComplaint',
          label: '主诉',
          type: 'textarea',
          rows: 3,
          wide: true,
          placeholder: '症状 + 病程 + 加重史，由医生确认',
          allowedStages: ['doctor']
        },
        {
          key: 'temperature',
          label: '体温 T',
          type: 'number',
          min: 30,
          max: 45,
          precision: 1,
          placeholder: '℃',
          allowedStages: ['nursing']
        },
        {
          key: 'pulse',
          label: '脉搏 P',
          type: 'number',
          min: 20,
          max: 240,
          placeholder: '次/分',
          allowedStages: ['nursing']
        },
        {
          key: 'respiration',
          label: '呼吸 R',
          type: 'number',
          min: 5,
          max: 80,
          placeholder: '次/分',
          allowedStages: ['nursing']
        },
        {
          key: 'bloodPressure',
          label: '血压 BP',
          type: 'text',
          placeholder: '如 134/58mmHg',
          allowedStages: ['nursing']
        },
        {
          key: 'perianalSkin',
          label: '肛周皮肤情况',
          type: 'multi',
          options: ['潮红', '皲裂', '正常', '水肿', '其他'],
          allowedStages: ['doctor', 'nursing']
        },
        {
          key: 'sphincterTone',
          label: '肛门括约肌张力',
          type: 'select',
          options: ['正常', '紧张', '松弛'],
          allowedStages: ['doctor']
        },
        {
          key: 'externalHemorrhoid',
          label: '外痔位置',
          type: 'textarea',
          rows: 2,
          wide: true,
          allowedStages: ['doctor']
        },
        {
          key: 'internalHemorrhoid',
          label: '内痔位置 / 状态',
          type: 'textarea',
          rows: 2,
          wide: true,
          allowedStages: ['doctor']
        },
        {
          key: 'papilla',
          label: '肛乳头肥大位置',
          type: 'text',
          wide: true,
          allowedStages: ['doctor']
        }
      ]
    },
    {
      key: 'checks',
      title: '辅助检查核心结果',
      fields: [
        {
          key: 'wbc',
          label: '白细胞 WBC',
          type: 'text',
          placeholder: '如 7.12×10⁹/L',
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'plt',
          label: '血小板 PLT',
          type: 'text',
          placeholder: '如 179×10⁹/L',
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'hgb',
          label: '血红蛋白 HGB',
          type: 'text',
          placeholder: '如 138g/L',
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'glu',
          label: '血糖 GLU',
          type: 'text',
          placeholder: '如 6.02mmol/L',
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'ecg',
          label: '心电图结果',
          type: 'textarea',
          rows: 2,
          wide: true,
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'chestImage',
          label: '胸部 DR / CT 结果',
          type: 'textarea',
          rows: 2,
          wide: true,
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'gastroScope',
          label: '胃肠镜检查',
          type: 'multi',
          options: ['胃镜（结果手动填写）', '肠镜（结果手动填写）', '无', '其他'],
          wide: true,
          allowedStages: ['checks', 'doctor']
        },
        {
          key: 'gastroScopeResult',
          label: '胃肠镜结果补充',
          type: 'textarea',
          rows: 3,
          wide: true,
          placeholder: '如 胃角粘膜病变、慢性萎缩性胃炎、十二指肠溃疡、直肠炎等',
          allowedStages: ['checks', 'doctor']
        }
      ]
    },
    {
      key: 'diagnosis',
      title: '中西医诊断',
      fields: [
        {
          key: 'tcmDiagnosis',
          label: '中医主诊断',
          type: 'select',
          options: ['肛肠病（混合痔病）', '肛裂病', '痔病', '肛周脓肿病', '肛瘘病', '其他'],
          allowedStages: ['doctor']
        },
        {
          key: 'tcmSyndrome',
          label: '中医证型',
          type: 'select',
          options: ['湿热下注证', '血热肠燥证', '气滞血瘀证', '阴虚肠燥证', '其他'],
          allowedStages: ['doctor']
        },
        {
          key: 'westernMainDiagnosis',
          label: '西医主诊断',
          type: 'select',
          options: ['混合痔', '内痔', '外痔', '肛裂', '肛周脓肿', '肛瘘', '直肠息肉', '其他'],
          allowedStages: ['doctor']
        },
        {
          key: 'westernSecondaryDiagnosis',
          label: '西医次诊断',
          type: 'multi',
          options: [
            '肛乳头肥大',
            '肛门瘙痒症',
            '直肠炎',
            '慢性萎缩性胃炎',
            '十二指肠溃疡',
            '胃角粘膜病变',
            '其他'
          ],
          allowedStages: ['doctor']
        },
        {
          key: 'diagnosisFreeText',
          label: '医生诊断补充',
          type: 'textarea',
          rows: 4,
          wide: true,
          roleHint: '医生确认',
          placeholder: '用于填写非模板化诊断、证候辨析、伴随疾病或特殊说明',
          allowedStages: ['doctor']
        }
      ]
    },
    {
      key: 'operation',
      title: '手术相关信息',
      fields: [
        {
          key: 'operationDate',
          label: '手术日期',
          type: 'date',
          allowedStages: ['surgery', 'doctor']
        },
        {
          key: 'operationStartTime',
          label: '手术开始时间',
          type: 'time',
          allowedStages: ['surgery', 'doctor', 'nursing']
        },
        {
          key: 'operationEndTime',
          label: '手术结束时间',
          type: 'time',
          allowedStages: ['surgery', 'doctor', 'nursing']
        },
        {
          key: 'operationName',
          label: '手术名称',
          type: 'textarea',
          rows: 3,
          wide: true,
          placeholder: '如 一次性肛痔套扎吻合器内痔套扎治疗 + 外痔切除术',
          allowedStages: ['surgery', 'doctor']
        },
        {
          key: 'operatorName',
          label: '术者姓名',
          type: 'text',
          allowedStages: ['surgery', 'doctor']
        },
        {
          key: 'anesthesiaType',
          label: '麻醉方式',
          type: 'select',
          options: ['骶管内麻醉', '局部浸润麻醉', '腰麻', '静脉麻醉', '硬膜外麻醉', '其他'],
          allowedStages: ['surgery', 'doctor']
        },
        {
          key: 'anesthesiologist',
          label: '麻醉医师',
          type: 'text',
          allowedStages: ['surgery', 'doctor']
        },
        {
          key: 'instrumentNurse',
          label: '器械护士',
          type: 'text',
          allowedStages: ['surgery', 'nursing']
        },
        {
          key: 'bleedingVolume',
          label: '术中出血量',
          type: 'text',
          placeholder: '如 约 5ml',
          allowedStages: ['surgery', 'doctor', 'nursing']
        }
      ]
    },
    {
      key: 'discharge',
      title: '出院核心信息',
      fields: [
        {
          key: 'treatmentOutcome',
          label: '治疗效果',
          type: 'textarea',
          rows: 3,
          wide: true,
          placeholder: '按诊断逐项填写治愈 / 好转 / 未愈',
          allowedStages: ['discharge', 'doctor']
        },
        {
          key: 'reviewTime',
          label: '出院复查日期',
          type: 'date',
          allowedStages: ['discharge', 'doctor']
        },
        {
          key: 'dischargeAdvice',
          label: '出院医嘱 / 健康指导',
          type: 'textarea',
          rows: 4,
          wide: true,
          allowedStages: ['discharge', 'doctor', 'nursing']
        }
      ]
    }
  ]

  const previewGroups = computed(() =>
    fieldGroups.map((group) => ({
      ...group,
      fields: group.fields.filter((field) => field.key !== 'contactNote')
    }))
  )

  const totalFields = computed(() =>
    fieldGroups.reduce((total, group) => total + group.fields.length, 0)
  )
  const filledFields = computed(() => {
    if (!draft.value) return 0
    return fieldGroups.reduce(
      (total, group) =>
        total + group.fields.filter((field) => hasValue(draft.value?.values[field.key])).length,
      0
    )
  })
  const currentProgress = computed(() => `已填写 ${filledFields.value}/${totalFields.value} 项`)
  const saveStateText = computed(() => {
    if (!draft.value) return '未选择病历'
    if (saveState.value === 'saving') return '正在保存'
    if (saveState.value === 'dirty') return '有未保存修改'
    if (saveState.value === 'failed') return '保存失败，请检查后端服务'
    if (saveState.value === 'saved') return '已保存'
    return '等待填写'
  })
  const isSuperAdmin = computed(() => userStore.isSuperAdmin)
  const currentStages = computed<MedicalStageKey[]>(() => {
    if (isSuperAdmin.value) return medicalRecordStageOptions.map((stage) => stage.value)
    return (userStore.info.medicalRecordStages || []).filter(isMedicalStageKey)
  })
  const currentStageText = computed(() => stageText(currentStages.value) || '暂无可填写字段')
  const canCreateCase = computed(
    () =>
      isSuperAdmin.value ||
      currentStages.value.includes('frontDesk') ||
      currentStages.value.includes('audit')
  )
  const canEditTitle = computed(
    () =>
      Boolean(draft.value) &&
      !isLockedByStatus() &&
      (isSuperAdmin.value || currentStages.value.includes('frontDesk'))
  )
  const canSubmitCase = computed(
    () =>
      Boolean(draft.value) &&
      draft.value?.status === 'draft' &&
      !isLockedByStatus() &&
      Boolean(draft.value.assignedDoctorUserId) &&
      (isSuperAdmin.value || currentStages.value.length > 0)
  )
  const isAssignedDoctor = computed(
    () =>
      Boolean(draft.value?.assignedDoctorUserId) &&
      userStore.info.userId === draft.value?.assignedDoctorUserId
  )
  const canApproveCase = computed(
    () =>
      Boolean(draft.value) &&
      draft.value?.status === 'submitted' &&
      (isSuperAdmin.value || isAssignedDoctor.value)
  )
  const permissionAlertTitle = computed(() => {
    if (isSuperAdmin.value) return '超级管理员：可编辑全部病历字段'
    return `当前账号病历权限：${currentStageText.value}`
  })
  const permissionAlertDescription = computed(() => {
    if (draft.value?.status === 'approved' && !isSuperAdmin.value)
      return '该病历已审核，普通岗位只能查看，不能继续修改。'
    if (!currentStages.value.length)
      return '当前账号未绑定病历填写权限，请超级管理员在员工管理中设置“病历权限”。'
    if (!draft.value?.assignedDoctorUserId) return '该病历还没有指定审核医师，请超级管理员先指定。'
    if (draft.value.status === 'submitted') {
      return `病历已推送给指定审核医师 ${draft.value.assignedDoctorName || ''}，需医师点击“审核医师确认完成”后才算完成。`
    }
    return `带“只读”标记的字段由其他岗位填写，推送后由指定医师 ${draft.value.assignedDoctorName || ''} 最终确认完成。`
  })

  watch(
    draft,
    () => {
      if (hydratingDraft || !draft.value) return
      draftEditVersion += 1
      dirty.value = true
      saveState.value = 'dirty'
      writeDraftBackup()
      scheduleAutoSave()
    },
    { deep: true }
  )

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    loadDoctorOptions()
    loadCases()
  })

  onBeforeRouteLeave(async () => {
    await flushAutoSave()
  })

  onBeforeUnmount(() => {
    clearAutoSaveTimer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  async function loadCases() {
    loading.value = true
    try {
      cases.value = await fetchMedicalRecordCases({ showErrorMessage: false })
      if (cases.value.length) {
        const queryCaseId = Number(route.query.caseId)
        const lastDraftId = Number(window.sessionStorage.getItem(LAST_DRAFT_ID_KEY))
        const next =
          cases.value.find((item) => item.id === queryCaseId) ||
          cases.value.find((item) => item.id === lastDraftId) ||
          cases.value[0]
        await selectCase(next)
      }
    } catch {
      const localDraft = readLastDraftBackup()
      if (localDraft) {
        cases.value = [localDraft]
        setDraft(localDraft, { dirty: true })
        ElMessage.warning('病历接口暂时无法连接，已恢复本机临时草稿，请稍后手动保存')
      } else {
        ElMessage.error('病历数据加载失败，请确认后端 API 服务正在运行')
      }
    } finally {
      loading.value = false
    }
  }

  async function loadDoctorOptions() {
    if (!isSuperAdmin.value) return
    try {
      doctorOptions.value = await fetchMedicalRecordDoctors({ showErrorMessage: false })
    } catch {
      doctorOptions.value = []
    }
  }

  async function createCase() {
    if (!canCreateCase.value) {
      ElMessage.warning('当前岗位没有建档权限，请由前台或负责人创建病历')
      return
    }
    saving.value = true
    try {
      const next = await createMedicalRecordCase({
        title: `混合痔套扎病历 ${new Date().toISOString().slice(0, 10)}`,
        status: 'draft',
        values: defaultValues()
      })
      cases.value = [next, ...cases.value]
      setDraft(next)
    } finally {
      saving.value = false
    }
  }

  async function saveCase(options: SaveCaseOptions = {}) {
    if (!draft.value) return null
    const savingDraftId = draft.value.id
    const savingVersion = draftEditVersion
    clearAutoSaveTimer()
    saving.value = true
    saveState.value = 'saving'
    try {
      const saved = await updateMedicalRecordCase(draft.value.id, toPayload(draft.value), {
        showSuccessMessage: !options.silent,
        showErrorMessage: !options.silent
      })
      cases.value = [saved, ...cases.value.filter((item) => item.id !== saved.id)]
      if (draft.value?.id === savingDraftId && draftEditVersion === savingVersion) {
        setDraft(saved)
        clearDraftBackup(saved.id)
      } else if (draft.value?.id === saved.id) {
        dirty.value = true
        saveState.value = 'dirty'
        writeDraftBackup()
        scheduleAutoSave()
      }
      return saved
    } catch (error) {
      saveState.value = 'failed'
      throw error
    } finally {
      saving.value = false
    }
  }

  async function submitCase() {
    if (!draft.value) return
    if (!draft.value.assignedDoctorUserId) {
      ElMessage.warning('请先由超级管理员指定审核医师')
      return
    }
    if (!canSubmitCase.value) {
      ElMessage.warning('当前状态暂不能提交，请确认病历未归档且已绑定指定医师')
      return
    }
    draft.value.status = 'submitted'
    await saveCase()
    ElMessage.success(
      `已推送给 ${draft.value.assignedDoctorName || '指定审核医师'}，待医师确认后完成`
    )
  }

  async function approveCase() {
    if (!draft.value) return
    if (!canApproveCase.value) {
      ElMessage.warning('仅指定审核医师或超级管理员可确认完成')
      return
    }
    const approved = await approveMedicalRecordCase(draft.value.id)
    cases.value = [approved, ...cases.value.filter((item) => item.id !== approved.id)]
    setDraft(approved)
    clearDraftBackup(approved.id)
    ElMessage.success('病历已由指定审核医师确认完成')
  }

  async function selectCase(item: MedicalRecordCase) {
    if (draft.value?.id === item.id) return
    await flushAutoSave()
    const backup = readDraftBackup(item.id)
    if (backup) {
      setDraft(backup.draft, { dirty: true })
      ElMessage.warning('已恢复这份病历的本机临时草稿，请确认后保存')
      return
    }
    setDraft(item)
  }

  async function printPreview() {
    if (!draft.value || !previewRef.value) return

    const printWindow = window.open('', '_blank', 'width=900,height=1200')
    if (!printWindow) {
      ElMessage.warning('浏览器拦截了打印窗口，请允许弹窗后重试')
      return
    }

    printWindow.document.write(createPreviewPrintHtml(draft.value, previewRef.value.outerHTML))
    printWindow.document.close()
    await waitForPrintAssets(printWindow)
    printWindow.focus()
    printWindow.print()
    window.setTimeout(() => printWindow.close(), 300)
  }

  function setDraft(item: MedicalRecordCase, options: { dirty?: boolean } = {}) {
    hydratingDraft = true
    draft.value = cloneCase(item)
    dirty.value = Boolean(options.dirty)
    saveState.value = options.dirty ? 'dirty' : 'saved'
    window.sessionStorage.setItem(LAST_DRAFT_ID_KEY, String(item.id))
    nextTick(() => {
      hydratingDraft = false
      if (dirty.value) scheduleAutoSave()
    })
  }

  function scheduleAutoSave() {
    if (!draft.value || isLockedByStatus()) return
    clearAutoSaveTimer()
    autoSaveTimer.value = window.setTimeout(() => {
      saveCase({ silent: true }).catch(() => {
        ElMessage.warning('自动保存失败，请确认后端服务运行后再手动保存')
      })
    }, AUTO_SAVE_DELAY)
  }

  async function flushAutoSave() {
    clearAutoSaveTimer()
    if (!draft.value || !dirty.value || isLockedByStatus()) return

    try {
      await saveCase({ silent: true })
    } catch {
      writeDraftBackup()
      ElMessage.warning('离开前自动保存失败，已保留本机临时草稿')
    }
  }

  function clearAutoSaveTimer() {
    if (!autoSaveTimer.value) return
    window.clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'hidden') return
    writeDraftBackup()
    flushAutoSave()
  }

  function writeDraftBackup() {
    if (!draft.value || !dirty.value) return
    const backup: DraftBackup = {
      draft: cloneCase(draft.value),
      savedAt: new Date().toISOString()
    }
    try {
      window.sessionStorage.setItem(
        `${DRAFT_BACKUP_PREFIX}${draft.value.id}`,
        JSON.stringify(backup)
      )
      window.sessionStorage.setItem(LAST_DRAFT_ID_KEY, String(draft.value.id))
    } catch {
      // sessionStorage can fail in private modes; server save remains the primary path.
    }
  }

  function readDraftBackup(id: number) {
    try {
      const raw = window.sessionStorage.getItem(`${DRAFT_BACKUP_PREFIX}${id}`)
      if (!raw) return null
      const backup = JSON.parse(raw) as DraftBackup
      return backup?.draft?.id === id ? backup : null
    } catch {
      return null
    }
  }

  function readLastDraftBackup() {
    const lastDraftId = Number(window.sessionStorage.getItem(LAST_DRAFT_ID_KEY))
    if (!lastDraftId) return null
    return readDraftBackup(lastDraftId)?.draft || null
  }

  function clearDraftBackup(id: number) {
    window.sessionStorage.removeItem(`${DRAFT_BACKUP_PREFIX}${id}`)
  }

  function createPreviewPrintHtml(item: MedicalRecordCase, content: string) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.title || '病历导出')}</title>
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #1f2937;
        background: #fff;
        font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      }

      .document-preview {
        width: 100%;
        min-height: auto;
        padding: 0;
        color: #1f2937;
        background: #fff;
      }

      .doc-header {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: center;
        padding-bottom: 18px;
        margin-bottom: 18px;
        border-bottom: 2px solid #111827;
      }

      .doc-header img {
        width: 58px;
        height: 58px;
        object-fit: cover;
        border-radius: 14px;
      }

      .doc-header h2 {
        margin: 0;
        font-size: 26px;
        letter-spacing: 4px;
      }

      .doc-header p {
        margin: 4px 0 0;
        text-align: center;
        color: #4b5563;
      }

      h3 {
        margin: 0 0 12px;
        font-size: 20px;
        text-align: center;
      }

      .doc-meta {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 10px 12px;
        margin-bottom: 18px;
        font-size: 12px;
        background: #f9fafb;
        border-radius: 10px;
      }

      .doc-section {
        margin-top: 18px;
        break-inside: avoid;
      }

      .doc-section h4 {
        padding-left: 10px;
        margin: 0 0 10px;
        font-size: 16px;
        border-left: 4px solid #111827;
      }

      .doc-section dl {
        display: grid;
        grid-template-columns: 128px 1fr;
        margin: 0;
        border-top: 1px solid #e5e7eb;
        border-left: 1px solid #e5e7eb;
      }

      .doc-section dt,
      .doc-section dd {
        min-height: 36px;
        padding: 8px 10px;
        margin: 0;
        line-height: 1.65;
        border-right: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
      }

      .doc-section dt {
        font-weight: 600;
        background: #f9fafb;
      }

      .doc-footer {
        display: flex;
        justify-content: space-between;
        padding-top: 18px;
        margin-top: 24px;
        font-size: 12px;
        color: #6b7280;
        border-top: 1px dashed #d1d5db;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`
  }

  function waitForPrintAssets(printWindow: Window) {
    const images = Array.from(printWindow.document.images)
    return Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve()
              return
            }
            image.onload = () => resolve()
            image.onerror = () => resolve()
          })
      )
    )
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function stringValue(key: string) {
    const value = draft.value?.values[key]
    return Array.isArray(value) ? value.join('、') : String(value || '')
  }

  function numberValue(key: string) {
    const rawValue = stringValue(key)
    if (!rawValue.trim()) return undefined
    const value = Number(rawValue)
    return Number.isFinite(value) ? value : undefined
  }

  function setStringValue(key: string, value: string | number) {
    if (!draft.value) return
    draft.value.values[key] = String(value)
  }

  function canEditField(field: MedicalField) {
    if (!draft.value || isLockedByStatus()) return false
    if (isSuperAdmin.value) return true
    const allowedStages = field.allowedStages || []
    return allowedStages.some((stage) => currentStages.value.includes(stage))
  }

  function isLockedByStatus() {
    return draft.value?.status === 'approved' && !isSuperAdmin.value
  }

  function stageText(stages: MedicalStageKey[] = []) {
    return stages.map((stage) => stageLabels[stage]).join('、')
  }

  function isMedicalStageKey(value: string): value is MedicalStageKey {
    return Object.prototype.hasOwnProperty.call(stageLabels, value)
  }

  function toPayload(item: MedicalRecordCase): MedicalRecordSavePayload {
    return {
      title: item.title,
      status: item.status,
      assignedDoctorUserId: normalizeAssignedDoctorId(item.assignedDoctorUserId),
      values: item.values
    }
  }

  function normalizeAssignedDoctorId(value: unknown) {
    const id = Number(value)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  function syncAssignedDoctorName(value: number | string | undefined) {
    if (!draft.value) return
    const doctor = doctorOptions.value.find((item) => item.id === Number(value))
    draft.value.assignedDoctorName = doctor?.name || ''
  }

  function doctorLabel(doctor: MedicalRecordDoctor) {
    return [doctor.name, doctor.position].filter(Boolean).join(' · ')
  }

  function cloneCase(item: MedicalRecordCase): MedicalRecordCase {
    return JSON.parse(JSON.stringify(item))
  }

  function defaultValues(): Record<string, MedicalRecordValue> {
    return {
      department: '肛肠科一病区',
      treatmentType: '中医',
      tcmDiagnosis: '肛肠病（混合痔病）',
      westernMainDiagnosis: '混合痔'
    }
  }

  function groupCompleted(group: MedicalFieldGroup) {
    if (!draft.value) return '0/0'
    const count = group.fields.filter((field) => hasValue(draft.value?.values[field.key])).length
    return `${count}/${group.fields.length}`
  }

  function hasValue(value: MedicalRecordValue | undefined) {
    if (Array.isArray(value)) return value.length > 0
    return Boolean(String(value || '').trim())
  }

  function valueText(value: MedicalRecordValue | undefined) {
    if (Array.isArray(value)) return value.length ? value.join('、') : '待填写'
    return String(value || '').trim() || '待填写'
  }

  function statusLabel(status: MedicalRecordStatus) {
    if (status === 'submitted') return '待审核'
    if (status === 'approved') return '已审核'
    return '草稿'
  }

  function statusType(status: MedicalRecordStatus) {
    if (status === 'submitted') return 'warning'
    if (status === 'approved') return 'success'
    return 'info'
  }
</script>

<style scoped lang="scss">
  .medical-record-page {
    .record-hero {
      display: flex;
      gap: 24px;
      align-items: center;
      justify-content: space-between;
      padding: 24px;
      margin-bottom: 20px;

      h1 {
        margin: 14px 0 8px;
        font-size: 28px;
        font-weight: 700;
      }

      p {
        max-width: 760px;
        margin: 0;
        color: var(--art-text-gray-600);
      }
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
    }

    .side-card,
    .form-card,
    .preview-card {
      padding: 20px;
      margin-bottom: 20px;
    }

    .case-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 560px;
      overflow: auto;
    }

    .case-item {
      padding: 14px;
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 1px solid var(--art-border-color);
      border-radius: 14px;
      transition: all 0.2s;

      strong,
      span,
      small {
        display: block;
      }

      strong {
        color: var(--art-text-gray-900);
      }

      span {
        margin-top: 6px;
        font-size: 12px;
        color: var(--art-text-gray-600);
      }

      small {
        margin-top: 4px;
        color: var(--art-text-gray-500);
      }

      &.active,
      &:hover {
        border-color: var(--el-color-primary);
        box-shadow: 0 12px 26px rgb(var(--art-gray-900-rgb), 0.08);
      }
    }

    .privacy-alert {
      margin-bottom: 20px;
    }

    .permission-alert {
      margin-bottom: 16px;
    }

    .assigned-doctor-view {
      display: flex;
      align-items: center;
      min-height: 32px;
    }

    .group-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding-right: 12px;
      font-weight: 600;
    }

    .role-hint {
      margin-left: 8px;
      font-size: 12px;
      font-weight: 400;
      color: var(--el-color-primary);
    }

    .locked-tag {
      margin-left: 8px;
    }

    .document-preview {
      min-height: 760px;
      padding: 28px;
      color: #1f2937;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 80%);

      .doc-header {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: center;
        padding-bottom: 18px;
        margin-bottom: 18px;
        border-bottom: 2px solid #111827;

        img {
          width: 58px;
          height: 58px;
          object-fit: cover;
          border-radius: 14px;
        }

        h2 {
          margin: 0;
          font-size: 26px;
          letter-spacing: 4px;
        }

        p {
          margin: 4px 0 0;
          color: #4b5563;
          text-align: center;
        }
      }

      h3 {
        margin: 0 0 12px;
        font-size: 20px;
        text-align: center;
      }
    }

    .doc-meta {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 10px 12px;
      margin-bottom: 18px;
      font-size: 12px;
      background: #f9fafb;
      border-radius: 10px;
    }

    .doc-section {
      margin-top: 18px;

      h4 {
        padding-left: 10px;
        margin: 0 0 10px;
        font-size: 16px;
        border-left: 4px solid #111827;
      }

      dl {
        display: grid;
        grid-template-columns: 128px 1fr;
        margin: 0;
        border-top: 1px solid #e5e7eb;
        border-left: 1px solid #e5e7eb;
      }

      dt,
      dd {
        min-height: 36px;
        padding: 8px 10px;
        margin: 0;
        line-height: 1.65;
        border-right: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
      }

      dt {
        font-weight: 600;
        background: #f9fafb;
      }
    }

    .doc-footer {
      display: flex;
      justify-content: space-between;
      padding-top: 18px;
      margin-top: 24px;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px dashed #d1d5db;
    }
  }

  @media (width <= 992px) {
    .medical-record-page {
      .record-hero {
        flex-direction: column;
        align-items: flex-start;
      }

      .hero-actions {
        justify-content: flex-start;
      }

      .doc-meta {
        grid-template-columns: 1fr;
      }
    }
  }

  @media print {
    :global(body) {
      background: #fff !important;
    }

    .record-hero,
    .side-card,
    .form-card,
    .no-print,
    .privacy-alert {
      display: none !important;
    }

    .preview-card {
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }

    .document-preview {
      min-height: auto !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
  }
</style>
