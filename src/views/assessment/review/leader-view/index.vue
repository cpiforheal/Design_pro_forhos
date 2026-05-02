<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">领导视角</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500"
          >院领导重点查看全院完成率、风险、整改闭环和趋势结果。</p
        >
      </div>
    </template>

    <ElRow :gutter="16">
      <ElCol :span="6"
        ><ElStatistic title="完成率" :value="Math.round(summary.completionRate * 100)" suffix="%"
      /></ElCol>
      <ElCol :span="6"><ElStatistic title="待整改" :value="rectificationItems.length" /></ElCol>
      <ElCol :span="6"><ElStatistic title="最终得分" :value="summary.finalScore" /></ElCol>
      <ElCol :span="6"
        ><ElStatistic title="当前周期状态" :value="summary.pendingCount" :suffix="cycleStatusText"
      /></ElCol>
    </ElRow>

    <ElDivider />
    <ElRow :gutter="16">
      <ElCol :span="6"
        ><ElStatistic title="逾期任务" :value="riskSummary.overdueTaskCount"
      /></ElCol>
      <ElCol :span="6"
        ><ElStatistic title="未确认人数" :value="riskSummary.unconfirmedEmployeeCount"
      /></ElCol>
      <ElCol :span="6"><ElStatistic title="红线触发" :value="riskSummary.redlineCount" /></ElCol>
      <ElCol :span="6"
        ><ElStatistic title="可归档人数" :value="confirmationSummary.readyToArchiveCount"
      /></ElCol>
    </ElRow>

    <ElDivider />
    <ElTable :data="boardScoreBars" border>
      <ElTableColumn prop="name" label="板块" min-width="180" />
      <ElTableColumn prop="owner" label="负责人" min-width="220" show-overflow-tooltip />
      <ElTableColumn prop="label" label="完成率" width="120" />
    </ElTable>

    <ElDivider />
    <ElTable :data="riskSummary.lowScoreEmployees" border>
      <ElTableColumn prop="employeeName" label="风险人员" width="140" />
      <ElTableColumn prop="boardName" label="板块" width="180" />
      <ElTableColumn prop="finalScore" label="得分" width="100" />
      <ElTableColumn prop="unfinishedCount" label="未完成" width="100" />
      <ElTableColumn prop="overdueCount" label="逾期任务" width="100" />
      <ElTableColumn prop="rectificationCount" label="未销号整改" width="120" />
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  const {
    boardScoreBars,
    confirmationSummary,
    cycleStatusText,
    rectificationItems,
    riskSummary,
    summary
  } = useAssessmentPlatform()
</script>
