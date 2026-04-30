<template>
  <AssessmentTablePage
    title="全员通用考核"
    subtitle="覆盖全院员工的基础工作、纪律规范、服务质量和安全红线。"
    :items="commonAssessmentItems"
    :drafts="commonDrafts"
    scope="common"
    @toggle="toggleAssessment"
    @save="persistAssessment"
    @update-draft="updateAssessmentDraftField"
  />
</template>

<script setup lang="ts">
import AssessmentTablePage from '../components/AssessmentTablePage.vue'
import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

const {
  commonAssessmentItems,
  commonDrafts,
  toggleAssessment,
  persistAssessment,
  updateAssessmentDraftField
} = useAssessmentPlatform()
</script>


