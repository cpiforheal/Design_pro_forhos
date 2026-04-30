<template>
  <div class="notice-ticker">
    <div class="notice-icon">
      <ArtSvgIcon icon="ri:volume-up-line" />
    </div>
    <div class="notice-label">频道播报</div>
    <div class="notice-window">
      <div class="notice-track">
        <span v-for="(message, index) in displayMessages" :key="`${message}-${index}`">
          {{ message }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    messages: string[]
  }>()

  const displayMessages = computed(() => {
    const source = props.messages.length ? props.messages : ['暂无新的任务提醒']
    return [...source, ...source]
  })
</script>

<style scoped lang="scss">
  .notice-ticker {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 10px 16px;
    margin-bottom: 16px;
    overflow: hidden;
    color: #7c2d12;
    border: 1px solid rgb(251 146 60 / 40%);
    border-radius: 16px;
    background: linear-gradient(90deg, #fff7ed, #fffbeb 45%, #fef2f2);
    box-shadow: 0 10px 28px rgb(251 146 60 / 18%);
  }

  .notice-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    color: #fff;
    border-radius: 50%;
    background: #ea580c;
    box-shadow: 0 0 0 8px rgb(234 88 12 / 12%);
  }

  .notice-label {
    flex: 0 0 auto;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .notice-window {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .notice-track {
    display: inline-flex;
    gap: 38px;
    min-width: 100%;
    white-space: nowrap;
    animation: ticker-scroll 26s linear infinite;

    span {
      font-weight: 600;
    }
  }

  .notice-ticker:hover .notice-track {
    animation-play-state: paused;
  }

  @keyframes ticker-scroll {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(-50%);
    }
  }
</style>
