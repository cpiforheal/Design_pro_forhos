<template>
  <div class="employee-assessment-page" :class="{ 'is-elderly-friendly': isElderlyFriendly }">
    <AssessmentNoticeTicker :messages="noticeMessages" />

    <ElAlert
      v-if="isElderlyFriendly"
      class="page-alert"
      type="success"
      show-icon
      :closable="false"
      title="已启用简化显示：只看待办、状态和提交按钮。"
    />

    <ElAlert
      v-if="deadlineAlert"
      class="page-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="deadlineAlert"
    />

    <section class="hero-card">
      <div>
        <ElTag type="success" size="large">{{ currentAssessmentCycle.name }}</ElTag>
        <h1>我的考核</h1>
        <p>
          {{
            currentEmployee.name
          }}，今天只需要先看“我的待办”。红色、黄色提醒处理完后，点击提交即可进入负责人审核。
        </p>
      </div>
      <div class="hero-score">
        <span>需要处理</span>
        <strong>{{ actionTodoCount }}</strong>
        <small>{{ actionTodoCount ? '项待办' : '当前无待办' }}</small>
      </div>
      <div class="hero-score">
        <span>当前得分</span>
        <strong>{{ summary.finalScore }}</strong>
        <small>完成率 {{ formatRate(summary.completionRate) }}</small>
      </div>
    </section>

    <ElAlert
      v-if="submitResultVisible"
      class="page-alert"
      type="success"
      show-icon
      title="提交成功，已进入负责人审核流程"
      description="如果被退回，请回到本页补充说明后再次提交。"
      :closable="true"
      @close="submitResultVisible = false"
    />

    <ElCard class="panel-card" shadow="never">
      <template #header>
        <div class="panel-header">
          <div>
            <strong>我的待办</strong>
            <p>先完成这里列出的事项；没有待办时直接提交本周期考核。</p>
          </div>
          <div class="panel-actions">
            <ElButton v-if="!isElderlyFriendly" size="large" @click="toggleConfirmDetails">
              {{ showConfirmDetails ? '收起明细' : '查看明细' }}
            </ElButton>
            <ElButton type="primary" size="large" :loading="loading" @click="confirmSubmit">
              提交本周期考核
            </ElButton>
          </div>
        </div>
      </template>

      <ArtTable
        v-if="todoTableRows.length"
        :data="todoTableRows"
        style="width: 100%"
        size="large"
        :border="false"
        :stripe="false"
        :header-cell-style="{ background: 'transparent' }"
      >
        <ElTableColumn label="事项" min-width="280">
          <template #default="{ row }">
            <div class="todo-title-cell">
              <ElTag :type="row.tagType" effect="light" size="small">{{ row.sourceText }}</ElTag>
              <div>
                <span>{{ row.title }}</span>
                <p v-if="row.standard">{{ row.standard }}</p>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="boardName" label="归属" min-width="150" />
        <ElTableColumn prop="deadline" label="截止/要求" min-width="170" />
        <ElTableColumn label="状态" width="120" align="center">
          <template #default="{ row }">
            <ElTag :type="row.statusType" size="small">{{ row.statusText }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="130" align="center" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="row.action">{{ row.actionText }}</ElButton>
          </template>
        </ElTableColumn>
      </ArtTable>
      <ElEmpty v-else description="当前没有待处理事项" />
    </ElCard>

    <ElCard v-if="!isElderlyFriendly && showConfirmDetails" class="panel-card" shadow="never">
      <template #header>
        <div class="panel-header">
          <div>
            <strong>考核确认明细</strong>
            <p>未完成时请填写整改措施；提交后进入负责人审核，不能直接反复修改。</p>
          </div>
        </div>
      </template>
      <ElTabs v-model="activeConfirmTab">
        <ElTabPane label="全员通用" name="common">
          <ArtTable :data="commonAssessmentItems" style="width: 100%" size="large" :border="false">
            <ElTableColumn prop="moduleName" label="模块" width="150" />
            <ElTableColumn label="考核内容" min-width="280">
              <template #default="{ row }">
                <div class="assessment-title-cell">
                  <strong>{{ row.title }}</strong>
                  <ElTag v-if="row.isRedline" type="danger" size="small">红线</ElTag>
                  <p>{{ row.standard }}</p>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="130" align="center">
              <template #default="{ row }">
                <ElButton
                  :type="statusType(commonDrafts[row.id]?.status)"
                  @click="toggleAssessment(row.id, 'common')"
                >
                  {{ getStatusLabel(commonDrafts[row.id]?.status ?? 'completed') }}
                </ElButton>
              </template>
            </ElTableColumn>
            <ElTableColumn label="整改措施" min-width="240">
              <template #default="{ row }">
                <ElInput
                  v-model="commonDrafts[row.id].rectification"
                  placeholder="未完成时填写整改措施"
                  @change="persistAssessment(row.id, 'common')"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn label="备注" min-width="180">
              <template #default="{ row }">
                <ElInput
                  v-model="commonDrafts[row.id].remark"
                  placeholder="备注"
                  @change="persistAssessment(row.id, 'common')"
                />
              </template>
            </ElTableColumn>
          </ArtTable>
        </ElTabPane>
        <ElTabPane label="板块专项" name="board">
          <ArtTable :data="currentBoardItems" style="width: 100%" size="large" :border="false">
            <ElTableColumn prop="moduleName" label="模块" width="150" />
            <ElTableColumn label="考核内容" min-width="280">
              <template #default="{ row }">
                <div class="assessment-title-cell">
                  <strong>{{ row.title }}</strong>
                  <ElTag v-if="row.isRedline" type="danger" size="small">红线</ElTag>
                  <p>{{ row.standard }}</p>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="130" align="center">
              <template #default="{ row }">
                <ElButton
                  :type="statusType(boardDrafts[row.id]?.status)"
                  @click="toggleAssessment(row.id, 'board')"
                >
                  {{ getStatusLabel(boardDrafts[row.id]?.status ?? 'completed') }}
                </ElButton>
              </template>
            </ElTableColumn>
            <ElTableColumn label="整改措施" min-width="240">
              <template #default="{ row }">
                <ElInput
                  v-model="boardDrafts[row.id].rectification"
                  placeholder="未完成时填写整改措施"
                  @change="persistAssessment(row.id, 'board')"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn label="备注" min-width="180">
              <template #default="{ row }">
                <ElInput
                  v-model="boardDrafts[row.id].remark"
                  placeholder="备注"
                  @change="persistAssessment(row.id, 'board')"
                />
              </template>
            </ElTableColumn>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import AssessmentNoticeTicker from '@/views/assessment/components/AssessmentNoticeTicker.vue'
  import type {
    AssessmentItem,
    AssessmentStatus,
    AssessmentTodoItem,
    TaskItem
  } from '@/types/assessment'

  const router = useRouter()
  const submitResultVisible = ref(false)
  const showConfirmDetails = ref(false)
  const activeConfirmTab = ref<'common' | 'board'>('common')
  const {
    loading,
    currentAssessmentCycle,
    currentEmployee,
    commonAssessmentItems,
    currentBoardItems,
    currentTasks,
    commonDrafts,
    boardDrafts,
    myTodoSummary,
    myPendingItems,
    myReturnedItems,
    myRectifyingItems,
    summary,
    submitCurrentCycle,
    toggleAssessment,
    persistAssessment,
    formatRate,
    getStatusLabel
  } = useAssessmentPlatform()

  const isElderlyFriendly = computed(() => Boolean(currentEmployee.value.elderlyFriendly))
  const overdueTasks = computed(() => currentTasks.value.filter((task) => task.overdueLocked))
  const nearDeadlineTasks = computed(() =>
    currentTasks.value.filter((task) => !task.overdueLocked && isNearDeadline(task))
  )
  const deadlineAlert = computed(() => {
    if (overdueTasks.value.length)
      return `有 ${overdueTasks.value.length} 项任务已逾期，需联系负责人延期后才能提交。`
    if (myReturnedItems.value.length)
      return `有 ${myReturnedItems.value.length} 项被退回，请补充后重新提交。`
    if (nearDeadlineTasks.value.length)
      return `有 ${nearDeadlineTasks.value.length} 项任务临近截止，请优先处理。`
    return ''
  })

  const noticeMessages = computed(() => [
    `提交截止：${currentAssessmentCycle.value.submitDeadline}`,
    `审核截止：${currentAssessmentCycle.value.reviewDeadline}`,
    overdueTasks.value.length
      ? `已逾期 ${overdueTasks.value.length} 项，普通员工不能再提交，需负责人延期`
      : '没有逾期任务',
    nearDeadlineTasks.value.length
      ? `临近截止 ${nearDeadlineTasks.value.length} 项，请先处理`
      : '待办会在本页集中显示'
  ])

  const actionTodoCount = computed(
    () =>
      myTodoSummary.value.pending + myTodoSummary.value.returned + myTodoSummary.value.rectifying
  )

  const todoTableRows = computed(() => [
    ...myReturnedItems.value.map((item) => toTodoRow(item, 'danger', '去补充')),
    ...myRectifyingItems.value.map((item) => toTodoRow(item, 'warning', '继续整改')),
    ...myPendingItems.value
      .slice(0, isElderlyFriendly.value ? 8 : 14)
      .map((item) =>
        toTodoRow(item, item.source === 'task' ? 'primary' : 'success', item.actionText)
      )
  ])

  async function confirmSubmit() {
    await ElMessageBox.confirm(
      '提交后将进入负责人审核；如被退回，需要按意见补充后重新提交。确认提交本周期考核吗？',
      '提交确认',
      { confirmButtonText: '确认提交', cancelButtonText: '再检查一下', type: 'warning' }
    )
    await submitCurrentCycle()
    submitResultVisible.value = true
  }

  function toggleConfirmDetails() {
    showConfirmDetails.value = !showConfirmDetails.value
  }

  function toTodoRow(item: AssessmentTodoItem, tagType: string, actionText: string) {
    const assessmentItem = findAssessmentItem(item)
    return {
      ...item,
      tagType: getTodoTagType(item, assessmentItem, tagType),
      sourceText: getSourceText(item, assessmentItem),
      standard: assessmentItem?.standard || item.description,
      statusText: getWorkflowText(item.workflowStatus),
      statusType: getWorkflowTagType(item.workflowStatus),
      actionText,
      action: () => goTodo(item)
    }
  }

  function goTodo(item: AssessmentTodoItem) {
    if (item.source === 'task') {
      router.push({
        path: '/employee-assessment/tasks',
        query: { taskId: item.id.replace('my-task-', '') }
      })
      return
    }
    if (item.source === 'rectification') {
      router.push('/employee-assessment/rectification')
      return
    }
    router.push({
      path: '/employee-assessment/tasks',
      query: {
        assessmentId: item.id.replace('my-assessment-', ''),
        scope: item.boardId === 'allStaff' ? 'common' : 'board'
      }
    })
  }

  function getSourceText(item: AssessmentTodoItem, assessmentItem?: AssessmentItem) {
    if (item.source === 'task') {
      const task = findTaskItem(item)
      return task?.source === '医院安排' ? '医院安排' : '负责人安排'
    }
    if (item.source === 'rectification') return '整改'
    if (assessmentItem?.isRedline) return '红线考核'
    return item.boardId === 'allStaff' ? '全员通用' : '岗位专项'
  }

  function getTodoTagType(
    item: AssessmentTodoItem,
    assessmentItem: AssessmentItem | undefined,
    fallback: string
  ) {
    if (assessmentItem?.isRedline) return 'danger'
    if (item.source === 'task') {
      const task = findTaskItem(item)
      return task?.source === '医院安排' ? 'primary' : 'warning'
    }
    if (item.source === 'rectification') return 'danger'
    if (item.boardId === 'allStaff') return 'success'
    return fallback
  }

  function findAssessmentItem(item: AssessmentTodoItem) {
    if (item.source !== 'assessment') return undefined
    const itemId = item.id.replace('my-assessment-', '')
    return [...commonAssessmentItems.value, ...currentBoardItems.value].find(
      (assessment) => assessment.id === itemId
    )
  }

  function findTaskItem(item: AssessmentTodoItem) {
    if (item.source !== 'task') return undefined
    const taskId = item.id.replace('my-task-', '')
    return currentTasks.value.find((task) => task.id === taskId)
  }

  function getWorkflowText(status: string) {
    if (status === 'submitted') return '待审核'
    if (status === 'returned') return '已退回'
    if (status === 'rectifying') return '整改中'
    if (status === 'approved' || status === 'closed') return '已完成'
    return '待提交'
  }

  function getWorkflowTagType(status: string) {
    if (status === 'returned') return 'danger'
    if (status === 'submitted' || status === 'rectifying') return 'warning'
    if (status === 'approved' || status === 'closed') return 'success'
    return 'info'
  }

  function statusType(status?: AssessmentStatus) {
    if (status === 'pending') return 'danger' as const
    if (status === 'na') return 'info' as const
    return 'success' as const
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
  .employee-assessment-page {
    padding: 4px;
  }

  .page-alert,
  .panel-card {
    margin-bottom: 16px;
  }

  .hero-card {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
    min-height: 180px;
    padding: 28px;
    margin-bottom: 16px;
    color: #fff;
    background: linear-gradient(135deg, #0f766e, #075985 62%, #1d4ed8);
    border-radius: 18px;

    h1 {
      margin: 16px 0 10px;
      font-size: 34px;
    }

    p {
      max-width: 680px;
      margin: 0;
      line-height: 1.8;
      color: rgb(255 255 255 / 84%);
    }
  }

  .hero-score {
    min-width: 150px;
    padding: 18px;
    text-align: center;
    background: rgb(255 255 255 / 16%);
    border-radius: 14px;

    span,
    small {
      display: block;
      color: rgb(255 255 255 / 84%);
    }

    strong {
      display: block;
      margin: 8px 0;
      font-size: 44px;
    }
  }

  .panel-card {
    border: 0;
    border-radius: 12px;
  }

  .panel-header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;

    p {
      margin: 6px 0 0;
      color: #64748b;
    }
  }

  .panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }

  .todo-title-cell {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-width: 0;

    > div {
      min-width: 0;
    }

    span {
      display: block;
      overflow: hidden;
      color: #0f172a;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    p {
      margin: 4px 0 0;
      line-height: 1.5;
      color: #64748b;
      white-space: normal;
    }
  }

  .assessment-title-cell {
    strong {
      display: inline-block;
      margin-right: 8px;
      color: #0f172a;
    }

    p {
      margin: 6px 0 0;
      line-height: 1.6;
      color: #64748b;
    }
  }

  .is-elderly-friendly {
    font-size: 17px;

    .hero-card {
      min-height: 150px;
    }

    .hero-card h1 {
      font-size: 36px;
    }

    :deep(.el-button) {
      min-height: 42px;
      font-size: 16px;
    }

    :deep(.el-table__cell) {
      padding-top: 14px;
      padding-bottom: 14px;
    }
  }

  @media (width <= 768px) {
    .hero-card,
    .panel-header {
      flex-direction: column;
      align-items: stretch;
    }

    .hero-score {
      width: 100%;
    }
  }
</style>
