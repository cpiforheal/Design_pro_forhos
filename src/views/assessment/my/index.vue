<template>
  <div class="employee-assessment-page">
    <AssessmentNoticeTicker :messages="noticeMessages" />

    <section class="hero-card">
      <div>
        <el-tag type="success" size="large">{{ currentAssessmentCycle.name }}</el-tag>
        <h1>我的考核</h1>
        <p
          >{{ currentEmployee.name }}，{{
            permissionSummary
          }}。请按待办逐项确认，提交后等待负责人审核。</p
        >
      </div>
      <div class="hero-score">
        <span>当前得分</span>
        <strong>{{ summary.finalScore }}</strong>
        <small>完成率 {{ formatRate(summary.completionRate) }}</small>
      </div>
    </section>

    <el-row :gutter="16" class="metric-row">
      <el-col v-for="metric in metrics" :key="metric.label" :xs="12" :md="6">
        <el-card class="metric-card" shadow="never">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </el-card>
      </el-col>
    </el-row>

    <el-alert
      v-if="submitResultVisible"
      class="result-alert"
      type="success"
      show-icon
      title="提交成功，已进入负责人审核流程"
      description="后续如被退回，请在“我的整改”中查看退回原因并补充整改。"
      :closable="true"
      @close="submitResultVisible = false"
    />

    <el-row :gutter="16">
      <el-col :xs="24" :lg="15">
        <el-card class="panel-card" shadow="never">
          <template #header>
            <div class="panel-header">
              <div>
                <strong>本周待办</strong>
                <p>把全员通用、所属板块、本周任务收敛到一个入口。</p>
              </div>
              <el-button type="primary" size="large" :loading="loading" @click="confirmSubmit"
                >提交本周期考核</el-button
              >
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
            <ElTableColumn label="事项" min-width="260">
              <template #default="{ row }">
                <div class="todo-title-cell">
                  <ElTag :type="row.tagType" effect="light" size="small">{{ row.source }}</ElTag>
                  <span>{{ row.title }}</span>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="boardName" label="归属" min-width="150" />
            <ElTableColumn prop="deadline" label="截止/要求" min-width="170" />
            <ElTableColumn label="状态" width="100" align="center">
              <template #default="{ row }">
                <ElTag :type="row.statusType" size="small">{{ row.statusText }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="110" align="center" fixed="right">
              <template #default="{ row }">
                <ElButton type="primary" link @click="row.action">{{ row.actionText }}</ElButton>
              </template>
            </ElTableColumn>
          </ArtTable>
          <el-empty v-else description="当前没有待处理事项" />
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="9">
        <el-card class="panel-card" shadow="never">
          <template #header>
            <div class="panel-title-block">
              <strong>任务处理概览</strong>
              <p>当前任务待处理 / 已完成</p>
            </div>
          </template>
          <ArtBarChart
            height="220px"
            :data="taskStatusChartData"
            :x-axis-data="taskStatusXAxis"
            :show-legend="false"
            :show-axis-line="false"
            bar-width="34%"
          />
          <div class="task-chart-summary">
            <span>待处理 {{ taskStatusStats.pending }} 项</span>
            <span>已完成 {{ taskStatusStats.completed }} 项</span>
          </div>
        </el-card>

        <el-card class="panel-card" shadow="never">
          <AssessmentCalendarCard
            :items="calendarItems"
            title="我的任务日历"
            subtitle="点击日期查看当天完成、未完成和上级下发任务"
            @task-click="goCalendarTask"
          />
        </el-card>

        <el-card class="panel-card" shadow="never">
          <template #header><strong>状态说明</strong></template>
          <div class="timeline-list">
            <div class="timeline-item active">
              <b>待提交</b>
              <span>员工确认完成情况、备注和整改说明。</span>
            </div>
            <div class="timeline-item">
              <b>待审核</b>
              <span>提交后由板块负责人审核。</span>
            </div>
            <div class="timeline-item">
              <b>已退回 / 整改中</b>
              <span>按审核意见补充材料或整改措施。</span>
            </div>
            <div class="timeline-item">
              <b>已通过 / 已销号</b>
              <span>进入本周期结果和归档。</span>
            </div>
          </div>
        </el-card>

        <el-card class="panel-card" shadow="never">
          <template #header><strong>我的结果</strong></template>
          <div class="result-grid">
            <div
              ><span>适用项目</span><b>{{ resultStats.totalApplicable }}</b></div
            >
            <div
              ><span>已完成</span><b>{{ resultStats.completedCount }}</b></div
            >
            <div
              ><span>未完成</span><b>{{ resultStats.pendingCount }}</b></div
            >
            <div
              ><span>红线扣分</span><b>{{ summary.redlinePenalty }}</b></div
            >
          </div>
          <el-progress
            class="result-progress"
            :percentage="Math.round(resultStats.completionRate * 100)"
            :stroke-width="12"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-card class="panel-card" shadow="never">
      <template #header>
        <div class="panel-header">
          <div>
            <strong>考核确认明细</strong>
            <p>点击“去确认 / 去填写”后在这里直接切换状态，并填写整改措施或备注。</p>
          </div>
        </div>
      </template>
      <ElTabs v-model="activeConfirmTab">
        <ElTabPane label="全员通用" name="common">
          <ArtTable
            :data="commonAssessmentItems"
            style="width: 100%"
            size="large"
            :border="false"
            :stripe="false"
            :header-cell-style="{ background: 'transparent' }"
            empty-text="暂无全员通用考核项"
          >
            <ElTableColumn prop="moduleName" label="模块" width="150" />
            <ElTableColumn label="考核内容" min-width="260">
              <template #default="{ row }">
                <div class="assessment-title-cell">
                  <strong>{{ row.title }}</strong>
                  <ElTag v-if="row.isRedline" type="danger" size="small">红线</ElTag>
                  <p>{{ row.standard }}</p>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="120" align="center">
              <template #default="{ row }">
                <ElButton
                  :type="statusType(commonDrafts[row.id]?.status)"
                  @click="toggleAssessment(row.id, 'common')"
                >
                  {{ getStatusLabel(commonDrafts[row.id]?.status ?? 'completed') }}
                </ElButton>
              </template>
            </ElTableColumn>
            <ElTableColumn label="整改措施" min-width="220">
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
          <ArtTable
            :data="currentBoardItems"
            style="width: 100%"
            size="large"
            :border="false"
            :stripe="false"
            :header-cell-style="{ background: 'transparent' }"
            empty-text="暂无板块专项考核项"
          >
            <ElTableColumn prop="moduleName" label="模块" width="150" />
            <ElTableColumn label="考核内容" min-width="260">
              <template #default="{ row }">
                <div class="assessment-title-cell">
                  <strong>{{ row.title }}</strong>
                  <ElTag v-if="row.isRedline" type="danger" size="small">红线</ElTag>
                  <p>{{ row.standard }}</p>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="120" align="center">
              <template #default="{ row }">
                <ElButton
                  :type="statusType(boardDrafts[row.id]?.status)"
                  @click="toggleAssessment(row.id, 'board')"
                >
                  {{ getStatusLabel(boardDrafts[row.id]?.status ?? 'completed') }}
                </ElButton>
              </template>
            </ElTableColumn>
            <ElTableColumn label="整改措施" min-width="220">
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
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import AssessmentCalendarCard, {
    type AssessmentCalendarItem
  } from '@/views/assessment/components/AssessmentCalendarCard.vue'
  import AssessmentNoticeTicker from '@/views/assessment/components/AssessmentNoticeTicker.vue'
  import type { AssessmentStatus } from '@/types/assessment'

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
    hospitalTaskDrafts,
    boardTaskDrafts,
    rectificationItems,
    myTodoSummary,
    summary,
    submitCurrentCycle,
    toggleAssessment,
    persistAssessment,
    formatRate,
    getStatusLabel
  } = useAssessmentPlatform()

  const taskStatusStats = computed(() =>
    currentTasks.value.reduce(
      (stats, task) => {
        const draft =
          task.source === '医院安排'
            ? hospitalTaskDrafts.value[task.id]
            : boardTaskDrafts.value[task.id]
        const status = draft?.status ?? 'completed'
        if (status === 'completed') stats.completed += 1
        else stats.pending += 1
        return stats
      },
      { pending: 0, completed: 0 }
    )
  )

  const taskStatusXAxis = ['待处理', '已完成']
  const taskStatusChartData = computed(() => [
    taskStatusStats.value.pending,
    taskStatusStats.value.completed
  ])

  const noticeMessages = computed(() => [
    `全员通用和板块考核统一提交截止：${currentAssessmentCycle.value.submitDeadline}`,
    `审核截止：${currentAssessmentCycle.value.reviewDeadline}，提交后由负责人确认`,
    ...currentTasks.value
      .slice(0, 6)
      .map((task) => `${task.source}：${task.title}，完成时限 ${task.deadline}`)
  ])

  const calendarItems = computed<AssessmentCalendarItem[]>(() =>
    currentTasks.value.map((task) => {
      const draft =
        task.source === '医院安排'
          ? hospitalTaskDrafts.value[task.id]
          : boardTaskDrafts.value[task.id]
      return {
        id: task.id,
        title: task.title,
        source: task.source,
        owner: task.owner,
        deadline: task.deadline,
        status: draft?.status ?? 'completed'
      }
    })
  )

  const resultStats = computed(() => ({
    totalApplicable: summary.value.totalApplicable,
    completedCount: summary.value.completedCount,
    pendingCount: summary.value.pendingCount,
    completionRate: summary.value.completionRate
  }))

  const todoTableRows = computed(() => {
    const commonTodos = commonAssessmentItems.value.slice(0, 4).map((item) => ({
      id: `common-${item.id}`,
      source: '全员通用',
      tagType: 'success' as const,
      title: item.title,
      description: item.standard,
      boardName: item.moduleName,
      deadline: currentAssessmentCycle.value.submitDeadline,
      statusText: getStatusLabel(commonDrafts.value[item.id]?.status ?? 'completed'),
      statusType: statusType(commonDrafts.value[item.id]?.status),
      actionText: '去确认',
      action: () => {
        activeConfirmTab.value = 'common'
      }
    }))

    const boardTodos = currentBoardItems.value.slice(0, 4).map((item) => ({
      id: `board-${item.id}`,
      source: '板块考核',
      tagType: 'warning' as const,
      title: item.title,
      description: item.standard,
      boardName: item.moduleName,
      deadline: currentAssessmentCycle.value.submitDeadline,
      statusText: getStatusLabel(boardDrafts.value[item.id]?.status ?? 'completed'),
      statusType: statusType(boardDrafts.value[item.id]?.status),
      actionText: '去填写',
      action: () => {
        activeConfirmTab.value = 'board'
      }
    }))

    const taskTodos = currentTasks.value.slice(0, 4).map((task) => {
      const draft =
        task.source === '医院安排'
          ? hospitalTaskDrafts.value[task.id]
          : boardTaskDrafts.value[task.id]
      return {
        id: `task-${task.id}`,
        source: '本周任务',
        tagType: 'primary' as const,
        title: task.title,
        boardName: `${task.source} · ${task.owner}`,
        deadline: task.deadline,
        statusText: getStatusLabel(draft?.status ?? 'completed'),
        statusType: statusType(draft?.status),
        actionText: '处理任务',
        action: () =>
          router.push({ path: '/employee-assessment/tasks', query: { taskId: task.id } })
      }
    })

    const rectifyTodos = rectificationItems.value.slice(0, 3).map((item) => ({
      id: `rectification-${item.id}`,
      source: '整改事项',
      tagType: 'danger' as const,
      title: item.description,
      description: item.rectification,
      boardName: item.boardName,
      deadline: '按审核要求尽快完成',
      statusText: item.status,
      statusType: item.status === '已销号' ? ('success' as const) : ('danger' as const),
      actionText: '查看整改',
      action: () => router.push('/employee-assessment/rectification')
    }))

    return [...rectifyTodos, ...commonTodos, ...boardTodos, ...taskTodos]
  })

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

  function goCalendarTask(item: AssessmentCalendarItem) {
    router.push({ path: '/employee-assessment/tasks', query: { taskId: item.id } })
  }

  async function confirmSubmit() {
    await ElMessageBox.confirm(
      '提交后将进入负责人审核流程。如被退回，需要按意见补充整改。确认提交本周期考核吗？',
      '提交确认',
      { confirmButtonText: '确认提交', cancelButtonText: '再检查一下', type: 'warning' }
    )
    await submitCurrentCycle()
    submitResultVisible.value = true
  }

  function statusType(status?: AssessmentStatus) {
    if (status === 'pending') return 'danger' as const
    if (status === 'na') return 'info' as const
    return 'success' as const
  }
</script>

<style scoped lang="scss">
  .employee-assessment-page {
    padding: 4px;
  }

  .hero-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    min-height: 180px;
    padding: 28px;
    margin-bottom: 16px;
    color: #fff;
    border-radius: 24px;
    background: linear-gradient(135deg, #0f766e, #075985 62%, #1d4ed8);
    box-shadow: 0 18px 45px rgb(15 118 110 / 22%);

    h1 {
      margin: 16px 0 10px;
      font-size: 34px;
    }

    p {
      max-width: 680px;
      margin: 0;
      color: rgb(255 255 255 / 82%);
      line-height: 1.8;
    }
  }

  .hero-score {
    min-width: 150px;
    padding: 18px;
    text-align: center;
    border-radius: 20px;
    background: rgb(255 255 255 / 16%);

    span,
    small {
      display: block;
      color: rgb(255 255 255 / 82%);
    }

    strong {
      display: block;
      margin: 8px 0;
      font-size: 44px;
    }
  }

  .metric-row {
    margin-bottom: 16px;
  }

  .metric-card {
    border: 0;
    border-radius: 18px;

    span,
    small {
      color: #64748b;
    }

    strong {
      display: block;
      margin: 8px 0 4px;
      color: #0f172a;
      font-size: 30px;
    }
  }

  .result-alert {
    margin-bottom: 16px;
  }

  .panel-card {
    margin-bottom: 16px;
    border: 0;
    border-radius: 18px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    p {
      margin: 6px 0 0;
      color: #64748b;
    }
  }

  .panel-title-block {
    p {
      margin: 6px 0 0;
      color: #64748b;
      font-weight: 400;
    }
  }

  .todo-title-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;

    span:last-child {
      overflow: hidden;
      color: #0f172a;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .task-chart-summary {
    display: flex;
    justify-content: space-around;
    gap: 12px;
    margin-top: 10px;
    color: #64748b;
    font-size: 13px;
  }

  .assessment-title-cell {
    strong {
      display: inline-block;
      margin-right: 8px;
      color: #0f172a;
    }

    p {
      margin: 6px 0 0;
      color: #64748b;
      line-height: 1.6;
    }
  }

  .timeline-list {
    display: grid;
    gap: 12px;
  }

  .timeline-item {
    padding: 14px;
    border-left: 4px solid #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;

    &.active {
      border-left-color: #0f766e;
      background: #ecfdf5;
    }

    b,
    span {
      display: block;
    }

    span {
      margin-top: 4px;
      color: #64748b;
    }
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    div {
      padding: 14px;
      border-radius: 14px;
      background: #f8fafc;
    }

    span,
    b {
      display: block;
    }

    span {
      color: #64748b;
    }

    b {
      margin-top: 6px;
      color: #0f766e;
      font-size: 24px;
    }
  }

  .result-progress {
    margin-top: 16px;
  }

  @media (max-width: 768px) {
    .hero-card,
    .panel-header {
      align-items: stretch;
      flex-direction: column;
    }

    .hero-score {
      width: 100%;
    }
  }
</style>
