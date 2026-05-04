<template>
  <ElCard>
    <template #header>
      <div>
        <h3 class="m-0 text-lg font-medium">新增用户</h3>
        <p class="mt-1 mb-0 text-sm text-gray-500"
          >用于超级管理员给新员工开通绩效考核账号，并写入 SQLite 账号表。</p
        >
      </div>
    </template>

    <ElForm :model="form" label-width="110px" class="max-w-180">
      <ElFormItem label="登录账号">
        <ElInput v-model="form.username" placeholder="例如 zhangsan" />
      </ElFormItem>
      <ElFormItem label="初始密码">
        <ElInput
          v-model="form.password"
          type="password"
          show-password
          placeholder="请输入初始密码"
        />
      </ElFormItem>
      <ElFormItem label="姓名">
        <ElInput v-model="form.displayName" placeholder="请输入员工姓名" />
      </ElFormItem>
      <ElFormItem label="工号">
        <ElInput v-model="form.employeeNo" placeholder="例如 HOS009" />
      </ElFormItem>
      <ElFormItem label="邮箱">
        <ElInput v-model="form.email" placeholder="例如 user@hospital.local" />
      </ElFormItem>
      <ElFormItem label="手机号">
        <ElInput v-model="form.mobile" placeholder="用于后续短信/企微提醒" />
      </ElFormItem>
      <ElFormItem label="所属板块">
        <ElSelect v-model="form.boardId" class="w-full">
          <ElOption
            v-for="board in nonAllStaffBoards"
            :key="board.id"
            :label="board.name"
            :value="board.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="岗位">
        <ElInput v-model="form.position" placeholder="请输入岗位名称" />
      </ElFormItem>
      <ElFormItem label="病历权限">
        <ElSelect
          v-model="form.medicalRecordStages"
          multiple
          clearable
          collapse-tags
          collapse-tags-tooltip
          placeholder="不参与病历协作可留空"
          class="w-full"
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
        <ElRadioGroup v-model="form.roleCode">
          <ElRadioButton
            v-for="grant in enabledRoleGrants"
            :key="grant.roleCode"
            :label="grant.roleCode"
          >
            {{ grant.roleName }}
          </ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem label="友好模式">
        <ElSwitch v-model="form.elderlyFriendly" active-text="启用大龄员工友好提示" />
      </ElFormItem>
      <ElFormItem>
        <ElButton type="primary" :loading="saving" @click="submit">保存用户</ElButton>
        <ElButton @click="router.back()">返回</ElButton>
      </ElFormItem>
    </ElForm>
  </ElCard>
</template>

<script setup lang="ts">
  import { reactive, computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { boards } from '@/data/assessmentData'
  import { createAccountUser, fetchRoleGrants } from '@/api/assessment-admin'
  import type { BoardId, PermissionGrant, SystemRoleCode } from '@/types/assessment'
  import { medicalRecordStageOptions, type MedicalRecordStageKey } from '@/types/medicalRecord'

  const router = useRouter()
  const saving = ref(false)
  const permissionGrants = ref<PermissionGrant[]>([])
  const nonAllStaffBoards = computed(() => boards.filter((board) => board.id !== 'allStaff'))
  const enabledRoleGrants = computed(() =>
    permissionGrants.value.filter((role) => role.enabled !== false)
  )

  const form = reactive({
    username: '',
    password: '',
    displayName: '',
    employeeNo: '',
    email: '',
    mobile: '',
    boardId: 'medical' as BoardId,
    position: '',
    medicalRecordStages: [] as MedicalRecordStageKey[],
    roleCode: 'R_EMPLOYEE' as SystemRoleCode,
    elderlyFriendly: true
  })

  onMounted(async () => {
    permissionGrants.value = await fetchRoleGrants()
  })

  async function submit() {
    if (!form.username || !form.password || !form.displayName || !form.employeeNo || !form.email) {
      ElMessage.warning('请完整填写账号、密码、姓名、工号和邮箱')
      return
    }

    saving.value = true
    try {
      await createAccountUser({
        username: form.username,
        password: form.password,
        displayName: form.displayName,
        employeeNo: form.employeeNo,
        email: form.email,
        roleCode: form.roleCode,
        boardId: form.boardId,
        position: form.position,
        mobile: form.mobile,
        medicalRecordStages: form.medicalRecordStages,
        elderlyFriendly: form.elderlyFriendly
      })
      ElMessage.success('用户已写入 SQLite，可使用新账号登录')
      await router.push('/assessment-admin/employees')
    } finally {
      saving.value = false
    }
  }
</script>
