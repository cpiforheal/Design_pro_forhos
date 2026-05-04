import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateScoreSummary, formatRate } from '../src/utils/assessment/scoring'
import type { AssessmentItem, EvaluationDraft } from '../src/types/assessment'

const baseItems: AssessmentItem[] = [
  {
    id: 'item-1',
    category: '全员通用',
    boardId: 'allStaff',
    moduleName: '日常规范',
    title: '完成晨会',
    standard: '按要求完成晨会'
  },
  {
    id: 'item-2',
    category: '板块专项',
    boardId: 'medical',
    moduleName: '医疗质量',
    title: '完成病历质控',
    standard: '按要求完成病历质控'
  },
  {
    id: 'item-3',
    category: '板块专项',
    boardId: 'medical',
    moduleName: '医疗质量',
    title: '不适用项目',
    standard: '特殊岗位不适用'
  }
]

describe('assessment scoring', () => {
  it('计算完成率、未完成数和最终得分', () => {
    const drafts: Record<string, EvaluationDraft> = {
      'item-1': { status: 'completed', remark: '', rectification: '' },
      'item-2': { status: 'pending', remark: '待补充', rectification: '补齐材料' },
      'item-3': { status: 'na', remark: '', rectification: '' }
    }

    const summary = calculateScoreSummary(baseItems, drafts, false)

    assert.equal(summary.totalApplicable, 2)
    assert.equal(summary.completedCount, 1)
    assert.equal(summary.pendingCount, 1)
    assert.equal(summary.completionRate, 0.5)
    assert.equal(summary.dailyScore, 1)
    assert.equal(summary.redlinePenalty, 0)
    assert.equal(summary.finalScore, 1)
    assert.equal(formatRate(summary.completionRate), '50%')
  })

  it('触发红线时扣减固定分值', () => {
    const drafts: Record<string, EvaluationDraft> = {
      'item-1': { status: 'completed', remark: '', rectification: '' },
      'item-2': { status: 'completed', remark: '', rectification: '' },
      'item-3': { status: 'na', remark: '', rectification: '' }
    }

    const summary = calculateScoreSummary(baseItems, drafts, true)

    assert.equal(summary.dailyScore, 2)
    assert.equal(summary.redlinePenalty, 12)
    assert.equal(summary.finalScore, -10)
  })
})
