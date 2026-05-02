<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">组织责任配置</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500">
          维护各板块对口领导、中心负责人和综合办公室协调人，作为数据范围、任务部署和绩效确认的责任依据。
        </p>
      </div>
    </template>

    <ElAlert
      class="organization-alert"
      type="info"
      show-icon
      :closable="false"
      title="此处只配置组织责任关系，不改变账号角色；权限仍以当前角色体系为准。"
    />

    <ElTable :data="boardConfigs" border>
      <ElTableColumn prop="boardName" label="板块" min-width="180" />
      <ElTableColumn label="对口领导" min-width="200">
        <template #default="{ row }">
          <ElSelect
            v-model="row.leaderUserId"
            clearable
            filterable
            placeholder="选择对口领导"
            style="width: 180px"
          >
            <ElOption
              v-for="user in userOptions"
              :key="user.id"
              :label="user.displayName"
              :value="user.id"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="中心负责人" min-width="200">
        <template #default="{ row }">
          <ElSelect
            v-model="row.managerUserId"
            clearable
            filterable
            placeholder="选择负责人"
            style="width: 180px"
          >
            <ElOption
              v-for="user in userOptions"
              :key="user.id"
              :label="user.displayName"
              :value="user.id"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="办公室协调人" min-width="200">
        <template #default="{ row }">
          <ElSelect
            v-model="row.officeCoordinatorUserId"
            clearable
            filterable
            placeholder="选择协调人"
            style="width: 180px"
          >
            <ElOption
              v-for="user in userOptions"
              :key="user.id"
              :label="user.displayName"
              :value="user.id"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="当前责任人" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          {{ getResponsibilityText(row) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="110" fixed="right" align="center">
        <template #default="{ row }">
          <ElButton type="primary" link @click="saveConfig(row)">保存</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import {
    fetchAccountUsers,
    fetchBoardResponsibilityConfig,
    updateBoardResponsibilityConfig
  } from '@/api/assessment-admin'
  import type { AccountUserItem } from '@/api/assessment-admin'
  import type { BoardResponsibilityConfig } from '@/types/assessment'

  const boardConfigs = ref<BoardResponsibilityConfig[]>([])
  const accountUsers = ref<AccountUserItem[]>([])

  const userOptions = computed(() => accountUsers.value.filter((user) => user.status === 'active'))

  onMounted(async () => {
    const [configs, users] = await Promise.all([
      fetchBoardResponsibilityConfig(),
      fetchAccountUsers()
    ])
    boardConfigs.value = configs
    accountUsers.value = users
  })

  async function saveConfig(row: BoardResponsibilityConfig) {
    boardConfigs.value = await updateBoardResponsibilityConfig(row.boardId, {
      leaderUserId: row.leaderUserId ?? null,
      managerUserId: row.managerUserId ?? null,
      officeCoordinatorUserId: row.officeCoordinatorUserId ?? null
    })
  }

  function getResponsibilityText(row: BoardResponsibilityConfig) {
    const leader = findUserName(row.leaderUserId) || row.leaderName || '未配置'
    const manager = findUserName(row.managerUserId) || row.managerName || '未配置'
    const coordinator =
      findUserName(row.officeCoordinatorUserId) || row.officeCoordinatorName || '未配置'
    return `领导：${leader}；负责人：${manager}；协调人：${coordinator}`
  }

  function findUserName(userId?: number) {
    if (!userId) return ''
    return accountUsers.value.find((user) => user.id === userId)?.displayName ?? ''
  }
</script>

<style scoped>
  .organization-alert {
    margin-bottom: 16px;
  }
</style>
