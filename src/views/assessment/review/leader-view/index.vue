<template>
  <div class="leader-view">
    <ElCard>
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">领导视角</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            院领导查看全院完成情况，并重点确定板块负责人的周期分数。
          </p>
        </div>
      </template>

      <ElRow :gutter="16">
        <ElCol :span="6">
          <ElStatistic
            title="完成率"
            :value="Math.round(summary.completionRate * 100)"
            suffix="%"
          />
        </ElCol>
        <ElCol :span="6"><ElStatistic title="待整改" :value="rectificationItems.length" /></ElCol>
        <ElCol :span="6"><ElStatistic title="最终得分" :value="summary.finalScore" /></ElCol>
        <ElCol :span="6">
          <ElStatistic
            title="当前周期状态"
            :value="summary.pendingCount"
            :suffix="cycleStatusText"
          />
        </ElCol>
      </ElRow>

      <ElDivider />
      <ElRow :gutter="16">
        <ElCol :span="6"
          ><ElStatistic title="逾期任务" :value="riskSummary.overdueTaskCount"
        /></ElCol>
        <ElCol :span="6">
          <ElStatistic title="未确认人数" :value="riskSummary.unconfirmedEmployeeCount" />
        </ElCol>
        <ElCol :span="6"><ElStatistic title="红线触发" :value="riskSummary.redlineCount" /></ElCol>
        <ElCol :span="6">
          <ElStatistic title="可归档人数" :value="confirmationSummary.readyToArchiveCount" />
        </ElCol>
      </ElRow>
    </ElCard>

    <ElCard class="mt-4">
      <ElSpace wrap class="mb-4">
        <ElButton type="primary" plain @click="goSummary">去汇总看板</ElButton>
        <ElButton plain @click="goRectification">去整改台账</ElButton>
        <ElButton plain @click="goReviewDesk">去审核台</ElButton>
      </ElSpace>
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">板块负责人审核</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            负责人仍保留系统自动分，院长可填写最终确认分并完成复核。
          </p>
        </div>
      </template>

      <ElTable :data="managerResults" border>
        <ElTableColumn prop="employeeName" label="负责人" width="140" />
        <ElTableColumn prop="boardName" label="板块" width="170" />
        <ElTableColumn prop="position" label="岗位" min-width="150" show-overflow-tooltip />
        <ElTableColumn label="系统分 / 院长确认分" width="180">
          <template #default="{ row }">
            <div class="score-stack">
              <strong>{{ row.finalScore }}</strong>
              <span>{{ row.leaderFinalScore ?? '待填写' }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="unfinishedCount" label="未完成" width="90" />
        <ElTableColumn prop="overdueCount" label="逾期" width="80" />
        <ElTableColumn prop="rectificationCount" label="整改" width="80" />
        <ElTableColumn label="院长确认分" width="170">
          <template #default="{ row }">
            <ElInputNumber
              v-model="leaderScoreDrafts[row.userId].score"
              :min="-100"
              :max="100"
              :precision="1"
              :step="0.5"
              controls-position="right"
              :disabled="Boolean(row.leaderScoreConfirmedAt)"
              style="width: 140px"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="确认说明" min-width="210">
          <template #default="{ row }">
            <ElInput
              v-model="leaderScoreDrafts[row.userId].comment"
              placeholder="可填写调整原因或审核意见"
              :disabled="Boolean(row.leaderScoreConfirmedAt)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <ElTag :type="row.leaderScoreConfirmedAt ? 'success' : 'warning'">
              {{ row.leaderScoreConfirmedAt ? '已确认' : '待确认' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="openDetail(row)">明细</ElButton>
            <ElButton
              type="success"
              link
              :disabled="Boolean(row.leaderScoreConfirmedAt)"
              @click="confirmLeaderScore(row)"
            >
              确认
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElCard class="mt-4">
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">全院明细监管</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            这里用于快速查看所有员工的分数、完成和未完成情况。
          </p>
        </div>
      </template>

      <ElTable :data="performanceResults" border>
        <ElTableColumn prop="employeeName" label="员工" width="140" />
        <ElTableColumn prop="boardName" label="板块" width="170" />
        <ElTableColumn prop="position" label="岗位" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="finalScore" label="系统分" width="90" />
        <ElTableColumn prop="leaderFinalScore" label="院长确认分" width="120" />
        <ElTableColumn prop="completionRate" label="完成率" width="100">
          <template #default="{ row }">{{ Math.round(row.completionRate * 100) }}%</template>
        </ElTableColumn>
        <ElTableColumn prop="unfinishedCount" label="未完成" width="90" />
        <ElTableColumn prop="overdueCount" label="逾期" width="80" />
        <ElTableColumn prop="rectificationCount" label="整改" width="80" />
        <ElTableColumn label="确认状态" width="190">
          <template #default="{ row }">
            <ElSpace wrap>
              <ElTag size="small" :type="row.employeeConfirmedAt ? 'success' : 'info'">本人</ElTag>
              <ElTag size="small" :type="row.managerConfirmedAt ? 'success' : 'info'">负责人</ElTag>
              <ElTag size="small" :type="row.reviewGroupConfirmedAt ? 'success' : 'info'">
                复核
              </ElTag>
            </ElSpace>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="openDetail(row)">明细</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDrawer v-model="detailVisible" title="员工考核明细" size="64%">
      <ElSkeleton v-if="detailLoading" :rows="8" animated />
      <div v-else-if="assistDetail" class="detail-body">
        <h3>{{ assistDetail.targetUser.name }}：{{ assistDetail.currentCycle.name }}</h3>
        <ElDivider content-position="left">考核事项</ElDivider>
        <ElTable :data="assistDetail.assessmentItems" border size="small">
          <ElTableColumn prop="moduleName" label="模块" width="140" />
          <ElTableColumn label="事项" min-width="260">
            <template #default="{ row }">
              <strong>{{ row.title }}</strong>
              <p>{{ row.standard }}</p>
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="100">
            <template #default="{ row }">
              <ElTag :type="statusType(assistDetail.assessmentRecords[row.id]?.status)">
                {{ getStatusLabel(assistDetail.assessmentRecords[row.id]?.status ?? 'completed') }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="整改/备注" min-width="220">
            <template #default="{ row }">
              {{
                assistDetail.assessmentRecords[row.id]?.rectification ||
                assistDetail.assessmentRecords[row.id]?.remark ||
                '无'
              }}
            </template>
          </ElTableColumn>
        </ElTable>

        <ElDivider content-position="left">任务事项</ElDivider>
        <ElTable :data="assistDetail.tasks" border size="small">
          <ElTableColumn prop="source" label="来源" width="130" />
          <ElTableColumn prop="title" label="任务" min-width="240" />
          <ElTableColumn prop="taskCategory" label="分类" min-width="180" />
          <ElTableColumn label="状态" width="100">
            <template #default="{ row }">
              <ElTag :type="statusType(assistDetail.taskRecords[row.id]?.status ?? 'pending')">
                {{ getStatusLabel(assistDetail.taskRecords[row.id]?.status ?? 'pending') }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="佐证" min-width="160">
            <template #default="{ row }">
              {{ assistDetail.taskRecords[row.id]?.attachments?.length || 0 }} 个附件
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
      <ElEmpty v-else description="暂无明细" />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watchEffect } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { fetchAssessmentAssist } from '@/api/assessment'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import type {
    AssessmentAssistPayload,
    AssessmentStatus,
    PerformanceResult
  } from '@/types/assessment'

  const {
    confirmationSummary,
    cycleStatusText,
    performanceResults,
    rectificationItems,
    reviewGroupConfirmPerformanceResult,
    riskSummary,
    summary,
    getStatusLabel
  } = useAssessmentPlatform()

  const router = useRouter()
  const leaderScoreDrafts = reactive<Record<number, { score?: number; comment: string }>>({})
  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const assistDetail = ref<AssessmentAssistPayload | null>(null)

  const managerResults = computed(() =>
    performanceResults.value.filter((item) => item.roleCode === 'R_MANAGER')
  )

  watchEffect(() => {
    managerResults.value.forEach((row) => {
      if (!leaderScoreDrafts[row.userId]) {
        leaderScoreDrafts[row.userId] = {
          score: row.leaderFinalScore ?? row.finalScore,
          comment: row.leaderScoreComment || ''
        }
      }
    })
  })

  async function openDetail(row: PerformanceResult) {
    detailVisible.value = true
    detailLoading.value = true
    try {
      assistDetail.value = await fetchAssessmentAssist(row.userId)
    } finally {
      detailLoading.value = false
    }
  }

  async function confirmLeaderScore(row: PerformanceResult) {
    if (row.roleCode !== 'R_MANAGER') {
      ElMessage.warning('院长确认分仅用于板块负责人')
      return
    }
    const draft = leaderScoreDrafts[row.userId]
    const score = Number(draft?.score)
    if (!Number.isFinite(score)) {
      ElMessage.warning('请填写院长确认分')
      return
    }
    await reviewGroupConfirmPerformanceResult(row.userId, {
      comment: draft.comment || '院长确认板块负责人本周期绩效结果',
      leaderFinalScore: score,
      leaderScoreComment: draft.comment || ''
    })
  }

  function goSummary() {
    router.push('/assessment/summary')
  }

  function goRectification() {
    router.push('/assessment/rectification')
  }

  function goReviewDesk() {
    router.push('/assessment-review/desk')
  }

  function statusType(status?: AssessmentStatus) {
    if (status === 'pending') return 'danger'
    if (status === 'na') return 'info'
    return 'success'
  }
</script>

<style scoped lang="scss">
  .leader-view {
    display: grid;
    gap: 16px;
  }

  .score-stack {
    display: grid;
    gap: 2px;

    strong {
      color: #0f172a;
    }

    span {
      color: #64748b;
    }
  }

  .detail-body {
    h3 {
      margin: 0 0 12px;
    }

    p {
      margin: 4px 0 0;
      line-height: 1.5;
      color: #64748b;
    }
  }
</style>
