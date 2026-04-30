<template>
  <div class="assessment-page">
    <ElCard class="intro-card">
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">分管工作安排</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            六大中心负责人可维护本板块每周工作内容、完成时限与责任人，推送后员工端同步展示。
          </p>
        </div>
      </template>

      <ElForm inline label-width="90px">
        <ElFormItem label="当前板块">
          <ElSelect v-model="selectedBoardId" style="width: 320px">
            <ElOption
              v-for="board in nonAllStaffBoards"
              :key="board.id"
              :label="board.name"
              :value="board.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="负责人">
          <ElTag>{{ currentBoard.owner }}</ElTag>
        </ElFormItem>
      </ElForm>
      <p>{{ currentBoard.description }}</p>
    </ElCard>

    <ElCard>
      <template #header>
        <div class="table-card-header">
          <span>本板块分管工作</span>
          <ElButton type="primary" @click="addDraftTask">新增工作</ElButton>
        </div>
      </template>

      <ElTable :data="editableTasks" border stripe row-key="id">
        <ElTableColumn label="工作内容" min-width="280">
          <template #default="{ row }">
            <ElInput v-model="row.title" placeholder="请输入本周工作内容" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="责任人" width="180">
          <template #default="{ row }">
            <ElInput v-model="row.owner" placeholder="责任人" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="完成时限" width="190">
          <template #default="{ row }">
            <ElDatePicker
              v-model="row.deadline"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 150px"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="120" align="center">
          <template #default="{ row }">
            <ElTag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '已推送' : '草稿' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="saveTask(row)">保存</ElButton>
            <ElButton
              type="success"
              link
              :disabled="!row.id.startsWith('manager-')"
              @click="pushTask(row)"
            >
              推送
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import type { TaskItem } from '@/types/assessment'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  type EditableTask = TaskItem & { isNew?: boolean }

  const {
    selectedBoardId,
    currentBoard,
    nonAllStaffBoards,
    managedBoardTaskList,
    reloadManagedBoardTasks,
    createManagerTask,
    updateManagerTask,
    publishManagerTask
  } = useAssessmentPlatform()

  const localDrafts = ref<EditableTask[]>([])

  const editableTasks = computed(() =>
    localDrafts.value.filter((task) => task.boardId === selectedBoardId.value)
  )

  onMounted(async () => {
    await reloadManagedBoardTasks()
    syncLocalDrafts()
  })

  watch(managedBoardTaskList, syncLocalDrafts, { deep: true })

  function syncLocalDrafts() {
    localDrafts.value = managedBoardTaskList.value.map((task) => ({ ...task }))
  }

  function addDraftTask() {
    localDrafts.value.unshift({
      id: `draft-${Date.now()}`,
      source: '分管负责人安排',
      boardId: selectedBoardId.value,
      title: '',
      deadline: '',
      owner: currentBoard.value.owner,
      enabled: false,
      isNew: true
    })
  }

  async function saveTask(row: EditableTask) {
    const payload = {
      boardId: row.boardId,
      title: row.title,
      deadline: row.deadline,
      owner: row.owner,
      enabled: row.enabled
    }
    if (row.isNew || row.id.startsWith('draft-')) {
      await createManagerTask(payload)
    } else {
      await updateManagerTask(row.id, payload)
    }
  }

  async function pushTask(row: EditableTask) {
    row.enabled = true
    await saveTask(row)
    if (!row.id.startsWith('draft-')) await publishManagerTask(row.id)
  }
</script>

<style scoped>
  .assessment-page {
    display: grid;
    gap: 16px;
  }

  .intro-card p {
    margin: 8px 0 0;
    color: var(--el-text-color-secondary);
  }

  .table-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
