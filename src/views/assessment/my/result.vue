<template>
  <div class="employee-simple-page">
    <el-card class="result-card" shadow="never">
      <div class="score-circle">
        <span>当前得分</span>
        <strong>{{ summary.finalScore }}</strong>
      </div>
      <h2>我的结果</h2>
      <p>{{ currentAssessmentCycle.name }} · {{ currentEmployee.name }}</p>
      <el-progress :percentage="Math.round(summary.completionRate * 100)" :stroke-width="14" />
    </el-card>

    <el-row :gutter="16">
      <el-col v-for="item in resultItems" :key="item.label" :xs="12" :md="6">
        <el-card class="metric-card" shadow="never">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  const { summary, currentAssessmentCycle, currentEmployee } = useAssessmentPlatform()

  const resultItems = computed(() => [
    { label: '适用项目', value: summary.value.totalApplicable },
    { label: '已完成', value: summary.value.completedCount },
    { label: '未完成', value: summary.value.pendingCount },
    { label: '红线扣分', value: summary.value.redlinePenalty }
  ])
</script>

<style scoped lang="scss">
  .employee-simple-page {
    padding: 4px;
  }

  .result-card,
  .metric-card {
    border: 0;
    border-radius: 18px;
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
    width: 150px;
    height: 150px;
    margin: 0 auto;
    color: #fff;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, #0f766e, #075985);

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
      color: #0f766e;
      font-size: 30px;
    }
  }
</style>
