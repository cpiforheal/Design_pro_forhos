<template>
  <div class="admin-login-page">
    <el-card class="login-card">
      <div class="brand">
        <div class="logo">管</div>
        <div>
          <h1>后台管理登录</h1>
          <p>每周二全院基本工作综合考核平台</p>
        </div>
      </div>

      <template v-if="!isAuthed">
        <el-form label-position="top" class="login-form" @submit.prevent="login">
          <el-form-item label="账号">
            <el-input v-model="account" size="large" prefix-icon="User" autocomplete="username" />
          </el-form-item>
          <el-form-item label="登录密码">
            <el-input
              v-model="password"
              size="large"
              prefix-icon="Lock"
              type="password"
              show-password
              autocomplete="current-password"
            />
          </el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-button"
            :loading="loading"
            @click="login"
            >登录并校验权限</el-button
          >
        </el-form>
        <el-alert
          type="info"
          show-icon
          :closable="false"
          title="超级管理员账号：admin / admin123。登录后系统会从 SQLite 读取账号角色，并按权限等级生成侧边栏菜单。"
        />
      </template>

      <template v-else>
        <el-alert
          type="success"
          show-icon
          :closable="false"
          title="已完成账号校验"
          :description="`当前登录：${userStore.info.userName}，权限：${userStore.currentRoles.join('、')}`"
        />
        <div class="module-grid">
          <div v-for="item in modules" :key="item.title" class="module-card">
            <strong>{{ item.title }}</strong>
            <p>{{ item.desc }}</p>
            <el-tag>{{ item.tag }}</el-tag>
          </div>
        </div>
      </template>

      <router-link to="/assessment/workbench" class="back-link">返回考核平台</router-link>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { commonAssessmentItems, boardAssessmentItems } from '@/data/assessmentData'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import { useUserStore } from '@/store/modules/user'
  import { fetchGetUserInfo, fetchLogin } from '@/api/auth'

  const account = ref('admin')
  const password = ref('admin123')
  const isAuthed = ref(false)
  const loading = ref(false)
  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const { rectificationItems } = useAssessmentPlatform()

  const modules = [
    {
      title: '用户管理',
      desc: '维护管理员、员工、负责人、所属板块与岗位信息。',
      tag: '待接入接口'
    },
    {
      title: '权限配置',
      desc: '后续接入 RBAC、菜单权限、按钮权限和数据范围。',
      tag: '暂不启用校验'
    },
    {
      title: '考核模板',
      desc: '管理全员通用、板块专项、本周任务和整改模板。',
      tag: `${commonAssessmentItems.length + boardAssessmentItems.length} 条考核项`
    },
    {
      title: '数据审计',
      desc: '记录导出、整改闭环、红线触发和登录日志。',
      tag: `${rectificationItems.value.length} 项整改`
    }
  ]

  async function login() {
    if (!account.value || !password.value) {
      ElMessage.warning('请输入账号和密码')
      return
    }

    loading.value = true
    try {
      const loginResponse = await fetchLogin({
        userName: account.value.trim(),
        password: password.value
      })
      userStore.setAuthSession(loginResponse)
      const userInfo = await fetchGetUserInfo()
      userStore.setUserInfo(userInfo)
      userStore.checkAndClearWorktabs()

      isAuthed.value = true
      ElMessage.success('登录成功，已按账号权限生成菜单')

      const isEmployee = userInfo.roles.includes('R_EMPLOYEE')
      const defaultRedirect = isEmployee ? '/employee-assessment/my' : '/assessment/workbench'
      const queryRedirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
      const redirect =
        isEmployee && !queryRedirect.startsWith('/employee-assessment')
          ? defaultRedirect
          : queryRedirect || defaultRedirect
      await router.push(redirect)
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
  .admin-login-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 32px;
    background:
      radial-gradient(circle at 20% 20%, rgb(20 184 166 / 28%), transparent 32%),
      linear-gradient(135deg, #052f55, #075985 52%, #0f766e);
  }
  .login-card {
    width: min(760px, 100%);
    border: 0;
    border-radius: 24px;
    box-shadow: 0 26px 70px rgb(2 6 23 / 28%);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 26px;
  }
  .logo {
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 24px;
    font-weight: 800;
    border-radius: 16px;
    background: linear-gradient(135deg, #0f766e, #075985);
  }
  h1 {
    margin: 0 0 6px;
    color: #0f172a;
  }
  p {
    color: #64748b;
  }
  .login-form {
    margin-bottom: 16px;
  }
  .login-button {
    width: 100%;
  }
  .module-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  .module-card {
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: #f8fafc;
  }
  .module-card strong {
    color: #0f172a;
  }
  .module-card p {
    min-height: 44px;
    margin: 8px 0 12px;
    line-height: 1.6;
  }
  .back-link {
    display: block;
    margin-top: 20px;
    text-align: center;
    color: #0f766e;
    font-weight: 700;
  }
  @media (max-width: 700px) {
    .module-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
