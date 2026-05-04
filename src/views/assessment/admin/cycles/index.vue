<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">周期模板</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500"
          >配置周度、月度考核周期，后续可扩展考核模板和分值规则。</p
        >
      </div>
    </template>

    <ElAlert
      class="deadline-alert"
      type="warning"
      show-icon
      :closable="false"
      title="院长可在此热更新全院通用与板块考核的统一提交截止和审核截止时间，保存后员工主控区会立即滚动播报。"
    />

    <ElAlert
      v-if="confirmationText"
      class="deadline-alert"
      type="info"
      show-icon
      :closable="false"
      :title="confirmationText"
    />

    <ElAlert
      v-if="archiveWarning"
      class="deadline-alert"
      type="error"
      show-icon
      :closable="true"
      :title="archiveWarning"
      @close="archiveWarning = ''"
    />

    <ElTable
      v-if="confirmationGaps.length"
      class="deadline-alert"
      :data="confirmationGaps"
      size="small"
      border
    >
      <ElTableColumn prop="employeeName" label="待确认人员" min-width="140" />
      <ElTableColumn prop="employeeNo" label="工号" width="120" />
      <ElTableColumn prop="boardName" label="板块" min-width="140" />
      <ElTableColumn label="缺口" min-width="180">
        <template #default="{ row }">
          <ElTag v-if="row.missingEmployeeConfirmation" type="warning" class="mr-1">
            员工未确认
          </ElTag>
          <ElTag v-if="row.missingManagerConfirmation" type="danger" class="mr-1">
            负责人未确认
          </ElTag>
          <ElTag v-if="row.missingReviewGroupConfirmation" type="info">考核小组未复核</ElTag>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElTable v-loading="loading" :data="assessmentCycles" border>
      <ElTableColumn prop="name" label="周期名称" min-width="220" />
      <ElTableColumn prop="type" label="类型" width="100">
        <template #default="scope">{{ getTypeText(scope.row.type) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="startDate" label="开始日期" width="130" />
      <ElTableColumn prop="endDate" label="结束日期" width="130" />
      <ElTableColumn label="提交截止" width="210">
        <template #default="scope">
          <ElInput v-model="scope.row.submitDeadline" placeholder="如：本周五 18:00" />
        </template>
      </ElTableColumn>
      <ElTableColumn label="审核截止" width="210">
        <template #default="scope">
          <ElInput v-model="scope.row.reviewDeadline" placeholder="如：本周五 20:00" />
        </template>
      </ElTableColumn>
      <ElTableColumn prop="status" label="状态" width="110">
        <template #default="scope">
          <ElTag>{{ getCycleStatusLabel(scope.row.status) }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="description" label="说明" min-width="260" show-overflow-tooltip />
      <ElTableColumn label="状态流转" width="180" align="center">
        <template #default="scope">
          <ElSelect
            :model-value="scope.row.status"
            size="small"
            @change="(status: string) => changeCycleStatus(scope.row, status)"
          >
            <ElOption
              v-for="item in cycleStatusOptions"
              :key="item.status"
              :label="item.label"
              :value="item.status"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="110" fixed="right" align="center">
        <template #default="scope">
          <ElButton type="primary" link @click="saveCycle(scope.row)">保存</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { fetchAssessmentBootstrap } from '@/api/assessment'
  import {
    fetchAssessmentCycles,
    updateAssessmentCycle,
    updateAssessmentCycleStatus
  } from '@/api/assessment-admin'
  import type { AssessmentBootstrapPayload, AssessmentCycle } from '@/types/assessment'
  import { getCycleStatusLabel } from '@/utils/assessment/workflow'

  const assessmentCycles = ref<AssessmentCycle[]>([])
  const bootstrap = ref<AssessmentBootstrapPayload | null>(null)
  const archiveWarning = ref('')
  const loading = ref(false)

  const cycleStatusOptions = [
    { status: 'notStarted', label: '未开始' },
    { status: 'filling', label: '填报中' },
    { status: 'reviewing', label: '审核中' },
    { status: 'completed', label: '已完成' },
    { status: 'archived', label: '已归档' }
  ]

  const confirmationText = computed(() => {
    const summary = bootstrap.value?.confirmationSummary
    if (!summary) return ''
    return `当前周期确认进度：本人确认 ${summary.employeeConfirmedCount}/${summary.totalEmployees}，负责人确认 ${summary.managerConfirmedCount}/${summary.totalEmployees}，考核小组复核 ${summary.reviewGroupConfirmedCount}/${summary.totalEmployees}，可归档 ${summary.readyToArchiveCount}/${summary.totalEmployees}`
  })
  const confirmationGaps = computed(() => bootstrap.value?.confirmationGaps ?? [])

  onMounted(loadCycles)

  async function loadCycles() {
    loading.value = true
    try {
      const [cycles, payload] = await Promise.all([
        fetchAssessmentCycles(),
        fetchAssessmentBootstrap()
      ])
      assessmentCycles.value = cycles
      bootstrap.value = payload
    } finally {
      loading.value = false
    }
  }

  async function saveCycle(row: AssessmentCycle) {
    assessmentCycles.value = await updateAssessmentCycle(row.id, {
      name: row.name,
      type: row.type,
      startDate: row.startDate,
      endDate: row.endDate,
      submitDeadline: row.submitDeadline,
      reviewDeadline: row.reviewDeadline,
      status: row.status,
      description: row.description
    })
    bootstrap.value = await fetchAssessmentBootstrap()
  }

  async function changeCycleStatus(row: AssessmentCycle, status: string) {
    archiveWarning.value = ''
    try {
      assessmentCycles.value = await updateAssessmentCycleStatus(row.id, status)
      bootstrap.value = await fetchAssessmentBootstrap()
      ElMessage.success('周期状态已更新')
    } catch (error) {
      archiveWarning.value =
        error instanceof Error ? error.message : '周期状态更新失败，请检查确认进度'
      await loadCycles()
    }
  }

  const typeMap: Record<string, string> = {
    weekly: '周度',
    monthly: '月度',
    quarterly: '季度',
    yearly: '年度'
  }

  function getTypeText(type: string) {
    return typeMap[type] ?? '未知'
  }
</script>

<style scoped>
  .deadline-alert {
    margin-bottom: 16px;
  }
</style>
