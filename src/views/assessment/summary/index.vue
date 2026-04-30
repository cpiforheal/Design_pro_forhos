<template>
  <div class="assessment-page">
    <el-row :gutter="16">
      <el-col :xs="24" :md="8"><el-card><div class="summary"><span>日常得分</span><strong>{{ summary.dailyScore }}</strong></div></el-card></el-col>
      <el-col :xs="24" :md="8"><el-card><div class="summary"><span>红线扣分</span><strong>{{ summary.redlinePenalty }}</strong></div></el-card></el-col>
      <el-col :xs="24" :md="8"><el-card><div class="summary"><span>最终得分</span><strong>{{ summary.finalScore }}</strong></div></el-card></el-col>
    </el-row>
    <el-card class="panel-card">
      <template #header>汇总看板</template>
      <el-table :data="boardScoreBars" border stripe row-key="id">
        <el-table-column prop="name" label="板块" min-width="240" />
        <el-table-column prop="owner" label="负责人" min-width="220" />
        <el-table-column label="完成率" width="260">
          <template #default="{ row }"><el-progress :percentage="Math.round(row.rate * 100)" :color="row.color" /></template>
        </el-table-column>
        <el-table-column prop="label" label="结果" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

const { summary, boardScoreBars } = useAssessmentPlatform()
</script>

<style scoped>
.assessment-page { padding: 4px; }
.summary span { color: #64748b; }
.summary strong { display: block; margin-top: 8px; color: #0f766e; font-size: 34px; }
.panel-card { margin-top: 16px; border-radius: 16px; }
</style>
