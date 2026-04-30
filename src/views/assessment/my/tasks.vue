<template>
  <div class="employee-simple-page">
    <el-card class="intro-card" shadow="never">
      <h2>我的任务</h2>
      <p>只显示与本人相关的医院安排和所属板块任务，适合手机上快速确认。</p>
    </el-card>

    <div class="task-grid">
      <el-card
        v-for="task in currentTasks"
        :id="`task-${task.id}`"
        :key="task.id"
        class="task-card"
        :class="{ 'is-target': route.query.taskId === task.id }"
        shadow="never"
      >
        <el-tag :type="task.source === '医院安排' ? 'primary' : 'warning'">{{
          task.source
        }}</el-tag>
        <h3>{{ task.title }}</h3>
        <p>负责人：{{ task.owner }}</p>
        <p>截止时间：{{ task.deadline }}</p>
        <div class="card-actions">
          <el-tag :type="statusType(resolveStatus(task))">{{
            getStatusLabel(resolveStatus(task))
          }}</el-tag>
          <el-button
            type="primary"
            plain
            @click="toggleTask(task.id, task.source === '医院安排' ? 'hospital' : 'board')"
          >
            切换状态
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import type { AssessmentStatus, TaskItem } from '@/types/assessment'

  const route = useRoute()
  const { currentTasks, hospitalTaskDrafts, boardTaskDrafts, toggleTask, getStatusLabel } =
    useAssessmentPlatform()

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
</script>

<style scoped lang="scss">
  .employee-simple-page {
    padding: 4px;
  }

  .intro-card,
  .task-card {
    border: 0;
    border-radius: 18px;
  }

  .intro-card {
    margin-bottom: 16px;

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

  .card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
  }

  @media (max-width: 768px) {
    .card-actions {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
