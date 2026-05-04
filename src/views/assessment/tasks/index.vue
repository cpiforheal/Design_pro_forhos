<template>
  <div class="assessment-page">
    <el-card class="intro-card">
      <h2>本周任务</h2>
      <p>保留医院安排与分管负责人安排两类任务。新任务默认未完成，处理后点击按钮标记为已完成。</p>
    </el-card>
    <el-card>
      <el-table
        ref="taskTableRef"
        :data="currentTasks"
        border
        stripe
        row-key="id"
        :row-class-name="getRowClassName"
      >
        <el-table-column prop="source" label="来源" width="150" />
        <el-table-column prop="title" label="任务内容" min-width="280" />
        <el-table-column prop="owner" label="负责人" width="180" />
        <el-table-column prop="deadline" label="截止时间" width="150" />
        <el-table-column label="完成情况" width="170" align="center">
          <template #default="{ row }">
            <el-button
              :type="buttonType(resolveDraft(row).status)"
              @click="toggleTask(row.id, row.source === '医院安排' ? 'hospital' : 'board')"
            >
              {{ taskActionText(resolveDraft(row).status) }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="220">
          <template #default="{ row }">
            <el-input
              v-model="resolveDraft(row).remark"
              placeholder="备注"
              @change="persistTask(row.id, row.source === '医院安排' ? 'hospital' : 'board')"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import type { AssessmentStatus, TaskItem } from '@/types/assessment'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  const route = useRoute()
  const taskTableRef = ref()
  const { currentTasks, hospitalTaskDrafts, boardTaskDrafts, toggleTask, persistTask } =
    useAssessmentPlatform()

  watch(
    () => route.query.taskId,
    async (taskId) => {
      if (!taskId) return
      await nextTick()
      const target = currentTasks.value.find((task) => task.id === taskId)
      if (target) taskTableRef.value?.setCurrentRow?.(target)
    },
    { immediate: true }
  )

  function resolveDraft(row: TaskItem) {
    return row.source === '医院安排'
      ? hospitalTaskDrafts.value[row.id]
      : boardTaskDrafts.value[row.id]
  }

  function buttonType(status?: AssessmentStatus) {
    if (status === 'pending') return 'danger'
    if (status === 'na') return 'info'
    return 'success'
  }

  function taskActionText(status?: AssessmentStatus) {
    return status === 'completed' ? '改为未完成' : '标记完成'
  }

  function getRowClassName({ row }: { row: TaskItem }) {
    return route.query.taskId === row.id ? 'target-task-row' : ''
  }
</script>

<style scoped>
  .assessment-page {
    padding: 4px;
  }

  .intro-card {
    margin-bottom: 16px;
    border-radius: 16px;
  }

  .intro-card h2 {
    margin: 0 0 8px;
  }

  .intro-card p {
    margin: 0;
    color: #64748b;
  }

  :deep(.target-task-row) {
    --el-table-tr-bg-color: var(--el-color-primary-light-9);
  }
</style>
