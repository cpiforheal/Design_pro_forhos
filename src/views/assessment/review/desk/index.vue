<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">审核台</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500">负责人和院领导在这里处理员工提交、退回整改和销号跟进。</p>
      </div>
    </template>

    <ElTable :data="reviewTodoItems" border empty-text="当前暂无待审核事项">
      <ElTableColumn prop="title" label="事项" min-width="260" show-overflow-tooltip />
      <ElTableColumn prop="boardName" label="板块" width="180" show-overflow-tooltip />
      <ElTableColumn prop="owner" label="员工" width="120" />
      <ElTableColumn prop="deadline" label="截止时间" width="160" />
      <ElTableColumn prop="workflowStatus" label="流程状态" width="120">
        <template #default="scope">
          <ElTag>{{ getWorkflowStatusLabel(scope.row.workflowStatus) }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="actionText" label="建议动作" width="120" />
      <ElTableColumn label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <ElButton size="small" type="primary" @click="approveReview(row.recordType, row.recordId)">通过</ElButton>
          <ElButton size="small" @click="returnReview(row.recordType, row.recordId)">退回</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

const { reviewTodoItems, approveReview, returnReview, getWorkflowStatusLabel } = useAssessmentPlatform()
</script>
