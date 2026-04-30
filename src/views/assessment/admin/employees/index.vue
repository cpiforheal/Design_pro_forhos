<template>
  <div class="art-full-height">
    <ElCard class="art-table-card">
      <template #header>
        <div class="flex justify-between items-center">
          <div>
            <h3 class="m-0 text-lg font-medium">员工管理</h3>
            <p class="mt-1 mb-0 text-sm text-gray-500">超级管理员可维护员工账号、系统角色和账号状态，数据来自 SQLite。</p>
          </div>
          <ElButton type="primary" @click="router.push('/assessment-admin/new-user')">新增用户</ElButton>
        </div>
      </template>

      <ElTable v-loading="loading" :data="accountUsers" border height="100%">
        <ElTableColumn prop="employeeNo" label="工号" width="110" />
        <ElTableColumn prop="displayName" label="姓名" width="140" />
        <ElTableColumn prop="username" label="登录账号" width="140" />
        <ElTableColumn prop="email" label="邮箱" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="roleName" label="系统权限" width="150">
          <template #default="scope">
            <ElTag :type="getRoleTagType(scope.row.roleCode)">{{ scope.row.roleName }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="100">
          <template #default="scope">
            <ElTag :type="scope.row.status === 'active' ? 'success' : 'info'">{{ scope.row.status === 'active' ? '启用' : '停用' }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="220" fixed="right">
          <template #default="scope">
            <ElSelect v-model="scope.row.roleCode" size="small" @change="(roleCode: string) => changeRole(scope.row.id, roleCode)">
              <ElOption v-for="grant in permissionGrants" :key="grant.roleCode" :label="grant.roleName" :value="grant.roleCode" />
            </ElSelect>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchAccountUsers, updateAccountUserRole, type AccountUserItem } from '@/api/assessment-admin'
import { permissionGrants } from '@/data/assessmentData'

const router = useRouter()
const loading = ref(false)
const accountUsers = ref<AccountUserItem[]>([])

onMounted(loadUsers)

async function loadUsers() {
  loading.value = true
  try {
    accountUsers.value = await fetchAccountUsers()
  } finally {
    loading.value = false
  }
}

async function changeRole(userId: number, roleCode: string) {
  await updateAccountUserRole(userId, roleCode)
  ElMessage.success('账号权限已更新，用户下次进入系统将按新权限生成菜单')
  await loadUsers()
}

function getRoleTagType(roleCode: string) {
  if (roleCode === 'R_SUPER') return 'danger'
  if (roleCode === 'R_LEADER') return 'warning'
  if (roleCode === 'R_MANAGER') return 'primary'
  return 'info'
}
</script>
