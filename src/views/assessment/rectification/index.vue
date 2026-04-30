<template>
  <div class="assessment-page">
    <el-card class="intro-card">
      <h2>整改台账</h2>
      <p>未完成考核项自动汇入整改台账，负责人审核后跟进整改销号。</p>
    </el-card>
    <el-card>
      <el-table :data="rectificationItems" border stripe row-key="id" empty-text="当前暂无整改项">
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column prop="boardName" label="板块" width="220" />
        <el-table-column prop="description" label="问题描述" min-width="260" />
        <el-table-column prop="owner" label="责任人" width="140" />
        <el-table-column prop="rectification" label="整改措施" min-width="240" />
        <el-table-column prop="updatedAt" label="更新时间" width="170" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === '已销号' ? 'success' : row.status === '待整改' ? 'danger' : 'warning'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" :disabled="row.status === '已销号'" @click="closeRectification(row.id)">销号</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

const { rectificationItems, closeRectification } = useAssessmentPlatform()
</script>

<style scoped>
.assessment-page { padding: 4px; }
.intro-card { margin-bottom: 16px; border-radius: 16px; }
.intro-card h2 { margin: 0 0 8px; }
.intro-card p { margin: 0; color: #64748b; }
</style>
