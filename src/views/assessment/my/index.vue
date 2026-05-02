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
          {{ currentEmployee.name }}，{{
            permissionSummary
          }}。先处理红色和黄色提醒，完成后提交等待负责人审核。
        </p>
      </div>
      <div class="hero-score">
        <span>当前得分</span>
        <strong>{{ summary.finalScore }}</strong>
        <small>完成率 {{ formatRate(summary.completionRate) }}</small>
      </div>
    </section>

    <ElRow :gutter="16" class="metric-row">
      <ElCol v-for="metric in metrics" :key="metric.label" :xs="12" :md="6">
        <ElCard class="metric-card" shadow="never">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </ElCard>
      </ElCol>
    </ElRow>

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
            <p>系统已经把考核项、任务、退回和整改收在一个入口里。</p>
          </div>
          <ElButton type="primary" size="large" :loading="loading" @click="confirmSubmit">
            提交本周期考核
          </ElButton>
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
              <span>{{ row.title }}</span>
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

    <ElCard v-if="!isElderlyFriendly" class="panel-card" shadow="never">
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
  import type { AssessmentStatus, AssessmentTodoItem, TaskItem } from '@/types/assessment'

  const router = useRouter()
  const submitResultVisible = ref(false)
  const activeConfirmTab = ref<'common' | 'board'>('common')
  const {
    loading,
    currentAssessmentCycle,
    currentEmployee,
    permissionSummary,
    commonAssessmentItems,
    currentBoardItems,
    currentTasks,
    commonDrafts,
    boardDrafts,
    rectificationItems,
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

  const metrics = computed(() => [
    {
      label: '待处理',
      value:
        myTodoSummary.value.pending + myTodoSummary.value.returned + myTodoSummary.value.rectifying,
      hint: '需要本人处理'
    },
    { label: '待审核', value: myTodoSummary.value.reviewing, hint: '已提交等待审核' },
    {
      label: '整改中',
      value:
        myTodoSummary.value.rectifying ||
        rectificationItems.value.filter((item) => item.status !== '已销号').length,
      hint: '需补救闭环'
    },
    {
      label: '已完成',
      value: myTodoSummary.value.completed || summary.value.completedCount,
      hint: '本周期完成项'
    }
  ])

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

  function toTodoRow(item: AssessmentTodoItem, tagType: string, actionText: string) {
    return {
      ...item,
      tagType,
      sourceText: getSourceText(item.source),
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
    activeConfirmTab.value = item.boardId === 'allStaff' ? 'common' : 'board'
  }

  function getSourceText(source: string) {
    if (source === 'task') return '任务'
    if (source === 'rectification') return '整改'
    return '考核'
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
  .metric-row,
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

  .metric-card,
  .panel-card {
    border: 0;
    border-radius: 12px;
  }

  .metric-card {
    span,
    small {
      color: #64748b;
    }

    strong {
      display: block;
      margin: 8px 0 4px;
      font-size: 30px;
      color: #0f172a;
    }
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

  .todo-title-cell {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;

    span:last-child {
      overflow: hidden;
      color: #0f172a;
      text-overflow: ellipsis;
      white-space: nowrap;
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
