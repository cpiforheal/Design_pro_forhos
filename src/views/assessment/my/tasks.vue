<template>
  <div
    class="employee-simple-page"
    :class="{ 'is-elderly-friendly': currentEmployee.elderlyFriendly }"
  >
    <ElCard class="intro-card" shadow="never">
      <h2>我的待办</h2>
      <p
        >全员通用、岗位专项和推送任务集中在这里处理。考核项按完成情况确认，任务完成前必须上传佐证材料。</p
      >
    </ElCard>

    <ElAlert
      v-if="pendingAssessmentItems.length"
      class="page-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="`有 ${pendingAssessmentItems.length} 项考核待确认`"
      description="请逐项确认完成情况；未完成时补充整改措施。"
    />

    <ElAlert
      v-if="pendingTasks.length"
      class="page-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="`有 ${pendingTasks.length} 项任务待完成`"
      description="请先完成任务，再在对应卡片中点击“标记为已完成”。"
    />

    <ElAlert
      v-if="overdueTasks.length"
      class="page-alert"
      type="error"
      show-icon
      :closable="false"
      :title="`有 ${overdueTasks.length} 项任务已逾期，普通员工不能再提交或修改。`"
      description="请联系负责人在任务管理中延期，延期后本页会自动恢复可提交状态。"
    />

    <ElCard class="filter-card" shadow="never">
      <div class="filter-head">
        <div>
          <strong>任务类型筛选</strong>
          <p>只看当前要处理的一类事项，减少页面干扰。</p>
        </div>
        <ElTag type="info" effect="plain">当前 {{ visibleTodoCount }} 项</ElTag>
      </div>
      <ElRadioGroup v-model="activeFilter" class="filter-group">
        <ElRadioButton v-for="filter in taskFilters" :key="filter.value" :value="filter.value">
          {{ filter.label }} {{ filter.count }}
        </ElRadioButton>
      </ElRadioGroup>
    </ElCard>

    <div class="task-grid">
      <ElCard
        v-for="item in visibleAssessmentCards"
        :id="`assessment-${item.id}`"
        :key="item.id"
        class="task-card assessment-card"
        :class="[
          { 'is-target': route.query.assessmentId === item.id },
          `source-${resolveAssessmentScope(item)}`
        ]"
        shadow="never"
      >
        <div class="task-head">
          <ElTag :type="assessmentTagType(item)" effect="light">
            {{
              item.isRedline ? '红线考核' : item.boardId === 'allStaff' ? '全员通用' : '岗位专项'
            }}
          </ElTag>
          <ElTag :type="statusType(resolveAssessmentStatus(item))">
            {{ getStatusLabel(resolveAssessmentStatus(item)) }}
          </ElTag>
        </div>
        <h3>{{ item.title }}</h3>
        <div class="meta-list">
          <p><span>模块</span>{{ item.moduleName }}</p>
          <p><span>标准</span>{{ item.standard }}</p>
        </div>
        <div class="evidence-box">
          <div class="evidence-title">
            <span>处理说明</span>
            <ElTag size="small" type="info">未完成时填写整改</ElTag>
          </div>
          <ElInput
            :model-value="resolveAssessmentDraft(item).rectification"
            placeholder="未完成时填写整改措施"
            :disabled="isAssessmentLocked(item)"
            @input="updateAssessmentText(item, 'rectification', String($event))"
            @blur="persistAssessment(item.id, resolveAssessmentScope(item))"
          />
          <ElInput
            :model-value="resolveAssessmentDraft(item).remark"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="备注：可补充完成情况、时间或说明"
            :disabled="isAssessmentLocked(item)"
            @input="updateAssessmentText(item, 'remark', String($event))"
            @blur="persistAssessment(item.id, resolveAssessmentScope(item))"
          />
        </div>
        <div class="card-actions">
          <span class="status-hint">{{
            workflowHint(resolveAssessmentDraft(item).workflowStatus)
          }}</span>
          <ElButton
            type="primary"
            plain
            :disabled="isAssessmentLocked(item)"
            @click="toggleAssessment(item.id, resolveAssessmentScope(item))"
          >
            {{ actionText(resolveAssessmentStatus(item)) }}
          </ElButton>
        </div>
      </ElCard>

      <ElCard
        v-for="task in visibleTasks"
        :id="`task-${task.id}`"
        :key="task.id"
        class="task-card"
        :class="[
          {
            'is-target': route.query.taskId === task.id,
            'is-overdue': task.overdueLocked
          },
          task.source === '医院安排' ? 'source-hospital' : 'source-manager'
        ]"
        shadow="never"
      >
        <div class="task-head">
          <ElTag :type="task.source === '医院安排' ? 'primary' : 'warning'">{{
            task.source
          }}</ElTag>
          <ElTag v-if="task.overdueLocked" type="danger">已逾期</ElTag>
          <ElTag v-else-if="isNearDeadline(task)" type="warning">临近截止</ElTag>
        </div>
        <h3>{{ task.title }}</h3>
        <div class="meta-list">
          <p><span>责任人</span>{{ task.owner }}</p>
          <p><span>截止</span>{{ task.deadlineAt || task.deadline }}</p>
          <p v-if="task.taskCategory"><span>分类</span>{{ task.taskCategory }}</p>
        </div>
        <div class="evidence-box">
          <div class="evidence-title">
            <span>完成佐证</span>
            <ElTag
              size="small"
              :type="resolveDraft(task).attachments?.length ? 'success' : 'danger'"
            >
              {{ resolveDraft(task).attachments?.length ? '已上传' : '完成前必传' }}
            </ElTag>
          </div>
          <ElInput
            :model-value="resolveDraft(task).evidenceText"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="补充说明：例如完成时间、地点、对象或关键结果"
            :disabled="isTaskLocked(task)"
            @input="updateEvidenceText(task, String($event))"
            @blur="persistTask(task.id, resolveScope(task))"
          />
          <div class="evidence-actions">
            <ElUpload
              :show-file-list="false"
              :disabled="isTaskLocked(task) || loading"
              :http-request="(options) => uploadEvidence(task.id, options)"
              :before-upload="beforeEvidenceUpload"
            >
              <ElButton size="small" :disabled="isTaskLocked(task) || loading"> 上传材料 </ElButton>
            </ElUpload>
            <span class="evidence-tip">支持图片、PDF、Office 文档和压缩包，单个不超过 20MB。</span>
          </div>
          <div v-if="resolveDraft(task).attachments?.length" class="attachment-list">
            <div
              v-for="attachment in resolveDraft(task).attachments"
              :key="attachment.id"
              class="attachment-item"
            >
              <span>{{ attachment.name }}</span>
              <div>
                <ElButton
                  type="primary"
                  link
                  @click="downloadTaskAttachment(attachment.id, attachment.name)"
                >
                  下载
                </ElButton>
                <ElButton
                  type="danger"
                  link
                  :disabled="isTaskLocked(task)"
                  @click="removeTaskAttachment(attachment.id)"
                >
                  删除
                </ElButton>
              </div>
            </div>
          </div>
        </div>
        <div class="card-actions">
          <ElTag :type="statusType(resolveStatus(task))">{{
            getStatusLabel(resolveStatus(task))
          }}</ElTag>
          <ElButton
            type="primary"
            plain
            :disabled="isTaskLocked(task)"
            @click="handleToggleTask(task)"
          >
            {{ task.overdueLocked ? '需负责人延期' : actionText(resolveStatus(task)) }}
          </ElButton>
        </div>
      </ElCard>
    </div>

    <ElEmpty v-if="!visibleTodoCount" class="empty-card" description="当前筛选下没有待办事项" />
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import type { UploadRequestOptions } from 'element-plus'
  import type {
    AssessmentItem,
    AssessmentRecordDraft,
    AssessmentStatus,
    TaskItem,
    TaskRecordDraft
  } from '@/types/assessment'

  const route = useRoute()
  type TaskFilter = 'all' | 'pending' | 'common' | 'board' | 'hospital' | 'manager'
  const activeFilter = ref<TaskFilter>('all')
  const {
    currentEmployee,
    commonAssessmentItems,
    currentBoardItems,
    currentTasks,
    commonDrafts,
    boardDrafts,
    hospitalTaskDrafts,
    boardTaskDrafts,
    loading,
    toggleAssessment,
    persistAssessment,
    toggleTask,
    persistTask,
    uploadTaskAttachment,
    removeTaskAttachment,
    downloadTaskAttachment,
    updateAssessmentDraftField,
    updateTaskDraftField,
    getStatusLabel
  } = useAssessmentPlatform()
  const currentAssessmentCards = computed(() => [
    ...commonAssessmentItems.value,
    ...currentBoardItems.value
  ])
  const visibleAssessmentCards = computed(() =>
    currentAssessmentCards.value.filter((item) => matchAssessmentFilter(item))
  )
  const visibleTasks = computed(() => currentTasks.value.filter((task) => matchTaskFilter(task)))
  const visibleTodoCount = computed(
    () => visibleAssessmentCards.value.length + visibleTasks.value.length
  )
  const pendingAssessmentItems = computed(() =>
    currentAssessmentCards.value.filter((item) => resolveAssessmentStatus(item) === 'pending')
  )
  const overdueTasks = computed(() => currentTasks.value.filter((task) => task.overdueLocked))
  const pendingTasks = computed(() =>
    currentTasks.value.filter((task) => resolveStatus(task) === 'pending')
  )
  const taskFilters = computed<Array<{ label: string; value: TaskFilter; count: number }>>(() => [
    {
      label: '全部',
      value: 'all',
      count: currentAssessmentCards.value.length + currentTasks.value.length
    },
    {
      label: '待处理',
      value: 'pending',
      count: pendingAssessmentItems.value.length + pendingTasks.value.length
    },
    { label: '全员通用', value: 'common', count: commonAssessmentItems.value.length },
    { label: '板块考核', value: 'board', count: currentBoardItems.value.length },
    {
      label: '医院安排',
      value: 'hospital',
      count: currentTasks.value.filter((task) => task.source === '医院安排').length
    },
    {
      label: '负责人安排',
      value: 'manager',
      count: currentTasks.value.filter((task) => task.source !== '医院安排').length
    }
  ])

  watch(
    () => [route.query.taskId, route.query.assessmentId],
    async ([taskId, assessmentId]) => {
      if (!taskId && !assessmentId) return
      await nextTick()
      const targetId = assessmentId ? `assessment-${assessmentId}` : `task-${taskId}`
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    { immediate: true }
  )

  function resolveAssessmentScope(item: AssessmentItem) {
    return item.boardId === 'allStaff' ? 'common' : 'board'
  }

  function matchAssessmentFilter(item: AssessmentItem) {
    if (activeFilter.value === 'all') return true
    if (activeFilter.value === 'pending') return resolveAssessmentStatus(item) === 'pending'
    if (activeFilter.value === 'common') return resolveAssessmentScope(item) === 'common'
    if (activeFilter.value === 'board') return resolveAssessmentScope(item) === 'board'
    return false
  }

  function matchTaskFilter(task: TaskItem) {
    if (activeFilter.value === 'all') return true
    if (activeFilter.value === 'pending') return resolveStatus(task) === 'pending'
    if (activeFilter.value === 'hospital') return task.source === '医院安排'
    if (activeFilter.value === 'manager') return task.source !== '医院安排'
    return false
  }

  function resolveAssessmentDraft(item: AssessmentItem): AssessmentRecordDraft {
    return resolveAssessmentScope(item) === 'common'
      ? commonDrafts.value[item.id]
      : boardDrafts.value[item.id]
  }

  function resolveAssessmentStatus(item: AssessmentItem): AssessmentStatus {
    return resolveAssessmentDraft(item)?.status ?? 'completed'
  }

  function updateAssessmentText(
    item: AssessmentItem,
    field: 'rectification' | 'remark',
    value: string
  ) {
    updateAssessmentDraftField(item.id, resolveAssessmentScope(item), field, value)
  }

  function isAssessmentLocked(item: AssessmentItem) {
    const workflowStatus = resolveAssessmentDraft(item)?.workflowStatus
    return (
      workflowStatus === 'submitted' || workflowStatus === 'approved' || workflowStatus === 'closed'
    )
  }

  function assessmentTagType(item: AssessmentItem) {
    if (item.isRedline) return 'danger'
    return item.boardId === 'allStaff' ? 'success' : 'info'
  }

  function workflowHint(status?: string) {
    if (status === 'submitted') return '已提交，等待负责人审核'
    if (status === 'returned') return '已退回，请补充后重新提交'
    if (status === 'rectifying') return '整改中'
    if (status === 'approved' || status === 'closed') return '已通过审核'
    return '未提交前可随时调整'
  }

  function resolveStatus(task: TaskItem): AssessmentStatus {
    return resolveDraft(task).status ?? 'pending'
  }

  function resolveDraft(task: TaskItem): TaskRecordDraft {
    const draft =
      task.source === '医院安排'
        ? hospitalTaskDrafts.value[task.id]
        : boardTaskDrafts.value[task.id]
    return draft ?? { status: 'pending', remark: '', evidenceText: '', attachments: [] }
  }

  function resolveScope(task: TaskItem) {
    return task.source === '医院安排' ? 'hospital' : 'board'
  }

  function updateEvidenceText(task: TaskItem, value: string) {
    updateTaskDraftField(task.id, resolveScope(task), 'evidenceText', value)
  }

  async function handleToggleTask(task: TaskItem) {
    const draft = resolveDraft(task)
    const nextStatus = draft.status === 'completed' ? 'pending' : 'completed'
    if (nextStatus === 'completed' && !draft.attachments?.length) {
      ElMessage.warning('请先上传至少 1 份佐证材料，再标记任务已完成')
      return
    }
    await toggleTask(task.id, resolveScope(task))
  }

  async function uploadEvidence(taskId: string, options: UploadRequestOptions) {
    await uploadTaskAttachment(taskId, options.file)
    options.onSuccess?.({})
  }

  function beforeEvidenceUpload(file: File) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed'
    ]
    if (!allowedTypes.includes(file.type)) {
      ElMessage.warning('仅支持图片、PDF、Office 文档和压缩包')
      return false
    }
    if (file.size > 20 * 1024 * 1024) {
      ElMessage.warning('佐证材料单个文件不能超过 20MB')
      return false
    }
    return true
  }

  function isTaskLocked(task: TaskItem) {
    const workflowStatus = resolveDraft(task).workflowStatus
    return (
      Boolean(task.overdueLocked) ||
      workflowStatus === 'submitted' ||
      workflowStatus === 'approved' ||
      workflowStatus === 'closed'
    )
  }

  function actionText(status: AssessmentStatus) {
    return status === 'completed' ? '改为未完成' : '标记为已完成'
  }

  function statusType(status: AssessmentStatus) {
    if (status === 'pending') return 'danger'
    if (status === 'na') return 'info'
    return 'success'
  }

  function isNearDeadline(task: TaskItem) {
    const value = task.deadlineAt || task.deadline
    const timestamp = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'))
    if (Number.isNaN(timestamp)) return false
    const hours = (timestamp - Date.now()) / 36e5
    return hours > 0 && hours <= 24
  }
</script>

<style scoped lang="scss">
  .employee-simple-page {
    padding: 4px;
  }

  .intro-card,
  .filter-card,
  .task-card {
    border: 0;
    border-radius: 12px;
  }

  .intro-card,
  .filter-card,
  .page-alert {
    margin-bottom: 16px;
  }

  .intro-card {
    h2 {
      margin: 0 0 8px;
    }

    p {
      margin: 0;
      color: #64748b;
    }
  }

  .filter-card {
    background: linear-gradient(135deg, #fff, #f8fafc);

    :deep(.el-card__body) {
      display: grid;
      gap: 14px;
    }
  }

  .filter-head {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    strong {
      color: #0f172a;
    }

    p {
      margin: 4px 0 0;
      color: #64748b;
    }
  }

  .filter-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    :deep(.el-radio-button__inner) {
      border-left: var(--el-border);
      border-radius: 999px;
    }
  }

  .task-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 14px;
  }

  .task-head {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .task-card {
    position: relative;
    overflow: hidden;

    &::before {
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      content: '';
      background: #cbd5e1;
    }

    h3 {
      margin: 12px 0 8px;
      line-height: 1.45;
      color: #0f172a;
    }

    p {
      margin: 0;
      color: #64748b;
    }
  }

  .source-common::before {
    background: var(--el-color-success);
  }

  .source-board::before {
    background: var(--el-color-info);
  }

  .source-hospital::before {
    background: var(--el-color-primary);
  }

  .source-manager::before {
    background: var(--el-color-warning);
  }

  .task-card.is-target {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
  }

  .task-card.is-overdue {
    background: #fff7f7;
  }

  .assessment-card {
    background: linear-gradient(180deg, #fff, #f8fafc);
  }

  .meta-list {
    display: grid;
    gap: 7px;
    padding: 10px 0 2px;

    p {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 8px;
      line-height: 1.55;
    }

    span {
      color: #94a3b8;
    }
  }

  .evidence-box {
    display: grid;
    gap: 10px;
    padding: 12px;
    margin-top: 14px;
    background: #f8fafc;
    border-radius: 10px;
  }

  .evidence-title,
  .evidence-actions,
  .attachment-item {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  .evidence-title {
    font-weight: 600;
    color: #0f172a;
  }

  .evidence-tip {
    flex: 1;
    font-size: 12px;
    color: #94a3b8;
  }

  .attachment-list {
    display: grid;
    gap: 8px;
  }

  .attachment-item {
    padding: 8px 10px;
    color: #475569;
    background: #fff;
    border-radius: 8px;
  }

  .card-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
  }

  .status-hint {
    font-size: 13px;
    color: #64748b;
  }

  .empty-card {
    padding: 36px 0;
    margin-top: 12px;
    background: #fff;
    border-radius: 12px;
  }

  .is-elderly-friendly {
    font-size: 17px;

    :deep(.el-button) {
      min-height: 42px;
      font-size: 16px;
    }
  }

  @media (width <= 768px) {
    .filter-head {
      align-items: flex-start;
    }

    .task-grid {
      grid-template-columns: 1fr;
    }

    .card-actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
