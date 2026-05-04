<template>
  <div class="art-full-height">
    <ElCard class="art-table-card">
      <template #header>
        <div class="table-card-header">
          <div>
            <h3 class="m-0 text-lg font-medium">账号日志</h3>
            <p class="mt-1 mb-0 text-sm text-gray-500">
              查看账号登录成功、失败、IP 和浏览器信息，便于超级管理员追踪账号使用情况。
            </p>
          </div>
          <ElButton type="primary" @click="loadLogs">刷新</ElButton>
        </div>
      </template>

      <ElForm class="filter-form" inline>
        <ElFormItem label="关键字">
          <ElInput
            v-model="keyword"
            clearable
            placeholder="账号 / 姓名 / 工号 / IP"
            style="width: 260px"
          />
        </ElFormItem>
        <ElFormItem label="结果">
          <ElSelect v-model="statusFilter" clearable placeholder="全部" style="width: 120px">
            <ElOption label="成功" value="success" />
            <ElOption label="失败" value="failed" />
          </ElSelect>
        </ElFormItem>
      </ElForm>

      <ElTable v-loading="loading" :data="filteredLogs" border height="100%">
        <ElTableColumn prop="loggedAt" label="登录时间" width="170">
          <template #default="scope">{{ formatTime(scope.row.loggedAt) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="结果" width="90">
          <template #default="scope">
            <ElTag :type="scope.row.status === 'success' ? 'success' : 'danger'">
              {{ scope.row.status === 'success' ? '成功' : '失败' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="账号" min-width="220">
          <template #default="scope">
            <div class="account-cell">
              <div class="account-name">{{ scope.row.displayName || '-' }}</div>
              <div class="account-meta"
                >{{ scope.row.username }} · {{ scope.row.employeeNo || '-' }}</div
              >
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="roleName" label="角色" width="130">
          <template #default="scope">{{ scope.row.roleName || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="boardName" label="所属板块" min-width="170">
          <template #default="scope">{{ scope.row.boardName || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="message" label="说明" min-width="150" />
        <ElTableColumn prop="ipAddress" label="IP" min-width="150">
          <template #default="scope">{{ scope.row.ipAddress || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="userAgent"
          label="浏览器 / 客户端"
          min-width="280"
          show-overflow-tooltip
        >
          <template #default="scope">{{ scope.row.userAgent || '-' }}</template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { fetchLoginLogs, type LoginLogItem } from '@/api/assessment-admin'

  const loading = ref(false)
  const logs = ref<LoginLogItem[]>([])
  const keyword = ref('')
  const statusFilter = ref('')

  const filteredLogs = computed(() => {
    const normalizedKeyword = keyword.value.trim().toLowerCase()
    return logs.value.filter((item) => {
      if (statusFilter.value && item.status !== statusFilter.value) return false
      if (!normalizedKeyword) return true
      return [
        item.username,
        item.displayName,
        item.employeeNo,
        item.roleName,
        item.boardName,
        item.ipAddress
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    })
  })

  onMounted(loadLogs)

  async function loadLogs() {
    loading.value = true
    try {
      logs.value = await fetchLoginLogs()
    } finally {
      loading.value = false
    }
  }

  function formatTime(value?: string) {
    if (!value) return '-'
    return value.replace('T', ' ').slice(0, 19)
  }
</script>

<style scoped>
  .table-card-header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .filter-form {
    margin-bottom: 8px;
  }

  .account-cell {
    line-height: 1.35;
  }

  .account-name {
    font-weight: 600;
  }

  .account-meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
