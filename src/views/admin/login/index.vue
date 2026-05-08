<template>
  <div class="admin-login-page">
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

        <el-form class="login-form" @submit.prevent="login">
          <el-form-item>
            <el-input
              v-model.trim="account"
              class="login-input"
              placeholder="请输入账号"
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model.trim="password"
              class="login-input"
              placeholder="请输入密码"
              type="password"
              show-password
              autocomplete="current-password"
            />
          </el-form-item>

          <div class="login-meta">
            <span>内部系统请勿外借账号</span>
          </div>

          <el-button type="primary" class="login-button" :loading="loading" @click="login">
            登录系统
          </el-button>
        </el-form>
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
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { fetchGetUserInfo, fetchLogin } from '@/api/auth'
  import AppConfig from '@/config'
  import hospitalLogo from '@/assets/images/common/logo1.jpg'

  const account = ref('admin')
  const password = ref('admin123')
  const loading = ref(false)
  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const systemName = AppConfig.systemInfo.name
  const now = ref(new Date())
  const currentYear = new Date().getFullYear()
  let timer: ReturnType<typeof setInterval> | undefined

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

      ElMessage.success('登录成功，已按账号权限生成菜单')

      const roles = userInfo.roles || []
      const defaultRedirect = roles.includes('R_EMPLOYEE')
        ? '/employee-assessment/my'
        : roles.includes('R_LEADER')
          ? '/assessment-review/leader-view'
          : roles.includes('R_MANAGER')
            ? '/assessment-review/manager-view'
            : '/assessment/workbench'
      const queryRedirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
      const redirect = queryRedirect || defaultRedirect
      await router.push(redirect)
    } finally {
      loading.value = false
    }
  }

  function pad(value: number) {
    return String(value).padStart(2, '0')
  }
</script>

<style scoped>
  .admin-login-page {
    position: relative;
    display: grid;
    grid-template-columns: minmax(340px, 34vw) 1fr;
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
    color: #14251d;
    background:
      radial-gradient(circle at 12% 12%, rgb(55 164 103 / 12%), transparent 28%),
      linear-gradient(135deg, #f7fbf7 0%, #eef6ee 42%, #dceadc 100%);
  }

  .login-panel {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: clamp(28px, 4vw, 52px) clamp(28px, 4.2vw, 58px);
    background:
      linear-gradient(180deg, rgb(255 255 255 / 95%), rgb(250 255 250 / 90%)),
      repeating-linear-gradient(
        135deg,
        rgb(36 128 84 / 3.5%) 0,
        rgb(36 128 84 / 3.5%) 1px,
        transparent 1px,
        transparent 12px
      );
    box-shadow: 28px 0 70px rgb(31 92 58 / 10%);
  }

  .brand {
    display: flex;
    gap: 13px;
    align-items: center;
  }

  .brand-logo {
    width: 50px;
    height: 50px;
    padding: 5px;
    object-fit: contain;
    background: #fff;
    border: 1px solid rgb(31 124 78 / 14%);
    border-radius: 15px;
    box-shadow: 0 12px 28px rgb(35 101 65 / 12%);
  }

  .brand-kicker {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 700;
    color: #259362;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .brand h1 {
    margin: 0;
    font-size: clamp(21px, 2.2vw, 29px);
    font-weight: 900;
    line-height: 1.1;
    color: #173927;
    letter-spacing: -0.04em;
  }

  .login-copy {
    margin-top: clamp(38px, 7vh, 72px);
  }

  .login-copy p {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 800;
    color: #22a66b;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .login-copy h2 {
    max-width: 360px;
    margin: 0;
    font-size: clamp(28px, 3.4vw, 46px);
    font-weight: 950;
    line-height: 1.1;
    color: #07140f;
    letter-spacing: -0.06em;
  }

  .login-copy span {
    display: block;
    max-width: 340px;
    margin-top: 16px;
    font-size: 14px;
    line-height: 1.7;
    color: #607166;
  }

  .form-card {
    width: min(100%, 360px);
    margin-top: clamp(28px, 5.5vh, 54px);
  }

  .form-heading h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 850;
    color: #173927;
  }

  .form-heading p {
    margin: 8px 0 0;
    font-size: 13px;
    color: #78887d;
  }

  .login-form {
    margin-top: 20px;
  }

  :deep(.el-input__wrapper) {
    height: 46px;
    padding: 0 15px;
    background: rgb(255 255 255 / 82%);
    border-radius: 14px;
    box-shadow: inset 0 0 0 1px rgb(32 91 65 / 12%);
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow:
      inset 0 0 0 1px rgb(21 118 74 / 46%),
      0 12px 30px rgb(19 99 61 / 14%);
  }

  .login-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 12px;
    color: #8a988e;
  }

  .login-button {
    width: 100%;
    height: 48px;
    margin-top: 24px;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(135deg, #26b06d, #168755);
    border: none;
    border-radius: 14px;
    box-shadow: 0 14px 26px rgb(22 135 85 / 22%);
  }

  .login-button:hover {
    background: linear-gradient(135deg, #2abc76, #1a935d);
    transform: translateY(-1px);
  }

  .login-footer {
    padding-top: 32px;
    margin: auto 0 0;
    font-size: 12px;
    color: #8c9a90;
  }

  .time-panel {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 100vh;
    overflow: hidden;
    background:
      radial-gradient(circle at 78% 22%, rgb(255 255 255 / 86%), transparent 18%),
      radial-gradient(circle at 70% 86%, rgb(40 127 78 / 24%), transparent 28%),
      linear-gradient(135deg, #cfd7cf 0%, #c5cec5 55%, #b9c7bb 100%);
  }

  .time-panel::before,
  .time-panel::after {
    position: absolute;
    right: -130px;
    width: 320px;
    height: 145px;
    pointer-events: none;
    content: '';
    background:
      radial-gradient(ellipse at center, rgb(18 100 42 / 90%) 0 48%, transparent 50%),
      linear-gradient(80deg, transparent 49%, rgb(234 255 233 / 55%) 50%, transparent 51%);
    filter: drop-shadow(0 18px 18px rgb(25 82 41 / 20%));
    border-radius: 60% 40% 58% 42%;
    opacity: 0.85;
    transform: rotate(-14deg);
  }

  .time-panel::before {
    top: 28%;
  }

  .time-panel::after {
    right: -80px;
    bottom: 8%;
    width: 390px;
    height: 178px;
    opacity: 0.74;
    transform: rotate(14deg);
  }

  .time-orbit {
    position: absolute;
    border: 1px solid rgb(255 255 255 / 38%);
    border-radius: 999px;
  }

  .time-orbit-one {
    inset: 10% 8% auto auto;
    width: 340px;
    height: 340px;
  }

  .time-orbit-two {
    bottom: -180px;
    left: 18%;
    width: 430px;
    height: 430px;
    border-color: rgb(32 105 64 / 16%);
  }

  .leaf {
    position: absolute;
    pointer-events: none;
    background: linear-gradient(135deg, #2c8b45 0%, #0d5b28 58%, #073d1b 100%);
    border-radius: 85% 10%;
    box-shadow: inset 16px 0 18px rgb(255 255 255 / 16%);
    transform-origin: center;
  }

  .leaf::after {
    position: absolute;
    inset: 50% 8% auto 10%;
    height: 1px;
    content: '';
    background: rgb(230 255 230 / 62%);
    transform: rotate(-18deg);
  }

  .leaf-one {
    right: 6%;
    bottom: 25%;
    width: 124px;
    height: 54px;
    transform: rotate(-26deg);
  }

  .leaf-two {
    right: 24%;
    bottom: 13%;
    width: 86px;
    height: 40px;
    opacity: 0.78;
    transform: rotate(24deg);
  }

  .leaf-three {
    top: 30%;
    right: 18%;
    width: 96px;
    height: 43px;
    opacity: 0.7;
    transform: rotate(10deg);
  }

  .time-card-wrap {
    position: relative;
    z-index: 2;
    width: min(72%, 540px);
    text-align: center;
    animation: floatIn 0.7s ease-out both;
  }

  .time-kicker {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 900;
    color: rgb(255 255 255 / 78%);
    text-transform: uppercase;
    letter-spacing: 0.22em;
  }

  .time-card-wrap h2 {
    margin: 0;
    font-size: clamp(30px, 4vw, 50px);
    font-weight: 950;
    color: #fff;
    text-shadow: 0 18px 36px rgb(58 78 62 / 26%);
    letter-spacing: -0.05em;
  }

  .date-line {
    margin: 12px 0 0;
    font-size: 15px;
    font-weight: 700;
    color: rgb(255 255 255 / 86%);
  }

  .time-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(100px, 1fr));
    gap: 16px;
    margin-top: 28px;
  }

  .time-unit {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 122px;
    padding: 20px 14px 16px;
    overflow: hidden;
    color: #fff;
    background: rgb(83 94 87 / 62%);
    backdrop-filter: blur(9px);
    border: 1px solid rgb(255 255 255 / 24%);
    border-radius: 16px;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 16%),
      0 20px 44px rgb(41 64 45 / 18%);
  }

  .time-unit::before {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background: linear-gradient(180deg, rgb(255 255 255 / 12%), transparent 48%);
  }

  .time-value {
    position: relative;
    display: block;
    font-size: clamp(30px, 3.2vw, 40px);
    font-weight: 950;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .seconds .time-value {
    transform-origin: 50% 100%;
    animation: flipSecond 0.72s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .time-unit i {
    width: 78%;
    height: 1px;
    margin: 14px 0 10px;
    background: rgb(255 255 255 / 52%);
  }

  .time-unit strong {
    font-size: 17px;
    font-weight: 500;
  }

  .time-note {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    max-width: 460px;
    padding: 13px 15px;
    margin: 22px auto 0;
    color: rgb(255 255 255 / 78%);
    text-align: left;
    background: rgb(44 61 47 / 18%);
    backdrop-filter: blur(8px);
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 14px;
  }

  .time-note span {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
    margin-top: 7px;
    background: #32d47e;
    border-radius: 999px;
    box-shadow: 0 0 0 6px rgb(50 212 126 / 14%);
  }

  .time-note p {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
  }

  @keyframes flipSecond {
    0% {
      opacity: 0.25;
      transform: rotateX(86deg) translateY(-8px);
    }

    54% {
      opacity: 1;
      transform: rotateX(-14deg) translateY(1px);
    }

    100% {
      opacity: 1;
      transform: rotateX(0) translateY(0);
    }
  }

  @keyframes floatIn {
    from {
      opacity: 0;
      transform: translateY(18px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (width <= 1024px) {
    .admin-login-page {
      grid-template-columns: 1fr;
    }

    .login-panel {
      min-height: auto;
    }

    .time-panel {
      min-height: 520px;
    }
  }

  @media (width <= 640px) {
    .login-panel {
      padding: 28px 22px 34px;
    }

    .brand {
      align-items: flex-start;
    }

    .brand-logo {
      width: 50px;
      height: 50px;
    }

    .login-copy {
      margin-top: 42px;
    }

    .login-meta {
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .time-grid {
      grid-template-columns: 1fr;
    }

    .time-unit {
      min-height: 120px;
    }
  }
</style>
