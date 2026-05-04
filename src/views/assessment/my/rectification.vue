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
        <dl class="rectification-meta">
          <div>
            <dt>原因分析</dt>
            <dd>{{ item.causeAnalysis || '待负责人补充' }}</dd>
          </div>
          <div>
            <dt>需支持</dt>
            <dd>{{ item.supportNeeded || '暂无' }}</dd>
          </div>
          <div>
            <dt>督办负责人</dt>
            <dd>{{ item.supervisorName || '未指定' }}</dd>
          </div>
          <div>
            <dt>整改时限</dt>
            <dd>{{ item.deadline || '按本周期要求完成' }}</dd>
          </div>
        </dl>
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
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    color: #64748b;
  }

  .rectification-card {
    h3 {
      margin: 12px 0 8px;
      color: #0f172a;
    }

    p {
      line-height: 1.7;
      color: #64748b;
    }
  }

  .rectification-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 14px 0 0;

    div {
      padding: 10px;
      background: #f8fafc;
      border-radius: 12px;
    }

    dt {
      margin-bottom: 4px;
      font-size: 12px;
      color: #94a3b8;
    }

    dd {
      margin: 0;
      color: #334155;
    }
  }
</style>
