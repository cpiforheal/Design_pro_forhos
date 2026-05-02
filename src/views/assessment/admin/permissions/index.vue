<template>
  <ElCard>
    <template #header>
      <div class="table-card-header">
        <div>
          <h3 class="m-0 text-lg font-medium">角色/权限管理</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            角色权限已接入后端 roles 表，修改后用户重新进入系统会按新权限生成菜单和操作范围。
          </p>
        </div>
        <div class="table-tools">
          <ElButton type="primary" disabled>新增角色</ElButton>
          <ElTooltip content="刷新">
            <ElButton class="tool-button" @click="loadRoles">
              <ArtSvgIcon icon="ri:refresh-line" />
            </ElButton>
          </ElTooltip>
        </div>
      </div>
    </template>

    <ElTable v-loading="loading" :data="roleGrants" border>
      <ElTableColumn type="index" label="角色ID" width="90" />
      <ElTableColumn label="角色名称" width="170">
        <template #default="{ row }">
          <ElInput v-model="row.roleName" size="small" />
        </template>
      </ElTableColumn>
      <ElTableColumn prop="roleCode" label="角色编码" width="150" />
      <ElTableColumn label="角色描述" min-width="260">
        <template #default="{ row }">
          <ElInput v-model="row.description" size="small" />
        </template>
      </ElTableColumn>
      <ElTableColumn label="数据范围" width="130">
        <template #default="{ row }">
          <ElSelect v-model="row.dataScope" size="small">
            <ElOption label="全部数据" value="all" />
            <ElOption label="所属板块" value="board" />
            <ElOption label="本人数据" value="self" />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="角色状态" width="110" align="center">
        <template #default="{ row }">
          <ElSwitch
            v-model="row.enabled"
            :disabled="row.roleCode === 'R_SUPER'"
            active-text=""
            inactive-text=""
          />
        </template>
      </ElTableColumn>
      <ElTableColumn label="菜单权限" min-width="280">
        <template #default="{ row }">
          <ElSelect
            v-model="row.menuPermissions"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            size="small"
            placeholder="菜单权限"
          >
            <ElOption
              v-for="item in menuPermissionOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作权限" min-width="300">
        <template #default="{ row }">
          <ElSelect
            v-model="row.actionPermissions"
            multiple
            filterable
            allow-create
            collapse-tags
            collapse-tags-tooltip
            size="small"
            placeholder="操作权限"
          >
            <ElOption
              v-for="item in actionPermissionOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="110" fixed="right" align="center">
        <template #default="{ row }">
          <ElButton type="primary" link @click="saveRole(row)">保存</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { fetchRoleGrants, updateRoleGrant } from '@/api/assessment-admin'
  import type { PermissionGrant } from '@/types/assessment'

  const loading = ref(false)
  const roleGrants = ref<PermissionGrant[]>([])

  const menuPermissionOptions = computed(() =>
    Array.from(
      new Set([
        'assessment',
        'employee-view',
        'employee-add',
        'permission-assign',
        'organization-config',
        'cycle-template',
        'review-desk',
        'leader-dashboard',
        ...roleGrants.value.flatMap((role) => role.menuPermissions)
      ])
    )
  )
  const actionPermissionOptions = computed(() =>
    Array.from(
      new Set([
        'employee:create',
        'employee:update',
        'employee:disable',
        'permission:update',
        'cycle:update',
        'template:update',
        'review:all',
        'review:view',
        'review:board',
        'rectification:close',
        'summary:export',
        'assessment:submit',
        'task:submit',
        ...roleGrants.value.flatMap((role) => role.actionPermissions)
      ])
    )
  )

  onMounted(loadRoles)

  async function loadRoles() {
    loading.value = true
    try {
      roleGrants.value = await fetchRoleGrants()
    } finally {
      loading.value = false
    }
  }

  async function saveRole(row: PermissionGrant) {
    roleGrants.value = await updateRoleGrant(row.id, {
      roleName: row.roleName,
      description: row.description,
      menuPermissions: row.menuPermissions,
      actionPermissions: row.actionPermissions,
      dataScope: row.dataScope,
      enabled: row.enabled !== false
    })
  }
</script>

<style scoped>
  .table-card-header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .table-tools {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .tool-button {
    width: 34px;
    padding: 0;
  }
</style>
