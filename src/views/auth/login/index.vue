<!-- 登录页面 -->
<template>
  <div class="login-page">
    <section class="login-panel">
      <div class="brand">
        <img class="brand-logo" :src="hospitalLogo" alt="医院 logo" />
        <div>
          <p class="brand-kicker">医院内部管理平台</p>
          <h1>{{ systemName }}</h1>
        </div>
      </div>

      <div class="login-copy">
        <p>Performance & Medical Record</p>
        <h2>绩效考核与病历协作系统</h2>
        <span>用于院内任务闭环、岗位考核、整改追踪和病历协作填写。</span>
      </div>

      <div class="form-card">
        <div class="form-heading">
          <h3>账号登录</h3>
          <p>请输入管理员分配的账号和密码</p>
        </div>

        <ElForm
          ref="formRef"
          :model="formData"
          :rules="rules"
          :key="formKey"
          @keyup.enter="handleSubmit"
          class="login-form"
        >
          <ElFormItem prop="username">
            <ElInput
              class="login-input"
              placeholder="请输入账号"
              v-model.trim="formData.username"
            />
          </ElFormItem>
          <ElFormItem prop="password">
            <ElInput
              class="login-input"
              placeholder="请输入密码"
              v-model.trim="formData.password"
              type="password"
              autocomplete="off"
              show-password
            />
          </ElFormItem>

          <div class="login-meta">
            <ElCheckbox v-model="formData.rememberPassword">记住登录状态</ElCheckbox>
            <span>内部系统请勿外借账号</span>
          </div>

          <div class="submit-wrap">
            <ElButton
              class="login-submit"
              type="primary"
              @click="handleSubmit"
              :loading="loading"
              v-ripple
            >
              登录系统
            </ElButton>
          </div>
        </ElForm>
      </div>

      <p class="login-footer">© {{ currentYear }} {{ systemName }} · 内部使用</p>
    </section>

    <section class="time-panel">
      <div class="time-orbit time-orbit-one"></div>
      <div class="time-orbit time-orbit-two"></div>
      <div class="leaf leaf-one"></div>
      <div class="leaf leaf-two"></div>
      <div class="leaf leaf-three"></div>

      <div class="time-card-wrap">
        <p class="time-kicker">Current Time</p>
        <h2>当前时间</h2>
        <p class="date-line">{{ dateText }}</p>

        <div class="time-grid">
          <div class="time-unit">
            <span class="time-value">{{ timeParts.hour }}</span>
            <i></i>
            <strong>时</strong>
          </div>
          <div class="time-unit">
            <span class="time-value">{{ timeParts.minute }}</span>
            <i></i>
            <strong>分</strong>
          </div>
          <div class="time-unit seconds">
            <span :key="timeParts.second" class="time-value">{{ timeParts.second }}</span>
            <i></i>
            <strong>秒</strong>
          </div>
        </div>

        <div class="time-note">
          <span></span>
          <p>以当前设备时间为准，适合院内局域网部署和日常考核打卡查看。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import hospitalLogo from '@/assets/images/common/logo1.jpg'
  import { useUserStore } from '@/store/modules/user'
  import { HttpError } from '@/utils/http/error'
  import { fetchLogin } from '@/api/auth'
  import { ElNotification, type FormInstance, type FormRules } from 'element-plus'

  defineOptions({ name: 'Login' })

  const formKey = ref(0)
  const userStore = useUserStore()
  const router = useRouter()
  const route = useRoute()
  const systemName = AppConfig.systemInfo.name
  const formRef = ref<FormInstance>()
  const now = ref(new Date())
  const currentYear = new Date().getFullYear()
  let timer: ReturnType<typeof setInterval> | undefined

  const formData = reactive({
    username: '',
    password: '',
    rememberPassword: true
  })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
  }))

  const loading = ref(false)

  const timeParts = computed(() => ({
    hour: pad(now.value.getHours()),
    minute: pad(now.value.getMinutes()),
    second: pad(now.value.getSeconds())
  }))

  const dateText = computed(() =>
    new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(now.value)
  )

  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date()
    }, 1000)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      // 表单验证
      const valid = await formRef.value.validate()
      if (!valid) return

      loading.value = true

      // 登录请求
      const { username, password } = formData

      const { token, refreshToken } = await fetchLogin({
        userName: username,
        password
      })

      // 验证token
      if (!token) {
        throw new Error('Login failed - no token received')
      }

      // 存储 token 和登录状态
      userStore.setToken(token, refreshToken)
      userStore.setLoginStatus(true)

      // 登录成功处理
      showLoginSuccessNotice()

      // 获取 redirect 参数，如果存在则跳转到指定页面，否则按角色进入最简入口
      const redirect = route.query.redirect as string
      const roles = userStore.info.roles || []
      const landingPath = roles.includes('R_EMPLOYEE')
        ? '/employee-assessment/my'
        : roles.includes('R_LEADER')
          ? '/assessment-review/leader-view'
          : roles.includes('R_MANAGER')
            ? '/assessment-review/manager-view'
            : '/assessment/workbench'
      router.push(redirect || landingPath)
    } catch (error) {
      // 处理 HttpError
      if (error instanceof HttpError) {
        // console.log(error.code)
      } else {
        // 处理非 HttpError
        // ElMessage.error('登录失败，请稍后重试')
        console.error('[Login] Unexpected error:', error)
      }
    } finally {
      loading.value = false
    }
  }

  function pad(value: number) {
    return String(value).padStart(2, '0')
  }

  // 登录成功提示
  const showLoginSuccessNotice = () => {
    setTimeout(() => {
      ElNotification({
        title: '登录成功',
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        message: `欢迎进入${systemName}`
      })
    }, 1000)
  }
</script>

<style scoped>
  @import './style.css';
</style>

<style lang="scss" scoped>
  :deep(.el-input__wrapper) {
    height: 52px !important;
    padding: 0 18px;
    background: rgb(255 255 255 / 82%);
    border-radius: 16px;
    box-shadow: inset 0 0 0 1px rgb(32 91 65 / 12%);
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow:
      inset 0 0 0 1px rgb(21 118 74 / 46%),
      0 12px 30px rgb(19 99 61 / 14%);
  }

  :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: #1f9a63;
    border-color: #1f9a63;
  }

  :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
    color: #1f7a52;
  }
</style>
