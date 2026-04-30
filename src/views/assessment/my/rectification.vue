<template>
  <div class="employee-simple-page">
    <el-card class="intro-card" shadow="never">
      <h2>我的整改</h2>
      <p>集中查看被退回、待整改和整改中的事项，避免在管理台账里查找。</p>
    </el-card>

    <div v-if="rectificationItems.length" class="rectification-list">
      <el-card
        v-for="item in rectificationItems"
        :key="item.id"
        class="rectification-card"
        shadow="never"
      >
        <div class="card-header">
          <el-tag :type="item.status === '已销号' ? 'success' : 'danger'">{{ item.status }}</el-tag>
          <span>{{ item.boardName }}</span>
        </div>
        <h3>{{ item.description }}</h3>
        <p>{{ item.rectification }}</p>
      </el-card>
    </div>
    <el-empty v-else description="当前没有需要整改的事项" />
  </div>
</template>

<script setup lang="ts">
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

  const { rectificationItems } = useAssessmentPlatform()
</script>

<style scoped lang="scss">
  .employee-simple-page {
    padding: 4px;
  }

  .intro-card,
  .rectification-card {
    border: 0;
    border-radius: 18px;
  }

  .intro-card {
    margin-bottom: 16px;

    h2 {
      margin: 0 0 8px;
    }

    p {
      margin: 0;
      color: #64748b;
    }
  }

  .rectification-list {
    display: grid;
    gap: 14px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #64748b;
  }

  .rectification-card {
    h3 {
      margin: 12px 0 8px;
      color: #0f172a;
    }

    p {
      color: #64748b;
      line-height: 1.7;
    }
  }
</style>
