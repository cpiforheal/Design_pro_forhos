<template>
  <div class="assessment-page">
    <ElCard class="intro-card">
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">分管工作安排</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            中心负责人维护本板块任务、精确截止时间和延期说明。逾期后员工端会被锁定，负责人延期后才能重新提交。
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
        <ElTableColumn label="任务分类" width="160">
          <template #default="{ row }">
            <ElSelect v-model="row.taskCategory" placeholder="任务分类">
              <ElOption
                v-for="category in taskCategoryOptions"
                :key="category"
                :label="category"
                :value="category"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn label="工作内容" min-width="260">
          <template #default="{ row }">
            <ElInput v-model="row.title" placeholder="请输入本周工作内容" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="责任人" width="170">
          <template #default="{ row }">
            <ElInput v-model="row.owner" placeholder="责任人" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="接收范围" min-width="260">
          <template #default="{ row }">
            <div class="assignee-cell">
              <ElSelect
                v-model="row.assigneeMode"
                style="width: 96px"
                @change="() => changeAssigneeMode(row)"
              >
                <ElOption label="全板块" value="board" />
                <ElOption label="指定员工" value="users" />
              </ElSelect>
              <ElSelect
                v-if="row.assigneeMode === 'users'"
                v-model="row.assigneeUserIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择员工"
                style="flex: 1"
              >
                <ElOption
                  v-for="employee in getAssigneeOptions(row)"
                  :key="employee.userId"
                  :label="`${employee.name}（${employee.employeeNo}）`"
                  :value="employee.userId"
                />
              </ElSelect>
              <ElTag v-else type="info">板块内全部员工</ElTag>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="完成时限" width="220">
          <template #default="{ row }">
            <ElDatePicker
              v-model="row.deadlineAt"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="选择精确时间"
              style="width: 190px"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="协同/延期说明" min-width="220">
          <template #default="{ row }">
            <ElInput v-model="row.collaborationNote" placeholder="延期或协同处理时填写说明" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="验收/逾期" width="150" align="center">
          <template #default="{ row }">
            <ElTag :type="row.overdue ? 'danger' : 'info'">
              {{ row.overdue ? '已逾期' : row.acceptanceStatus || '待验收' }}
            </ElTag>
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
  import type { TaskCategory, TaskItem } from '@/types/assessment'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  type EditableTask = TaskItem & { isNew?: boolean }

  const {
    selectedBoardId,
    currentBoard,
    nonAllStaffBoards,
    hospitalEmployees,
    managedBoardTaskList,
    reloadManagedBoardTasks,
    createManagerTask,
    updateManagerTask,
    publishManagerTask
  } = useAssessmentPlatform()

  const localDrafts = ref<EditableTask[]>([])
  const taskCategoryOptions: TaskCategory[] = [
    '周一重点任务',
    '医院重点任务',
    '分管负责人任务',
    '临时突击任务',
    '创新发展任务'
  ]

  const editableTasks = computed(() =>
    localDrafts.value.filter((task) => task.boardId === selectedBoardId.value)
  )

  onMounted(async () => {
    await reloadManagedBoardTasks()
    syncLocalDrafts()
  })

  watch(managedBoardTaskList, syncLocalDrafts, { deep: true })

  function syncLocalDrafts() {
    localDrafts.value = managedBoardTaskList.value.map((task) => ({
      ...task,
      deadlineAt: task.deadlineAt || task.deadline,
      taskCategory: task.taskCategory || '分管负责人任务',
      acceptanceStatus: task.acceptanceStatus || '待验收',
      collaborationNote: task.collaborationNote || '',
      assigneeMode: task.assigneeMode || 'board',
      assigneeUserIds: task.assigneeUserIds || []
    }))
  }

  function addDraftTask() {
    localDrafts.value.unshift({
      id: `draft-${Date.now()}`,
      source: '分管负责人安排',
      boardId: selectedBoardId.value,
      title: '',
      deadline: '',
      deadlineAt: '',
      taskCategory: '分管负责人任务',
      acceptanceStatus: '待验收',
      collaborationNote: '',
      owner: currentBoard.value.owner,
      enabled: false,
      assigneeMode: 'board',
      assigneeUserIds: [],
      isNew: true
    })
  }

  async function saveTask(row: EditableTask) {
    const payload = {
      boardId: row.boardId,
      title: row.title,
      deadline: row.deadlineAt || row.deadline,
      deadlineAt: row.deadlineAt || row.deadline,
      taskCategory: row.taskCategory,
      acceptanceStatus: row.acceptanceStatus,
      collaborationNote: row.collaborationNote,
      owner: row.owner,
      enabled: row.enabled,
      assigneeMode: row.assigneeMode || 'board',
      assigneeUserIds: row.assigneeMode === 'users' ? row.assigneeUserIds || [] : []
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

  function changeAssigneeMode(row: EditableTask) {
    if (row.assigneeMode !== 'users') row.assigneeUserIds = []
  }

  function getAssigneeOptions(row: EditableTask) {
    return hospitalEmployees.value
      .filter(
        (employee) =>
          employee.userId &&
          employee.boardId === row.boardId &&
          employee.status === 'active' &&
          employee.systemRole === 'R_EMPLOYEE'
      )
      .map((employee) => ({
        userId: Number(employee.userId),
        name: employee.name,
        employeeNo: employee.employeeNo
      }))
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

  .assignee-cell {
    display: flex;
    gap: 8px;
    align-items: center;
  }
</style>
