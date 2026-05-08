<template>
  <div class="staffing-page">
    <ElCard>
      <template #header>
        <div>
          <h3 class="m-0 text-lg font-medium">定编定岗</h3>
          <p class="mt-1 mb-0 text-sm text-gray-500">
            对齐领导文档中的三级架构、六大中心和刚需岗位，作为后续责任归属与考核落地的基础台账。
          </p>
        </div>
      </template>

      <ElAlert
        class="staffing-alert"
        type="info"
        show-icon
        :closable="false"
        title="最小收敛原则：一级决策层 3 人、二级执行层 6 大中心、三级一线刚需岗位；岗位在哪里、隶属哪里、归谁直管、由谁考核。"
      />

      <ElDescriptions class="staffing-rules" :column="3" border size="small">
        <ElDescriptionsItem label="管理铁律">一人多职、垂直管理、归口负责</ElDescriptionsItem>
        <ElDescriptionsItem label="运行闭环">日常常态化管理 + 每周重点攻坚</ElDescriptionsItem>
        <ElDescriptionsItem label="考核绑定">周二考核、整改销号、绩效挂钩</ElDescriptionsItem>
      </ElDescriptions>

      <ElRow class="summary-row" :gutter="16">
        <ElCol :span="6"><ElStatistic title="架构条目" :value="staffingRows.length" /></ElCol>
        <ElCol :span="6"><ElStatistic title="启用条目" :value="enabledCount" /></ElCol>
        <ElCol :span="6"
          ><ElStatistic title="固定编制" :value="fixedHeadcount" suffix=" 人"
        /></ElCol>
        <ElCol :span="6"><ElStatistic title="刚需岗位" :value="demandRows" suffix=" 项" /></ElCol>
      </ElRow>

      <ElTable v-loading="loading" :data="staffingRows" border row-key="id">
        <ElTableColumn prop="level" label="层级" width="190" show-overflow-tooltip />
        <ElTableColumn label="岗位/部门" min-width="190">
          <template #default="{ row }">
            <ElInput v-model="row.positionName" size="small" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="编制" width="90">
          <template #default="{ row }">
            <ElInputNumber v-model="row.headcount" :min="0" :max="99" size="small" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="核心归属" min-width="160">
          <template #default="{ row }">
            <ElInput v-model="row.coreOwner" size="small" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="对口领导" min-width="150">
          <template #default="{ row }">
            <ElInput v-model="row.reportingLeader" size="small" placeholder="无则留空" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="兼任职务" min-width="220">
          <template #default="{ row }">
            <ElInput v-model="row.concurrentRoles" size="small" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="核心职责" min-width="320">
          <template #default="{ row }">
            <ElInput
              v-model="row.responsibilities"
              size="small"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="直管一线岗位" min-width="280">
          <template #default="{ row }">
            <ElInput
              v-model="row.directPositions"
              size="small"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElSwitch v-model="row.enabled" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <ElButton type="primary" link @click="saveRow(row)">保存</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { fetchStaffingPositions, updateStaffingPosition } from '@/api/assessment-admin'
  import type { StaffingPosition } from '@/types/assessment'

  const loading = ref(false)
  const staffingRows = ref<StaffingPosition[]>([])

  const enabledCount = computed(() => staffingRows.value.filter((item) => item.enabled).length)
  const fixedHeadcount = computed(() =>
    staffingRows.value.reduce((total, item) => total + Number(item.headcount || 0), 0)
  )
  const demandRows = computed(
    () =>
      staffingRows.value.filter(
        (item) => item.level.includes('三级') || Number(item.headcount || 0) === 0
      ).length
  )

  onMounted(loadRows)

  async function loadRows() {
    loading.value = true
    try {
      staffingRows.value = await fetchStaffingPositions()
    } finally {
      loading.value = false
    }
  }

  async function saveRow(row: StaffingPosition) {
    staffingRows.value = await updateStaffingPosition(row.id, {
      level: row.level,
      positionName: row.positionName,
      headcount: row.headcount,
      coreOwner: row.coreOwner,
      reportingLeader: row.reportingLeader,
      concurrentRoles: row.concurrentRoles,
      responsibilities: row.responsibilities,
      directPositions: row.directPositions,
      boardId: row.boardId,
      enabled: row.enabled,
      sortOrder: row.sortOrder
    })
  }
</script>

<style scoped>
  .staffing-page {
    display: grid;
    gap: 16px;
  }

  .staffing-alert,
  .staffing-rules,
  .summary-row {
    margin-bottom: 16px;
  }
</style>
