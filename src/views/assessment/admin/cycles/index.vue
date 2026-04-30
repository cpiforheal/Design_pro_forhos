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

    <ElTable :data="assessmentCycles" border>
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
      <ElTableColumn label="操作" width="110" fixed="right" align="center">
        <template #default="scope">
          <ElButton type="primary" link @click="saveCycle(scope.row)">保存</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { fetchAssessmentCycles, updateAssessmentCycle } from '@/api/assessment-admin'
  import type { AssessmentCycle } from '@/types/assessment'
  import { getCycleStatusLabel } from '@/utils/assessment/workflow'

  const assessmentCycles = ref<AssessmentCycle[]>([])

  onMounted(async () => {
    assessmentCycles.value = await fetchAssessmentCycles()
  })

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
