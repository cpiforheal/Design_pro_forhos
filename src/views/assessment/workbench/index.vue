<template>
  <div class="assessment-analysis-page">
    <AssessmentNoticeTicker :messages="noticeMessages" />

    <ElRow :gutter="20">
      <ElCol :xl="14" :lg="15" :xs="24">
        <div class="art-card h-82 p-5 mb-5 overflow-hidden max-lg:h-auto max-sm:mb-4">
          <div class="art-card-header pr-0">
            <div class="title">
              <h4>考核工作台</h4>
              <p>{{ currentBoard.name }} · {{ permissionSummary }}</p>
            </div>
            <div class="flex items-center gap-3">
              <div
                class="flex-cc h-7.5 min-w-17 border border-g-300 rounded-lg text-g-500 c-p"
                @click="exportCurrentResult"
              >
                <ArtSvgIcon icon="ri:arrow-up-line" class="text-base mr-1.5" />
                <span class="text-xs">导出</span>
              </div>
            </div>
          </div>

          <div class="mt-2">
            <ElRow :gutter="20">
              <ElCol v-for="item in metricCards" :key="item.label" :span="6" :xs="24">
                <div
                  class="flex px-5 flex-col justify-center h-55 border border-g-300/85 rounded-xl max-lg:mb-4 max-sm:flex-row max-sm:justify-between max-sm:items-center max-sm:h-40"
                >
                  <div class="size-12 rounded-lg flex-cc bg-theme/10">
                    <ArtSvgIcon :icon="item.icon" class="text-xl text-theme" />
                  </div>

                  <div class="max-sm:ml-4 mt-3.5 max-sm:mt-0 max-sm:text-end">
                    <ArtCountTo
                      class="text-2xl font-medium"
                      :target="item.value"
                      :duration="1200"
                    />
                    <span v-if="item.suffix" class="ml-1 text-xl font-medium">{{
                      item.suffix
                    }}</span>
                    <p class="mt-2 text-base text-g-600 max-sm:mt-1">{{ item.label }}</p>
                    <small class="text-g-500 mt-1 max-sm:mt-0.5">
                      {{ item.caption }}
                      <span class="font-medium" :class="item.trendClass">{{ item.trend }}</span>
                    </small>
                  </div>
                </div>
              </ElCol>
            </ElRow>
          </div>
        </div>
      </ElCol>

      <ElCol :xl="10" :lg="9" :xs="24">
        <div class="art-card h-82 p-5 mb-5 overflow-hidden max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>考核趋势洞察</h4>
              <p>完成率 / 任务闭环率</p>
            </div>
          </div>
          <ArtLineChart
            height="calc(100% - 44px)"
            :data="trendLineData"
            :x-axis-data="trendXAxis"
            :show-legend="true"
            :show-axis-line="false"
            :show-area-color="true"
            legend-position="bottom"
          />
        </div>
      </ElCol>
    </ElRow>

    <ElRow v-if="medicalRecordReviewTodoItems.length" :gutter="20">
      <ElCol :span="24">
        <div class="art-card p-5 mb-5 medical-review-card">
          <div class="art-card-header">
            <div class="title">
              <h4>病历审核通知</h4>
              <p>指定给当前账号的病历已提交，请审核医师确认后完成归档</p>
            </div>
            <ElTag type="warning" effect="light"
              >{{ medicalRecordReviewTodoItems.length }} 条待确认</ElTag
            >
          </div>
          <div class="medical-review-list">
            <div
              v-for="item in medicalRecordReviewTodoItems"
              :key="item.id"
              class="medical-review-item"
            >
              <div>
                <strong>{{ item.title }}</strong>
                <p
                  >{{ item.caseNo }} · 提交人：{{ item.updatedByName || '协作岗位' }} ·
                  {{ item.updatedAt }}</p
                >
              </div>
              <ElButton type="primary" @click="goMedicalRecord(item.id)">去确认</ElButton>
            </div>
          </div>
        </div>
      </ElCol>
    </ElRow>

    <ElRow :gutter="20">
      <ElCol :xl="10" :lg="10" :xs="24">
        <div class="art-card h-100 p-5 mb-5 max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>板块完成度</h4>
              <p>各业务板块专项考核完成率</p>
            </div>
          </div>
          <ArtBarChart
            height="calc(100% - 42px)"
            :data="boardCompletionData"
            :x-axis-data="boardNames"
            :show-legend="false"
            :show-axis-line="false"
            bar-width="34%"
          />
        </div>
      </ElCol>

      <ElCol :xl="7" :lg="7" :xs="24">
        <div class="art-card h-100 p-5 mb-5 max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>类目完成情况</h4>
              <p>通用、专项、任务、整改</p>
            </div>
          </div>
          <ArtBarChart
            height="calc(100% - 42px)"
            :data="categoryDoneData"
            :x-axis-data="categoryNames"
            :show-legend="true"
            :show-axis-line="false"
            bar-width="22%"
          />
        </div>
      </ElCol>

      <ElCol :xl="7" :lg="7" :xs="24">
        <div class="art-card h-100 p-5 mb-5 max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>任务处理概览</h4>
              <p>当前任务待处理 / 已完成</p>
            </div>
          </div>
          <ArtBarChart
            height="calc(100% - 84px)"
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
        </div>
      </ElCol>
    </ElRow>

    <ElRow :gutter="20">
      <ElCol :xl="10" :lg="10" :xs="24">
        <div class="art-card h-82 p-5 mb-5 overflow-hidden max-sm:mb-4">
          <AssessmentCalendarCard
            :items="calendarItems"
            title="任务日历"
            subtitle="点击日期查看当天任务明细"
            @task-click="goCalendarTask"
          />
        </div>
      </ElCol>

      <ElCol :xl="7" :lg="7" :xs="24">
        <div class="art-card h-82 p-5 mb-5 overflow-hidden max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>板块排行榜</h4>
              <p>参考模板热门产品表格样式</p>
            </div>
          </div>
          <div class="overflow-auto h-full">
            <ArtTable
              :data="boardRankingRows"
              style="width: 100%"
              size="large"
              :border="false"
              :stripe="false"
              :header-cell-style="{ background: 'transparent' }"
            >
              <ElTableColumn prop="name" label="板块名称" min-width="180" />
              <ElTableColumn prop="rate" label="完成度" min-width="160">
                <template #default="{ row }">
                  <ElProgress
                    :percentage="row.rate"
                    :color="row.color"
                    :stroke-width="5"
                    :show-text="false"
                  />
                </template>
              </ElTableColumn>
              <ElTableColumn prop="score" label="得分" width="92">
                <template #default="{ row }">
                  <span class="score-tag" :style="{ color: row.color, borderColor: row.color }">{{
                    row.score
                  }}</span>
                </template>
              </ElTableColumn>
            </ArtTable>
          </div>
        </div>
      </ElCol>

      <ElCol :xl="7" :lg="7" :xs="24">
        <div class="art-card h-82 p-5 mb-5 overflow-hidden max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>本周任务</h4>
              <p>医院安排 + 当前板块任务</p>
            </div>
          </div>
          <div class="overflow-auto h-full">
            <ArtTable
              :data="taskPreviewRows"
              style="width: 100%"
              size="large"
              :border="false"
              :stripe="false"
              :header-cell-style="{ background: 'transparent' }"
            >
              <ElTableColumn prop="title" label="任务" min-width="180" show-overflow-tooltip />
              <ElTableColumn label="来源" min-width="120">
                <template #default="{ row }">
                  <span class="task-source-text">{{ row.source }} · {{ row.owner }}</span>
                </template>
              </ElTableColumn>
              <ElTableColumn label="状态" width="88" align="center">
                <template #default="{ row }">
                  <ElTag :type="row.statusType" size="small">{{ row.status }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="操作" width="86" align="center" fixed="right">
                <template #default="{ row }">
                  <ElButton type="primary" link @click="goCompleteTask(row.id)">去完成</ElButton>
                </template>
              </ElTableColumn>
            </ArtTable>
          </div>
        </div>
      </ElCol>

      <ElCol :xl="7" :lg="7" :xs="24">
        <div class="art-card h-82 p-5 mb-5 overflow-hidden max-sm:mb-4">
          <div class="art-card-header">
            <div class="title">
              <h4>身份与板块</h4>
              <p>当前登录账号与后端数据权限</p>
            </div>
          </div>

          <ElDescriptions :column="1" border size="small" class="workbench-form">
            <ElDescriptionsItem label="当前账号">{{ currentEmployee.name }}</ElDescriptionsItem>
            <ElDescriptionsItem label="工号">{{ currentEmployee.employeeNo }}</ElDescriptionsItem>
            <ElDescriptionsItem label="岗位">{{ currentEmployee.position }}</ElDescriptionsItem>
            <ElDescriptionsItem label="当前板块">
              <ElSelect v-model="selectedBoardId" class="w-full">
                <ElOption
                  v-for="board in visibleBoards"
                  :key="board.id"
                  :label="board.name"
                  :value="board.id"
                />
              </ElSelect>
            </ElDescriptionsItem>
          </ElDescriptions>

          <div class="form-actions">
            <ElButton type="primary" @click="submitCurrentCycle">提交考核</ElButton>
            <ElButton @click="exportCurrentResult">导出 Excel</ElButton>
            <ElButton @click="resetDemoData">刷新数据</ElButton>
          </div>
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import AssessmentCalendarCard, {
    type AssessmentCalendarItem
  } from '@/views/assessment/components/AssessmentCalendarCard.vue'
  import AssessmentNoticeTicker from '@/views/assessment/components/AssessmentNoticeTicker.vue'
  import type { TagProps } from 'element-plus'

  defineOptions({ name: 'AssessmentWorkbench' })

  const router = useRouter()

  const {
    selectedBoardId,
    visibleBoards,
    currentAssessmentCycle,
    currentEmployee,
    permissionSummary,
    currentBoard,
    currentTasks,
    summary,
    rectificationItems,
    categoryStats,
    boardScoreBars,
    hospitalTaskDrafts,
    boardTaskDrafts,
    medicalRecordReviewTodoItems,
    resetDemoData,
    submitCurrentCycle,
    exportCurrentResult,
    getStatusLabel
  } = useAssessmentPlatform()

  const metricCards = computed(() => [
    {
      label: '适用项目',
      value: summary.value.totalApplicable,
      caption: '全员 + 当前板块',
      trend: `+${currentTasks.value.length} 任务`,
      trendClass: 'text-success',
      icon: 'ri:bar-chart-box-ai-line'
    },
    {
      label: '完成率',
      value: Math.round(summary.value.completionRate * 100),
      suffix: '%',
      caption: '已完成',
      trend: `${summary.value.completedCount} 项`,
      trendClass: 'text-success',
      icon: 'ri:bar-chart-grouped-line'
    },
    {
      label: '待整改',
      value: rectificationItems.value.length,
      caption: '自动入账',
      trend: rectificationItems.value.length > 0 ? '需跟进' : '无风险',
      trendClass: rectificationItems.value.length > 0 ? 'text-danger' : 'text-success',
      icon: 'ri:alarm-warning-line'
    },
    {
      label: '最终得分',
      value: summary.value.finalScore,
      caption: '红线扣分',
      trend: `${summary.value.redlinePenalty} 分`,
      trendClass: summary.value.redlinePenalty > 0 ? 'text-danger' : 'text-success',
      icon: 'ri:user-star-line'
    }
  ])

  const trendXAxis = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const trendLineData = computed(() => {
    const rate = Math.round(summary.value.completionRate * 100)
    const taskRate = currentTasks.value.length === 0 ? 100 : Math.max(60, rate - 6)
    return [
      {
        name: '完成率',
        data: [
          Math.max(40, rate - 18),
          rate - 8,
          rate - 10,
          rate - 4,
          rate,
          Math.min(100, rate + 3),
          Math.min(100, rate + 6)
        ]
      },
      {
        name: '任务闭环率',
        data: [
          Math.max(35, taskRate - 15),
          taskRate - 6,
          taskRate - 4,
          taskRate,
          Math.min(100, taskRate + 5),
          Math.min(100, taskRate + 2),
          Math.min(100, taskRate + 8)
        ]
      }
    ]
  })

  const boardNames = computed(() =>
    boardScoreBars.value.map((board) => board.name.replace('板块', ''))
  )
  const boardCompletionData = computed(() =>
    boardScoreBars.value.map((board) => Math.round(board.rate * 100))
  )
  const categoryNames = computed(() => categoryStats.value.map((item) => item.label))
  const categoryDoneData = computed(() => [
    { name: '已完成', data: categoryStats.value.map((item) => item.done) },
    { name: '总数', data: categoryStats.value.map((item) => item.count) }
  ])

  const taskStatusStats = computed(() =>
    currentTasks.value.reduce(
      (stats, task) => {
        const draft =
          task.source === '医院安排'
            ? hospitalTaskDrafts.value[task.id]
            : boardTaskDrafts.value[task.id]
        const status = draft?.status ?? 'pending'
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

  const boardRankingRows = computed(() =>
    boardScoreBars.value.map((board) => ({
      name: board.name,
      rate: Math.round(board.rate * 100),
      score: board.label,
      color: board.color
    }))
  )

  type ElTagType = TagProps['type']

  const noticeMessages = computed(() => [
    ...medicalRecordReviewTodoItems.value.map(
      (item) => `病历审核：${item.title}（${item.caseNo}）已提交给您，请进入病历协作确认完成`
    ),
    `全员通用和板块考核提交截止：${currentBoard.value.name} / ${summary.value.totalApplicable} 项，统一截止 ${currentAssessmentCycle.value.submitDeadline}`,
    `审核截止：${currentAssessmentCycle.value.reviewDeadline}，请负责人按时完成确认`,
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
        status: draft?.status ?? 'pending'
      }
    })
  )

  const taskPreviewRows = computed(() =>
    currentTasks.value.slice(0, 6).map((task) => {
      const draft =
        task.source === '医院安排'
          ? hospitalTaskDrafts.value[task.id]
          : boardTaskDrafts.value[task.id]
      const status = draft?.status ?? 'pending'
      const statusType: ElTagType =
        status === 'completed' ? 'success' : status === 'pending' ? 'warning' : 'info'
      return {
        ...task,
        status: getStatusLabel(status),
        statusType
      }
    })
  )

  function goCompleteTask(taskId: string) {
    router.push({ path: '/assessment/tasks', query: { taskId } })
  }

  function goMedicalRecord(caseId: number) {
    router.push({ path: '/assessment/medical-records', query: { caseId } })
  }

  function goCalendarTask(item: AssessmentCalendarItem) {
    goCompleteTask(item.id)
  }
</script>

<style scoped lang="scss">
  .assessment-analysis-page {
    :deep(.art-card-header) {
      .title {
        h4 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--art-text-gray-900);
        }

        p {
          margin: 4px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--art-text-gray-600);
        }
      }
    }
  }

  .medical-review-card {
    background: linear-gradient(135deg, var(--el-color-warning-light-9), var(--art-main-bg-color));
    border: 1px solid var(--el-color-warning-light-7);
  }

  .medical-review-list {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .medical-review-item {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--art-main-bg-color);
    border: 1px solid var(--art-border-color);
    border-radius: 12px;

    strong {
      color: var(--art-text-gray-900);
    }

    p {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--art-text-gray-500);
    }
  }

  .task-chart-summary {
    display: flex;
    gap: 12px;
    justify-content: space-around;
    margin-top: 8px;
    font-size: 13px;
    color: var(--art-text-gray-600);
  }

  .score-tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 7px;
    font-size: 12px;
    border: 1px solid;
    border-radius: 4px;
  }

  .task-source-text {
    font-size: 12px;
    color: var(--art-text-gray-500);
  }

  .workbench-form {
    margin-top: 6px;

    :deep(.el-form-item__label) {
      font-size: 13px;
      color: var(--art-text-gray-600);
    }
  }

  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
</style>
