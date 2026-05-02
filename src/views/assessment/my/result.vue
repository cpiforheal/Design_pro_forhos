<template>
  <div
    class="employee-simple-page"
    :class="{ 'is-elderly-friendly': currentEmployee.elderlyFriendly }"
  >
    <ElCard class="result-card" shadow="never">
      <div class="score-circle">
        <span>当前得分</span>
        <strong>{{ summary.finalScore }}</strong>
      </div>
      <h2>我的结果</h2>
      <p>{{ currentAssessmentCycle.name }} · {{ currentEmployee.name }}</p>
      <ElProgress :percentage="Math.round(summary.completionRate * 100)" :stroke-width="14" />

      <div class="confirm-line">
        <ElTag :type="myPerformanceResult?.employeeConfirmedAt ? 'success' : 'warning'">
          {{ myPerformanceResult?.employeeConfirmedAt ? '已电子确认' : '待电子确认' }}
        </ElTag>
        <ElButton
          type="primary"
          size="large"
          :disabled="Boolean(myPerformanceResult?.employeeConfirmedAt)"
          @click="confirmResult"
        >
          我确认本周期结果
        </ElButton>
      </div>
      <p class="confirm-tip"> 确认后，本人不能再修改本周期记录；如有疑问请先联系负责人处理。 </p>
    </ElCard>

    <ElRow :gutter="16">
      <ElCol v-for="item in resultItems" :key="item.label" :xs="12" :md="6">
        <ElCard class="metric-card" shadow="never">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  const {
    summary,
    currentAssessmentCycle,
    currentEmployee,
    myPerformanceResult,
    confirmMyPerformance
  } = useAssessmentPlatform()

  const resultItems = computed(() => [
    { label: '适用项目', value: summary.value.totalApplicable },
    { label: '已完成', value: summary.value.completedCount },
    { label: '未完成', value: summary.value.pendingCount },
    { label: '红线扣分', value: summary.value.redlinePenalty },
    { label: '逾期任务', value: myPerformanceResult.value?.overdueCount ?? 0 },
    { label: '整改未销号', value: myPerformanceResult.value?.rectificationCount ?? 0 }
  ])

  async function confirmResult() {
    await ElMessageBox.confirm(
      '我已知晓本周期考核结果，并确认无误。确认后本人不能再修改本周期记录。',
      '电子确认',
      { confirmButtonText: '确认结果', cancelButtonText: '先不确认', type: 'warning' }
    )
    await confirmMyPerformance()
  }
</script>

<style scoped lang="scss">
  .employee-simple-page {
    padding: 4px;
  }

  .result-card,
  .metric-card {
    border: 0;
    border-radius: 12px;
  }

  .result-card {
    margin-bottom: 16px;
    text-align: center;

    h2 {
      margin: 16px 0 8px;
    }

    p {
      color: #64748b;
    }
  }

  .score-circle {
    display: grid;
    place-items: center;
    width: 150px;
    height: 150px;
    margin: 0 auto;
    color: #fff;
    background: linear-gradient(135deg, #0f766e, #075985);
    border-radius: 50%;

    span,
    strong {
      display: block;
    }

    strong {
      font-size: 42px;
    }
  }

  .metric-card {
    margin-bottom: 16px;

    span {
      color: #64748b;
    }

    strong {
      display: block;
      margin-top: 8px;
      font-size: 30px;
      color: #0f766e;
    }
  }

  .confirm-line {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: center;
    margin-top: 16px;
  }

  .confirm-tip {
    margin: 12px 0 0;
    font-size: 13px;
  }

  .is-elderly-friendly {
    font-size: 17px;

    :deep(.el-button) {
      min-height: 44px;
      font-size: 16px;
    }
  }
</style>
