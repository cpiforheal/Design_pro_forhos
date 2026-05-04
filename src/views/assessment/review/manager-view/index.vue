<template>
  <div class="manager-view-page">
    <ElCard>
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">负责人视角</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            查看本板块员工进度、电子确认情况；必要时可协助录入，但员工仍需本人电子确认。
          </p>
        </div>
      </template>

      <ElDescriptions :column="2" border>
        <ElDescriptionsItem label="当前板块">{{ currentBoard.name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="当前账号">{{ currentEmployee.name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="员工待办">{{
          employeeAssessmentSnapshot.todoCount
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="紧急事项">{{
          employeeAssessmentSnapshot.urgentTodoCount
        }}</ElDescriptionsItem>
      </ElDescriptions>

      <ElDivider />
      <ElTable :data="performanceResults" border>
        <ElTableColumn prop="employeeName" label="员工" width="140" />
        <ElTableColumn prop="boardName" label="板块" width="150" />
        <ElTableColumn prop="finalScore" label="最终得分" width="100" />
        <ElTableColumn prop="overdueCount" label="逾期任务" width="100" />
        <ElTableColumn prop="rectificationCount" label="未销号整改" width="120" />
        <ElTableColumn label="员工确认" width="120">
          <template #default="{ row }">
            <ElTag :type="row.employeeConfirmedAt ? 'success' : 'warning'">
              {{ row.employeeConfirmedAt ? '已确认' : '未确认' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="负责人确认" width="130">
          <template #default="{ row }">
            <ElTag :type="row.managerConfirmedAt ? 'success' : 'info'">
              {{ row.managerConfirmedAt ? '已确认' : '待确认' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="考核小组复核" width="140">
          <template #default="{ row }">
            <ElTag :type="row.reviewGroupConfirmedAt ? 'success' : 'info'">
              {{ row.reviewGroupConfirmedAt ? '已复核' : '待复核' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="loadAssist(row.userId)">协助录入</ElButton>
            <ElButton
              type="success"
              link
              :disabled="Boolean(row.managerConfirmedAt)"
              @click="managerConfirmPerformanceResult(row.userId)"
            >
              确认
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElCard v-if="assistPayload" class="assist-card">
      <template #header>
        <div class="assist-header">
          <div>
            <strong>协助录入：{{ assistPayload.targetUser.name }}</strong>
            <p>代录会写入审核日志；员工本人未电子确认前，周期不能归档。</p>
          </div>
          <ElButton @click="assistPayload = null">关闭</ElButton>
        </div>
      </template>

      <ElAlert
        class="assist-alert"
        type="warning"
        show-icon
        :closable="false"
        title="协助录入只解决不会填、没时间填的问题，不替代员工最终电子确认。"
      />

      <ElTabs v-model="assistTab">
        <ElTabPane label="考核项" name="assessment">
          <ElTable :data="assistPayload.assessmentItems" border>
            <ElTableColumn prop="title" label="考核内容" min-width="260" show-overflow-tooltip />
            <ElTableColumn prop="moduleName" label="模块" width="150" />
            <ElTableColumn label="状态" width="150">
              <template #default="{ row }">
                <ElSelect v-model="assistAssessmentDrafts[row.id].status" size="small">
                  <ElOption label="已完成" value="completed" />
                  <ElOption label="未完成" value="pending" />
                  <ElOption label="不适用" value="na" />
                </ElSelect>
              </template>
            </ElTableColumn>
            <ElTableColumn label="备注/整改" min-width="240">
              <template #default="{ row }">
                <ElInput
                  v-model="assistAssessmentDrafts[row.id].rectification"
                  size="small"
                  placeholder="未完成时填写整改措施"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <ElButton type="primary" link @click="saveAssistAssessment(row.id)">保存</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane label="任务" name="task">
          <ElTable :data="assistPayload.tasks" border>
            <ElTableColumn prop="title" label="任务内容" min-width="260" show-overflow-tooltip />
            <ElTableColumn prop="deadline" label="截止时间" width="180" />
            <ElTableColumn label="状态" width="150">
              <template #default="{ row }">
                <ElSelect
                  v-model="assistTaskDrafts[row.id].status"
                  size="small"
                  :disabled="row.overdueLocked"
                >
                  <ElOption label="已完成" value="completed" />
                  <ElOption label="未完成" value="pending" />
                  <ElOption label="不适用" value="na" />
                </ElSelect>
              </template>
            </ElTableColumn>
            <ElTableColumn label="备注" min-width="240">
              <template #default="{ row }">
                <ElInput
                  v-model="assistTaskDrafts[row.id].remark"
                  size="small"
                  :disabled="row.overdueLocked"
                  :placeholder="row.overdueLocked ? '已逾期，需负责人先延期' : '填写任务备注'"
                />
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <ElButton
                  type="primary"
                  link
                  :disabled="row.overdueLocked"
                  @click="saveAssistTask(row.id)"
                >
                  保存
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import { fetchAssessmentAssist, saveAssessmentRecord, saveTaskRecord } from '@/api/assessment'
  import type {
    AssessmentAssistPayload,
    AssessmentRecordDraft,
    AssessmentStatus,
    TaskRecordDraft
  } from '@/types/assessment'

  const {
    currentBoard,
    currentEmployee,
    employeeAssessmentSnapshot,
    performanceResults,
    managerConfirmPerformanceResult
  } = useAssessmentPlatform()

  const assistPayload = ref<AssessmentAssistPayload | null>(null)
  const assistTab = ref<'assessment' | 'task'>('assessment')
  const assistAssessmentDrafts = ref<Record<string, AssessmentRecordDraft>>({})
  const assistTaskDrafts = ref<Record<string, TaskRecordDraft>>({})

  async function loadAssist(userId: number) {
    assistPayload.value = await fetchAssessmentAssist(userId)
    assistAssessmentDrafts.value = Object.fromEntries(
      assistPayload.value.assessmentItems.map((item) => [
        item.id,
        assistPayload.value?.assessmentRecords[item.id] ?? createAssessmentDraft()
      ])
    )
    assistTaskDrafts.value = Object.fromEntries(
      assistPayload.value.tasks.map((task) => [
        task.id,
        assistPayload.value?.taskRecords[task.id] ?? createTaskDraft()
      ])
    )
  }

  async function saveAssistAssessment(itemId: string) {
    if (!assistPayload.value?.targetUser.userId) return
    const draft = assistAssessmentDrafts.value[itemId] ?? createAssessmentDraft()
    await saveAssessmentRecord({
      itemId,
      targetUserId: assistPayload.value.targetUser.userId,
      status: draft.status,
      remark: draft.remark,
      rectification: draft.rectification
    })
    await loadAssist(assistPayload.value.targetUser.userId)
    ElMessage.success('已协助保存考核项，并写入日志')
  }

  async function saveAssistTask(taskId: string) {
    if (!assistPayload.value?.targetUser.userId) return
    const draft = assistTaskDrafts.value[taskId] ?? createTaskDraft()
    await saveTaskRecord({
      taskId,
      targetUserId: assistPayload.value.targetUser.userId,
      status: draft.status,
      remark: draft.remark,
      evidenceText: draft.evidenceText
    })
    await loadAssist(assistPayload.value.targetUser.userId)
    ElMessage.success('已协助保存任务，并写入日志')
  }

  function createAssessmentDraft(): AssessmentRecordDraft {
    return {
      status: 'completed' as AssessmentStatus,
      remark: '',
      rectification: '',
      workflowStatus: 'draft'
    }
  }

  function createTaskDraft(): TaskRecordDraft {
    return {
      status: 'pending' as AssessmentStatus,
      remark: '',
      evidenceText: '',
      workflowStatus: 'draft',
      attachments: []
    }
  }
</script>

<style scoped>
  .manager-view-page {
    display: grid;
    gap: 16px;
  }

  .assist-card {
    margin-top: 0;
  }

  .assist-header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }

  .assist-header p {
    margin: 6px 0 0;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .assist-alert {
    margin-bottom: 16px;
  }
</style>
