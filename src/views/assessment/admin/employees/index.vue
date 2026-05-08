<template>
  <div class="art-full-height">
    <ElCard class="art-table-card">
      <template #header>
        <div class="table-card-header">
          <div>
            <h3 class="m-0 text-lg font-medium">员工管理</h3>
            <p class="mt-1 mb-0 text-sm text-gray-500">
              维护员工账号、所属板块、岗位和账号状态；板块归属只影响任务范围，不提升权限。
            </p>
          </div>
          <div class="table-tools">
            <ElButton type="primary" @click="openCreateDialog">新增员工</ElButton>
            <ElButton
              type="danger"
              plain
              :disabled="selectedUsers.length !== 1"
              @click="deleteSelectedUser"
            >
              删除员工信息
            </ElButton>
            <ElTooltip content="刷新">
              <ElButton class="tool-button" @click="loadUsers">
                <ArtSvgIcon icon="ri:refresh-line" />
              </ElButton>
            </ElTooltip>
          </div>
        </div>
      </template>

      <div class="board-summary">
        <ElTag v-for="board in boardOptions" :key="board.id" effect="plain">
          {{ board.name }}：{{ boardCountMap[board.id] || 0 }} 人
        </ElTag>
      </div>

      <ElForm class="filter-form" inline>
        <ElFormItem label="所属板块">
          <ElSelect v-model="filters.boardId" clearable placeholder="全部板块" style="width: 220px">
            <ElOption
              v-for="board in boardOptions"
              :key="board.id"
              :label="board.name"
              :value="board.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="系统权限">
          <ElSelect
            v-model="filters.roleCode"
            clearable
            placeholder="全部权限"
            style="width: 160px"
          >
            <ElOption
              v-for="grant in permissionGrants"
              :key="grant.roleCode"
              :label="grant.roleName"
              :value="grant.roleCode"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="账号状态">
          <ElSelect v-model="filters.status" clearable placeholder="全部状态" style="width: 130px">
            <ElOption label="启用" value="active" />
            <ElOption label="停用" value="disabled" />
          </ElSelect>
        </ElFormItem>
      </ElForm>

      <ElTable
        v-loading="loading"
        :data="filteredUsers"
        border
        height="100%"
        @selection-change="handleSelectionChange"
      >
        <ElTableColumn type="selection" width="44" />
        <ElTableColumn type="index" label="序号" width="70" />
        <ElTableColumn label="用户" min-width="230">
          <template #default="scope">
            <div class="user-cell">
              <div class="avatar">{{ scope.row.displayName.slice(0, 1) }}</div>
              <div>
                <div class="user-name">{{ scope.row.displayName }}</div>
                <div class="user-meta">{{ scope.row.username }} · {{ scope.row.employeeNo }}</div>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="boardName" label="所属板块" min-width="190" show-overflow-tooltip>
          <template #default="scope">{{
            scope.row.boardName || getBoardName(scope.row.boardId)
          }}</template>
        </ElTableColumn>
        <ElTableColumn prop="position" label="岗位" min-width="130">
          <template #default="scope">{{ scope.row.position || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="病历权限" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            {{ stageText(scope.row.medicalRecordStages) || '未绑定' }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="mobile" label="手机号" width="140">
          <template #default="scope">{{ scope.row.mobile || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="email" label="邮箱" min-width="190" show-overflow-tooltip />
        <ElTableColumn prop="elderlyFriendly" label="适老模式" width="105" align="center">
          <template #default="scope">
            <ElTag :type="scope.row.elderlyFriendly ? 'success' : 'info'">
              {{ scope.row.elderlyFriendly ? '开启' : '关闭' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="roleName" label="系统权限" width="150">
          <template #default="scope">
            <ElTag :type="getRoleTagType(scope.row.roleCode)">{{ scope.row.roleName }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="90">
          <template #default="scope">
            <ElTag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="updatedAt" label="最后更新" width="170">
          <template #default="scope">{{ formatTime(scope.row.updatedAt) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="260" fixed="right">
          <template #default="scope">
            <ElButton type="primary" link @click="openEditDialog(scope.row)">编辑资料</ElButton>
            <ElSelect
              v-model="scope.row.roleCode"
              size="small"
              style="width: 135px"
              @change="(roleCode: string) => changeRole(scope.row.id, roleCode)"
            >
              <ElOption
                v-for="grant in enabledRoleGrants"
                :key="grant.roleCode"
                :label="grant.roleName"
                :value="grant.roleCode"
              />
            </ElSelect>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="profileDialogVisible"
      :title="editingUserId ? '编辑员工' : '新增员工'"
      width="640px"
    >
      <ElForm :model="profileForm" label-width="96px">
        <ElFormItem label="登录账号" required>
          <ElInput v-model="profileForm.username" placeholder="请输入登录账号" />
        </ElFormItem>
        <ElFormItem :label="editingUserId ? '新密码' : '初始密码'" :required="!editingUserId">
          <ElInput
            v-model="profileForm.password"
            :placeholder="editingUserId ? '不填写则保持原密码' : '请输入初始密码'"
            show-password
          />
        </ElFormItem>
        <ElFormItem label="姓名" required>
          <ElInput v-model="profileForm.displayName" placeholder="请输入员工姓名" />
        </ElFormItem>
        <ElFormItem label="工号" required>
          <ElInput v-model="profileForm.employeeNo" placeholder="请输入工号" />
        </ElFormItem>
        <ElFormItem label="手机号">
          <ElInput v-model="profileForm.mobile" placeholder="请输入手机号" />
        </ElFormItem>
        <ElFormItem label="邮箱" required>
          <ElInput v-model="profileForm.email" placeholder="请输入邮箱" />
        </ElFormItem>
        <ElFormItem label="所属板块" required>
          <ElSelect v-model="profileForm.boardId" placeholder="请选择所属板块" style="width: 100%">
            <ElOption
              v-for="board in boardOptions"
              :key="board.id"
              :label="board.name"
              :value="board.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="岗位">
          <ElInput v-model="profileForm.position" placeholder="如：护士、医师、收费员" />
        </ElFormItem>
        <ElFormItem label="病历权限">
          <ElSelect
            v-model="profileForm.medicalRecordStages"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择该账号可填写的病历区域；不参与可留空"
            style="width: 100%"
          >
            <ElOption
              v-for="stage in medicalRecordStageOptions"
              :key="stage.value"
              :label="stage.label"
              :value="stage.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="系统权限">
          <ElSelect v-model="profileForm.roleCode" style="width: 100%">
            <ElOption
              v-for="grant in enabledRoleGrants"
              :key="grant.roleCode"
              :label="grant.roleName"
              :value="grant.roleCode"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="editingUserId" label="账号状态">
          <ElRadioGroup v-model="profileForm.status">
            <ElRadioButton label="active">启用</ElRadioButton>
            <ElRadioButton label="disabled">停用</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="适老模式">
          <ElSwitch v-model="profileForm.elderlyFriendly" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton v-if="editingUserId" :loading="saving" @click="resetPassword">
          重置密码
        </ElButton>
        <ElButton @click="profileDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveProfile">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    createAccountUser,
    deleteAccountUser,
    fetchAccountUsers,
    fetchRoleGrants,
    resetAccountUserPassword,
    updateAccountUserProfile,
    updateAccountUserRole,
    type AccountUserItem
  } from '@/api/assessment-admin'
  import { boards } from '@/data/assessmentData'
  import type { BoardId, PermissionGrant } from '@/types/assessment'
  import { medicalRecordStageOptions, type MedicalRecordStageKey } from '@/types/medicalRecord'

  const loading = ref(false)
  const saving = ref(false)
  const accountUsers = ref<AccountUserItem[]>([])
  const permissionGrants = ref<PermissionGrant[]>([])
  const selectedUsers = ref<AccountUserItem[]>([])
  const profileDialogVisible = ref(false)
  const editingUserId = ref<number | null>(null)

  const filters = reactive({
    boardId: '',
    roleCode: '',
    status: ''
  })

  const profileForm = reactive({
    username: '',
    password: '',
    displayName: '',
    employeeNo: '',
    email: '',
    roleCode: 'R_EMPLOYEE',
    boardId: 'medical',
    position: '',
    medicalRecordStages: [] as MedicalRecordStageKey[],
    mobile: '',
    status: 'active' as 'active' | 'disabled',
    elderlyFriendly: true
  })

  const boardOptions = computed(() => boards.filter((board) => board.id !== 'allStaff'))
  const enabledRoleGrants = computed(() =>
    permissionGrants.value.filter((role) => role.enabled !== false)
  )
  const filteredUsers = computed(() =>
    accountUsers.value.filter((user) => {
      if (filters.boardId && user.boardId !== filters.boardId) return false
      if (filters.roleCode && user.roleCode !== filters.roleCode) return false
      if (filters.status && user.status !== filters.status) return false
      return true
    })
  )
  const boardCountMap = computed<Record<string, number>>(() => {
    return accountUsers.value.reduce<Record<string, number>>((map, user) => {
      map[user.boardId] = (map[user.boardId] || 0) + 1
      return map
    }, {})
  })

  onMounted(loadUsers)

  function handleSelectionChange(rows: AccountUserItem[]) {
    selectedUsers.value = rows
  }

  async function loadUsers() {
    loading.value = true
    try {
      const [users, roles] = await Promise.all([fetchAccountUsers(), fetchRoleGrants()])
      accountUsers.value = users
      permissionGrants.value = roles
    } finally {
      loading.value = false
    }
  }

  function openCreateDialog() {
    editingUserId.value = null
    resetProfileForm()
    profileDialogVisible.value = true
  }

  function openEditDialog(user: AccountUserItem) {
    editingUserId.value = user.id
    Object.assign(profileForm, {
      username: user.username,
      password: '',
      displayName: user.displayName,
      employeeNo: user.employeeNo,
      email: user.email,
      roleCode: user.roleCode,
      boardId: user.boardId,
      position: user.position || '',
      medicalRecordStages: [...(user.medicalRecordStages || [])],
      mobile: user.mobile || '',
      status: user.status,
      elderlyFriendly: user.elderlyFriendly
    })
    profileDialogVisible.value = true
  }

  async function saveProfile() {
    if (
      !profileForm.displayName ||
      !profileForm.employeeNo ||
      !profileForm.email ||
      !profileForm.boardId ||
      !profileForm.username
    ) {
      ElMessage.warning('请完整填写登录账号、姓名、工号、邮箱和所属板块')
      return
    }
    saving.value = true
    try {
      if (editingUserId.value) {
        await updateAccountUserProfile(editingUserId.value, {
          username: profileForm.username,
          password: profileForm.password || undefined,
          displayName: profileForm.displayName,
          employeeNo: profileForm.employeeNo,
          email: profileForm.email,
          roleCode: profileForm.roleCode,
          boardId: profileForm.boardId,
          position: profileForm.position,
          medicalRecordStages: profileForm.medicalRecordStages,
          mobile: profileForm.mobile,
          status: profileForm.status,
          elderlyFriendly: profileForm.elderlyFriendly
        })
      } else {
        if (!profileForm.username || !profileForm.password) {
          ElMessage.warning('请填写登录账号和初始密码')
          return
        }
        await createAccountUser({
          username: profileForm.username,
          password: profileForm.password,
          displayName: profileForm.displayName,
          employeeNo: profileForm.employeeNo,
          email: profileForm.email,
          roleCode: profileForm.roleCode || 'R_EMPLOYEE',
          boardId: profileForm.boardId,
          position: profileForm.position,
          medicalRecordStages: profileForm.medicalRecordStages,
          mobile: profileForm.mobile,
          elderlyFriendly: profileForm.elderlyFriendly
        })
      }
      profileDialogVisible.value = false
      await loadUsers()
    } finally {
      saving.value = false
    }
  }

  async function resetPassword() {
    if (!editingUserId.value) return
    const nextPassword = profileForm.password || `${profileForm.employeeNo}@123456`
    try {
      await ElMessageBox.confirm(
        `确定将 ${profileForm.displayName} 的密码重置为：${nextPassword}？`,
        '重置密码',
        { type: 'warning' }
      )
    } catch {
      return
    }
    saving.value = true
    try {
      await resetAccountUserPassword(editingUserId.value, nextPassword)
      profileForm.password = ''
    } finally {
      saving.value = false
    }
  }

  async function deleteSelectedUser() {
    const user = selectedUsers.value[0]
    if (!user) return
    try {
      await ElMessageBox.confirm(
        `文档建议离职或暂不使用员工优先“停用账号”，以保留历史考核和病历追溯。仅误建账号或测试账号建议删除。确定仍要删除员工“${user.displayName}（${user.employeeNo}）”吗？删除后该员工的考核记录、任务记录和权限绑定将同步清理，且无法恢复。`,
        '删除员工信息',
        {
          type: 'warning',
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger'
        }
      )
    } catch {
      return
    }
    loading.value = true
    try {
      await deleteAccountUser(user.id)
      await loadUsers()
      selectedUsers.value = []
    } finally {
      loading.value = false
    }
  }

  async function changeRole(userId: number, roleCode: string) {
    await updateAccountUserRole(userId, roleCode)
    ElMessage.success('账号权限已更新，用户下次进入系统将按新权限生成菜单')
    await loadUsers()
  }

  function resetProfileForm() {
    Object.assign(profileForm, {
      username: '',
      password: '',
      displayName: '',
      employeeNo: '',
      email: '',
      roleCode: 'R_EMPLOYEE',
      boardId: 'medical',
      position: '',
      medicalRecordStages: [],
      mobile: '',
      status: 'active',
      elderlyFriendly: true
    })
  }

  function getBoardName(boardId: BoardId | string) {
    return boardOptions.value.find((board) => board.id === boardId)?.name || '-'
  }

  function getRoleTagType(roleCode: string) {
    if (roleCode === 'R_SUPER') return 'danger'
    if (roleCode === 'R_LEADER') return 'warning'
    if (roleCode === 'R_MANAGER') return 'primary'
    return 'info'
  }

  function stageText(stages: string[] = []) {
    return stages
      .map((stage) => medicalRecordStageOptions.find((option) => option.value === stage)?.label)
      .filter(Boolean)
      .join('、')
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

  .table-tools {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .tool-button {
    width: 34px;
    padding: 0;
  }

  .board-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .filter-form {
    margin-bottom: 8px;
  }

  .user-cell {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    font-weight: 600;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 6px;
  }

  .user-name {
    font-weight: 600;
  }

  .user-meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
