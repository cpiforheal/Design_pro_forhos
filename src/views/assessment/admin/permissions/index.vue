<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">权限分配</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500">超级管理员统一维护菜单权限、操作权限和数据范围。</p>
      </div>
    </template>

    <ElTable :data="permissionGrants" border>
      <ElTableColumn prop="roleName" label="角色" width="140" />
      <ElTableColumn prop="roleCode" label="权限编码" width="130" />
      <ElTableColumn prop="description" label="说明" min-width="240" show-overflow-tooltip />
      <ElTableColumn prop="dataScope" label="数据范围" width="120">
        <template #default="scope">
          <ElTag>{{ getDataScopeText(scope.row.dataScope) }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="菜单权限" min-width="260">
        <template #default="scope">
          <ElSpace wrap>
            <ElTag v-for="item in scope.row.menuPermissions" :key="item" type="info">{{ item }}</ElTag>
          </ElSpace>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作权限" min-width="280">
        <template #default="scope">
          <ElSpace wrap>
            <ElTag v-for="item in scope.row.actionPermissions" :key="item" type="success">{{ item }}</ElTag>
          </ElSpace>
        </template>
      </ElTableColumn>
    </ElTable>
  </ElCard>
</template>

<script setup lang="ts">
import { permissionGrants } from '@/data/assessmentData'

const dataScopeMap: Record<string, string> = {
  all: '全部数据',
  board: '所属板块',
  self: '本人数据'
}

function getDataScopeText(scope: string) {
  return dataScopeMap[scope] ?? '未知范围'
}
</script>
