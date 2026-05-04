<template>
  <div class="assessment-page">
    <el-card class="intro-card">
      <h2>整改台账</h2>
      <p>未完成考核项自动汇入整改台账，负责人审核后跟进整改销号。</p>
    </el-card>
    <el-card>
      <el-table :data="rectificationItems" border stripe row-key="id" empty-text="当前暂无整改项">
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column prop="boardName" label="板块" width="220" />
        <el-table-column prop="description" label="存在主要问题" min-width="260" />
        <el-table-column
          prop="causeAnalysis"
          label="原因分析"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="supportNeeded"
          label="不懂不会/需支持"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column prop="responsibleName" label="整改责任人" width="140" />
        <el-table-column prop="supervisorName" label="督办负责人" width="140" />
        <el-table-column prop="rectification" label="整改措施" min-width="240" />
        <el-table-column prop="deadline" label="整改时限" width="160" />
        <el-table-column prop="updatedAt" label="更新时间" width="170" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag
              :type="
                row.status === '已销号' ? 'success' : row.status === '待整改' ? 'danger' : 'warning'
              "
              >{{ row.status }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              :disabled="row.status === '已销号'"
              @click="openEditDialog(row)"
              >编辑</el-button
            >
            <el-button
              size="small"
              type="primary"
              :disabled="row.status === '已销号'"
              @click="closeRectification(row.id)"
              >销号</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="editDialogVisible" title="维护整改闭环" width="720px">
      <el-form label-width="130px">
        <el-form-item label="存在主要问题">
          <el-input v-model="editForm.description" disabled type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="原因分析">
          <el-input
            v-model="editForm.causeAnalysis"
            type="textarea"
            :rows="3"
            placeholder="说明问题产生原因"
          />
        </el-form-item>
        <el-form-item label="不懂不会/需支持">
          <el-input
            v-model="editForm.supportNeeded"
            type="textarea"
            :rows="2"
            placeholder="需要培训、协调或资源支持时填写"
          />
        </el-form-item>
        <el-form-item label="整改措施">
          <el-input
            v-model="editForm.rectification"
            type="textarea"
            :rows="3"
            placeholder="填写可检查、可销号的整改措施"
          />
        </el-form-item>
        <el-form-item label="整改责任人">
          <el-select
            v-model="editForm.responsibleUserId"
            filterable
            clearable
            placeholder="默认整改人"
          >
            <el-option
              v-for="employee in hospitalEmployees"
              :key="employee.id"
              :label="employee.name"
              :value="Number(employee.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="督办负责人">
          <el-select
            v-model="editForm.supervisorUserId"
            filterable
            clearable
            placeholder="默认当前负责人"
          >
            <el-option
              v-for="employee in hospitalEmployees"
              :key="employee.id"
              :label="employee.name"
              :value="Number(employee.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="整改时限">
          <el-date-picker
            v-model="editForm.deadline"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择整改截止日期"
          />
        </el-form-item>
        <el-form-item label="整改状态">
          <el-select v-model="editForm.status">
            <el-option label="待整改" value="待整改" />
            <el-option label="整改中" value="整改中" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRectificationEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'
  import type { RectificationItem, RectificationUpdatePayload } from '@/types/assessment'

  const { rectificationItems, hospitalEmployees, closeRectification, updateRectification } =
    useAssessmentPlatform()

  const editDialogVisible = ref(false)
  const editingId = ref<string | number>('')
  const editForm = reactive<
    RectificationUpdatePayload & {
      description: string
    }
  >({
    description: '',
    causeAnalysis: '',
    supportNeeded: '',
    rectification: '',
    responsibleUserId: undefined,
    supervisorUserId: undefined,
    deadline: '',
    status: '整改中'
  })

  function openEditDialog(row: RectificationItem) {
    editingId.value = row.id
    Object.assign(editForm, {
      description: row.description,
      causeAnalysis: row.causeAnalysis || '',
      supportNeeded: row.supportNeeded || '',
      rectification: row.rectification || '',
      responsibleUserId: row.responsibleUserId,
      supervisorUserId: row.supervisorUserId,
      deadline: row.deadline || '',
      status: row.status === '待整改' ? '待整改' : '整改中'
    })
    editDialogVisible.value = true
  }

  async function saveRectificationEdit() {
    if (!editingId.value) return
    await updateRectification(editingId.value, {
      causeAnalysis: editForm.causeAnalysis,
      supportNeeded: editForm.supportNeeded,
      rectification: editForm.rectification,
      responsibleUserId: editForm.responsibleUserId ?? null,
      supervisorUserId: editForm.supervisorUserId ?? null,
      deadline: editForm.deadline,
      status: editForm.status
    })
    editDialogVisible.value = false
  }
</script>

<style scoped>
  .assessment-page {
    padding: 4px;
  }

  .intro-card {
    margin-bottom: 16px;
    border-radius: 16px;
  }

  .intro-card h2 {
    margin: 0 0 8px;
  }

  .intro-card p {
    margin: 0;
    color: #64748b;
  }
</style>
