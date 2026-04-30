<template>
  <div class="assessment-calendar-card">
    <div class="calendar-header">
      <div>
        <strong>{{ title }}</strong>
        <p>{{ subtitle }}</p>
      </div>
      <ElTag type="primary" effect="light">{{ totalCount }} 项</ElTag>
    </div>

    <ElCalendar v-model="calendarDate" class="compact-calendar">
      <template #date-cell="{ data }">
        <button class="calendar-day" type="button" @click.stop="openDay(data.day)">
          <span class="day-number">{{ getDayNumber(data.day) }}</span>
          <span v-if="getDayStats(data.day).total" class="day-dots">
            <i v-if="getDayStats(data.day).completed" class="dot completed" />
            <i v-if="getDayStats(data.day).pending" class="dot pending" />
            <i v-if="getDayStats(data.day).assigned" class="dot assigned" />
          </span>
          <small v-if="getDayStats(data.day).total" class="day-total">
            {{ getDayStats(data.day).total }} 项
          </small>
        </button>
      </template>
    </ElCalendar>

    <div class="legend-row">
      <span><i class="dot completed" />已完成</span>
      <span><i class="dot pending" />未完成</span>
      <span><i class="dot assigned" />上级下发</span>
    </div>

    <ElDialog v-model="dialogVisible" :title="`${selectedDay} 任务明细`" width="720px">
      <div class="day-summary">
        <div>
          <b>{{ selectedCompletedItems.length }}</b>
          <span>已完成</span>
        </div>
        <div>
          <b>{{ selectedPendingItems.length }}</b>
          <span>未完成</span>
        </div>
        <div>
          <b>{{ selectedAssignedItems.length }}</b>
          <span>上级下发</span>
        </div>
      </div>

      <ElTabs model-value="all">
        <ElTabPane label="全部" name="all">
          <div v-if="selectedItems.length" class="task-list">
            <div v-for="item in selectedItems" :key="item.id" class="task-row">
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.source }} · {{ item.owner || '未指定负责人' }}</p>
              </div>
              <div class="task-actions">
                <ElTag :type="item.status === 'completed' ? 'success' : 'danger'" effect="light">
                  {{ item.status === 'completed' ? '已完成' : '未完成' }}
                </ElTag>
                <ElButton type="primary" link @click="openTask(item)">跳转任务</ElButton>
              </div>
            </div>
          </div>
          <ElEmpty v-else description="当天暂无任务记录" />
        </ElTabPane>
        <ElTabPane label="已完成" name="completed">
          <div v-if="selectedCompletedItems.length" class="task-list">
            <div v-for="item in selectedCompletedItems" :key="item.id" class="task-row">
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.source }} · {{ item.owner || '未指定负责人' }}</p>
              </div>
              <div class="task-actions">
                <ElTag type="success" effect="light">已完成</ElTag>
                <ElButton type="primary" link @click="openTask(item)">跳转任务</ElButton>
              </div>
            </div>
          </div>
          <ElEmpty v-else description="当天暂无已完成任务" />
        </ElTabPane>
        <ElTabPane label="未完成" name="pending">
          <div v-if="selectedPendingItems.length" class="task-list">
            <div v-for="item in selectedPendingItems" :key="item.id" class="task-row">
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.source }} · {{ item.owner || '未指定负责人' }}</p>
              </div>
              <div class="task-actions">
                <ElTag type="danger" effect="light">未完成</ElTag>
                <ElButton type="primary" link @click="openTask(item)">跳转任务</ElButton>
              </div>
            </div>
          </div>
          <ElEmpty v-else description="当天暂无未完成任务" />
        </ElTabPane>
        <ElTabPane label="上级下发" name="assigned">
          <div v-if="selectedAssignedItems.length" class="task-list">
            <div v-for="item in selectedAssignedItems" :key="item.id" class="task-row">
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.source }} · {{ item.owner || '未指定负责人' }}</p>
              </div>
              <div class="task-actions">
                <ElTag type="primary" effect="light">上级下发</ElTag>
                <ElButton type="primary" link @click="openTask(item)">跳转任务</ElButton>
              </div>
            </div>
          </div>
          <ElEmpty v-else description="当天暂无上级负责人下发任务" />
        </ElTabPane>
      </ElTabs>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'

  export interface AssessmentCalendarItem {
    id: string
    title: string
    source: string
    owner?: string
    deadline: string
    status: 'completed' | 'pending' | 'na'
  }

  const props = withDefaults(
    defineProps<{
      title?: string
      subtitle?: string
      items: AssessmentCalendarItem[]
    }>(),
    {
      title: '日历任务',
      subtitle: '点击日期查看当天任务完成情况'
    }
  )

  const emit = defineEmits<{
    (event: 'task-click', item: AssessmentCalendarItem): void
  }>()

  const calendarDate = ref(new Date())
  const dialogVisible = ref(false)
  const selectedDay = ref(formatDate(new Date()))

  const totalCount = computed(() => props.items.length)
  const selectedItems = computed(() =>
    props.items.filter((item) => normalizeDay(item.deadline) === selectedDay.value)
  )
  const selectedCompletedItems = computed(() =>
    selectedItems.value.filter((item) => item.status === 'completed')
  )
  const selectedPendingItems = computed(() =>
    selectedItems.value.filter((item) => item.status !== 'completed')
  )
  const selectedAssignedItems = computed(() =>
    selectedItems.value.filter((item) => isAssignedTask(item.source))
  )

  function openDay(day: string) {
    selectedDay.value = day
    dialogVisible.value = true
  }

  function openTask(item: AssessmentCalendarItem) {
    dialogVisible.value = false
    emit('task-click', item)
  }

  function getDayNumber(day: string) {
    return Number(day.slice(-2))
  }

  function getDayStats(day: string) {
    const dayItems = props.items.filter((item) => normalizeDay(item.deadline) === day)
    return {
      total: dayItems.length,
      completed: dayItems.some((item) => item.status === 'completed'),
      pending: dayItems.some((item) => item.status !== 'completed'),
      assigned: dayItems.some((item) => isAssignedTask(item.source))
    }
  }

  function isAssignedTask(source: string) {
    return source.includes('分管负责人') || source.includes('负责人') || source.includes('上级')
  }

  function normalizeDay(value: string) {
    const today = new Date()
    if (!value) return formatDate(today)

    const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/)
    if (isoMatch) return isoMatch[0]

    const slashMatch = value.match(/(\d{4})[/.](\d{1,2})[/.](\d{1,2})/)
    if (slashMatch) {
      const [, year, month, day] = slashMatch
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    if (value.includes('今天') || value.includes('今日')) return formatDate(today)
    if (value.includes('明天') || value.includes('明日')) return formatDate(addDays(today, 1))
    if (value.includes('昨天') || value.includes('昨日')) return formatDate(addDays(today, -1))

    const weekIndex = resolveWeekIndex(value)
    if (weekIndex !== -1) return formatDate(getDateOfCurrentWeek(weekIndex))

    return formatDate(today)
  }

  function resolveWeekIndex(value: string) {
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekdayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekIndex = weekMap.findIndex((label) => value.includes(label))
    if (weekIndex !== -1) return weekIndex
    return weekdayMap.findIndex((label) => value.includes(label))
  }

  function getDateOfCurrentWeek(targetDay: number) {
    const date = new Date()
    const currentDay = date.getDay()
    date.setDate(date.getDate() + targetDay - currentDay)
    return date
  }

  function addDays(date: Date, days: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  function formatDate(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }
</script>

<style scoped lang="scss">
  .assessment-calendar-card {
    height: 100%;
  }

  .calendar-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    strong {
      color: var(--art-text-gray-900);
      font-size: 18px;
      font-weight: 500;
    }

    p {
      margin: 5px 0 0;
      color: var(--art-text-gray-600);
      font-size: 13px;
    }
  }

  .compact-calendar {
    --el-calendar-cell-width: 52px;

    :deep(.el-calendar__header) {
      padding: 8px 0 12px;
      border-bottom: 0;
    }

    :deep(.el-calendar__body) {
      padding: 0;
    }

    :deep(.el-calendar-table td) {
      border: 0;
    }

    :deep(.el-calendar-day) {
      height: 58px;
      padding: 3px;
    }
  }

  .calendar-day {
    display: flex;
    position: relative;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    height: 100%;
    color: var(--art-text-gray-800);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 12px;

    &:hover {
      background: var(--el-color-primary-light-9);
    }
  }

  .day-number {
    font-size: 14px;
    font-weight: 600;
  }

  .day-dots,
  .legend-row span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 999px;

    &.completed {
      background: var(--el-color-success);
    }

    &.pending {
      background: var(--el-color-danger);
    }

    &.assigned {
      background: var(--el-color-primary);
    }
  }

  .day-total {
    color: var(--art-text-gray-500);
    font-size: 11px;
  }

  .legend-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 8px;
    color: var(--art-text-gray-600);
    font-size: 12px;
  }

  .day-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;

    div {
      padding: 14px;
      text-align: center;
      border-radius: 14px;
      background: var(--el-fill-color-light);
    }

    b,
    span {
      display: block;
    }

    b {
      color: var(--el-color-primary);
      font-size: 24px;
    }

    span {
      margin-top: 4px;
      color: var(--art-text-gray-600);
    }
  }

  .task-list {
    display: grid;
    gap: 10px;
  }

  .task-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 14px;

    .task-actions {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      gap: 8px;
    }

    strong {
      color: var(--art-text-gray-900);
    }

    p {
      margin: 5px 0 0;
      color: var(--art-text-gray-500);
      font-size: 13px;
    }
  }
</style>
