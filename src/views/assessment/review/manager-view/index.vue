<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">负责人视角</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500">板块负责人重点查看本板块员工待办、审核和整改闭环。</p>
      </div>
    </template>

    <ElDescriptions :column="2" border>
      <ElDescriptionsItem label="当前板块">{{ currentBoard.name }}</ElDescriptionsItem>
      <ElDescriptionsItem label="当前员工">{{ currentEmployee.name }}</ElDescriptionsItem>
      <ElDescriptionsItem label="员工待办">{{ employeeAssessmentSnapshot.todoCount }}</ElDescriptionsItem>
      <ElDescriptionsItem label="紧急事项">{{ employeeAssessmentSnapshot.urgentTodoCount }}</ElDescriptionsItem>
    </ElDescriptions>

    <ElDivider />
    <ElTable :data="employeeTodoItems" border>
      <ElTableColumn prop="title" label="员工事项" min-width="260" show-overflow-tooltip />
      <ElTableColumn prop="boardName" label="板块" width="180" show-overflow-tooltip />
      <ElTableColumn prop="deadline" label="截止时间" width="160" />
      <ElTableColumn prop="actionText" label="动作" width="120" />
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

const { currentBoard, currentEmployee, employeeAssessmentSnapshot, employeeTodoItems } = useAssessmentPlatform()
</script>
