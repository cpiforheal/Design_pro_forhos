<template>
  <div>
    <el-card class="board-select">
      <el-form inline label-width="90px">
        <el-form-item label="当前板块">
          <el-select v-model="selectedBoardId" style="width: 320px">
            <el-option v-for="board in visibleBoards" :key="board.id" :label="board.name" :value="board.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-tag>{{ currentBoard.owner }}</el-tag>
        </el-form-item>
      </el-form>
      <p>{{ currentBoard.description }}</p>
    </el-card>
    <AssessmentTablePage
      title="板块专项考核"
      :subtitle="currentBoard.description"
      :items="currentBoardItems"
      :drafts="boardDrafts"
      scope="board"
      @toggle="toggleAssessment"
      @save="persistAssessment"
      @update-draft="updateAssessmentDraftField"
    />
  </div>
</template>

<script setup lang="ts">
import AssessmentTablePage from '../components/AssessmentTablePage.vue'
import { useAssessmentPlatform } from '@/composables/useAssessmentPlatform'

const {
  selectedBoardId,
  visibleBoards,
  currentBoard,
  currentBoardItems,
  boardDrafts,
  toggleAssessment,
  persistAssessment,
  updateAssessmentDraftField
} = useAssessmentPlatform()
</script>

<style scoped>
.board-select { margin-bottom: 16px; border-radius: 16px; }
.board-select p { margin: 0; color: #64748b; }
</style>


