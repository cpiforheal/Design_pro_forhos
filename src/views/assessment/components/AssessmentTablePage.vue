<template>
  <div class="assessment-page">
    <el-card class="intro-card">
      <div>
        <p>{{ subtitle }}</p>
        <h2>{{ title }}</h2>
      </div>
      <el-tag type="success" size="large">{{ items.length }} 项</el-tag>
    </el-card>

    <el-card>
      <el-table :data="items" border stripe row-key="id">
        <el-table-column prop="moduleName" label="模块" width="180" />
        <el-table-column prop="title" label="考核内容" min-width="260">
          <template #default="{ row }">
            <div class="title-cell">
              <strong>{{ row.title }}</strong>
              <el-tag v-if="row.isRedline" type="danger" size="small">红线</el-tag>
              <p>{{ row.standard }}</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="完成情况" width="180" align="center">
          <template #default="{ row }">
            <el-button
              :type="buttonType(drafts[row.id]?.status)"
              @click="$emit('toggle', row.id, scope)"
            >
              {{ getStatusLabel(drafts[row.id]?.status ?? 'completed') }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="整改措施" min-width="240">
          <template #default="{ row }">
            <el-input
              :model-value="drafts[row.id].rectification"
              placeholder="未完成时填写整改措施"
              @update:model-value="
                $emit('update-draft', row.id, scope, 'rectification', String($event))
              "
              @change="$emit('save', row.id, scope)"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="180">
          <template #default="{ row }">
            <el-input
              :model-value="drafts[row.id].remark"
              placeholder="备注"
              @update:model-value="$emit('update-draft', row.id, scope, 'remark', String($event))"
              @change="$emit('save', row.id, scope)"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import type { AssessmentItem, AssessmentStatus, EvaluationDraft } from '@/types/assessment'
  import { getStatusLabel } from '@/utils/assessment/scoring'

  defineProps<{
    title: string
    subtitle: string
    items: AssessmentItem[]
    drafts: Record<string, EvaluationDraft>
    scope: 'common' | 'board'
  }>()

  defineEmits<{
    toggle: [itemId: string, scope: 'common' | 'board']
    save: [itemId: string, scope: 'common' | 'board']
    'update-draft': [
      itemId: string,
      scope: 'common' | 'board',
      field: 'rectification' | 'remark',
      value: string
    ]
  }>()

  function buttonType(status?: AssessmentStatus) {
    if (status === 'pending') return 'danger'
    if (status === 'na') return 'info'
    return 'success'
  }
</script>

<style scoped>
  .assessment-page {
    padding: 4px;
  }

  .intro-card {
    margin-bottom: 16px;
    border-radius: 16px;
  }

  .intro-card :deep(.el-card__body) {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .intro-card p {
    margin: 0 0 8px;
    color: #64748b;
  }

  .intro-card h2 {
    margin: 0;
    color: #0f172a;
  }

  .title-cell strong {
    display: inline-block;
    margin-right: 8px;
    color: #0f172a;
  }

  .title-cell p {
    margin: 6px 0 0;
    line-height: 1.6;
    color: #64748b;
  }
</style>
