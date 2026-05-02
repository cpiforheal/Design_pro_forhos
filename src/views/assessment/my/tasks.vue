<template>
  <div
    class="employee-simple-page"
    :class="{ 'is-elderly-friendly': currentEmployee.elderlyFriendly }"
  >
    <ElCard class="intro-card" shadow="never">
      <h2>我的任务</h2>
      <p>只显示与本人相关的医院安排和所属板块任务。超过精确截止时间后，需要负责人延期才能提交。</p>
    </ElCard>

    <ElAlert
      v-if="overdueTasks.length"
      class="page-alert"
      type="error"
      show-icon
      :closable="false"
      :title="`有 ${overdueTasks.length} 项任务已逾期，普通员工不能再提交或修改。`"
      description="请联系负责人在任务管理中延期，延期后本页会自动恢复可提交状态。"
    />

    <div class="task-grid">
      <ElCard
        v-for="task in currentTasks"
        :id="`task-${task.id}`"
        :key="task.id"
        class="task-card"
        :class="{ 'is-target': route.query.taskId === task.id, 'is-overdue': task.overdueLocked }"
        shadow="never"
      >
        <div class="task-head">
          <ElTag :type="task.source === '医院安排' ? 'primary' : 'warning'">{{
            task.source
          }}</ElTag>
          <ElTag v-if="task.overdueLocked" type="danger">已逾期</ElTag>
          <ElTag v-else-if="isNearDeadline(task)" type="warning">临近截止</ElTag>
        </div>
        <h3>{{ task.title }}</h3>
        <p>责任人：{{ task.owner }}</p>
        <p>截止时间：{{ task.deadlineAt || task.deadline }}</p>
        <p v-if="task.taskCategory">任务分类：{{ task.taskCategory }}</p>
        <div class="card-actions">
          <ElTag :type="statusType(resolveStatus(task))">{{
            getStatusLabel(resolveStatus(task))
          }}</ElTag>
          <ElButton
            type="primary"
            plain
            :disabled="task.overdueLocked"
            @click="toggleTask(task.id, task.source === '医院安排' ? 'hospital' : 'board')"
          >
            {{ task.overdueLocked ? '需负责人延期' : '切换状态' }}
          </ElButton>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import type { AssessmentStatus, TaskItem } from '@/types/assessment'

  const route = useRoute()
  const {
    currentEmployee,
    currentTasks,
    hospitalTaskDrafts,
    boardTaskDrafts,
    toggleTask,
    getStatusLabel
  } = useAssessmentPlatform()
  const overdueTasks = computed(() => currentTasks.value.filter((task) => task.overdueLocked))

  watch(
    () => route.query.taskId,
    async (taskId) => {
      if (!taskId) return
      await nextTick()
      document
        .getElementById(`task-${taskId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    { immediate: true }
  )

  function resolveStatus(task: TaskItem): AssessmentStatus {
    const draft =
      task.source === '医院安排'
        ? hospitalTaskDrafts.value[task.id]
        : boardTaskDrafts.value[task.id]
    return draft?.status ?? 'completed'
  }

  function statusType(status: AssessmentStatus) {
    if (status === 'pending') return 'danger'
    if (status === 'na') return 'info'
    return 'success'
  }

  function isNearDeadline(task: TaskItem) {
    const value = task.deadlineAt || task.deadline
    const timestamp = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'))
    if (Number.isNaN(timestamp)) return false
    const hours = (timestamp - Date.now()) / 36e5
    return hours > 0 && hours <= 24
  }
</script>

<style scoped lang="scss">
  .employee-simple-page {
    padding: 4px;
  }

  .intro-card,
  .task-card {
    border: 0;
    border-radius: 12px;
  }

  .intro-card,
  .page-alert {
    margin-bottom: 16px;
  }

  .intro-card {
    h2 {
      margin: 0 0 8px;
    }

    p {
      margin: 0;
      color: #64748b;
    }
  }

  .task-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }

  .task-head {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .task-card {
    h3 {
      margin: 12px 0 8px;
      color: #0f172a;
    }

    p {
      color: #64748b;
    }
  }

  .task-card.is-target {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
  }

  .task-card.is-overdue {
    background: #fff7f7;
  }

  .card-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
  }

  .is-elderly-friendly {
    font-size: 17px;

    :deep(.el-button) {
      min-height: 42px;
      font-size: 16px;
    }
  }

  @media (width <= 768px) {
    .card-actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
