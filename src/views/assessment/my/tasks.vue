<template>
  <div
    class="employee-simple-page"
    :class="{ 'is-elderly-friendly': currentEmployee.elderlyFriendly }"
  >
    <ElCard class="intro-card" shadow="never">
      <h2>我的任务</h2>
      <p
        >新推送的任务默认是未完成。处理完后点击“标记为已完成”，逾期任务需要负责人延期后才能提交。</p
      >
    </ElCard>

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

    <div class="task-grid">
      <ElCard
        v-for="task in currentTasks"
        :id="`task-${task.id}`"
        :key="task.id"
        class="task-card"
        :class="{ 'is-target': route.query.taskId === task.id, 'is-overdue': task.overdueLocked }"
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
        <p>责任人：{{ task.owner }}</p>
        <p>截止时间：{{ task.deadlineAt || task.deadline }}</p>
        <p v-if="task.taskCategory">任务分类：{{ task.taskCategory }}</p>
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
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import type { UploadRequestOptions } from 'element-plus'
  import type { AssessmentStatus, TaskItem, TaskRecordDraft } from '@/types/assessment'

  const route = useRoute()
  const {
    currentEmployee,
    currentTasks,
    hospitalTaskDrafts,
    boardTaskDrafts,
    loading,
    toggleTask,
    persistTask,
    uploadTaskAttachment,
    removeTaskAttachment,
    downloadTaskAttachment,
    updateTaskDraftField,
    getStatusLabel
  } = useAssessmentPlatform()
  const overdueTasks = computed(() => currentTasks.value.filter((task) => task.overdueLocked))
  const pendingTasks = computed(() =>
    currentTasks.value.filter((task) => resolveStatus(task) === 'pending')
  )

  watch(
    () => route.query.taskId,
    async (taskId) => {
      if (!taskId) return
      await nextTick()
      document
        .getElementById(`task-${taskId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    { immediate: true }
  )

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
  .task-card {
    border: 0;
    border-radius: 12px;
  }

  .intro-card,
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

  .task-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }

  .task-head {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }

  .task-card {
    h3 {
      margin: 12px 0 8px;
      color: #0f172a;
    }

    p {
      color: #64748b;
    }
  }

  .task-card.is-target {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
  }

  .task-card.is-overdue {
    background: #fff7f7;
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

  .is-elderly-friendly {
    font-size: 17px;

    :deep(.el-button) {
      min-height: 42px;
      font-size: 16px;
    }
  }

  @media (width <= 768px) {
    .card-actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
