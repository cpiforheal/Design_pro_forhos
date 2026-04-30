import type { Role, RoleId } from '@/types/assessment'

export interface AssessmentMenuPolicy {
  roleId: RoleId
  landingPath: string
  visibleRouteNames: string[]
  hiddenRouteNames: string[]
  description: string
}

const EMPLOYEE_VISIBLE_ROUTES = ['AssessmentWorkbench', 'AssessmentCommon', 'AssessmentBoard', 'AssessmentTasks', 'AssessmentRectification']
const MANAGER_VISIBLE_ROUTES = ['AssessmentWorkbench', 'AssessmentCommon', 'AssessmentBoard', 'AssessmentTasks', 'AssessmentRectification', 'AssessmentSummary']
const LEADER_VISIBLE_ROUTES = ['AssessmentWorkbench', 'AssessmentRectification', 'AssessmentSummary']

export function getAssessmentMenuPolicy(role: Role): AssessmentMenuPolicy {
  if (role.scope === 'employee') {
    return {
      roleId: role.id,
      landingPath: '/assessment/workbench',
      visibleRouteNames: EMPLOYEE_VISIBLE_ROUTES,
      hiddenRouteNames: ['AssessmentSummary'],
      description: '普通员工优先进入个人考核工作台，只保留待办、任务、整改等必要入口，减少操作负担。'
    }
  }

  if (role.scope === 'board') {
    return {
      roleId: role.id,
      landingPath: '/assessment/workbench',
      visibleRouteNames: MANAGER_VISIBLE_ROUTES,
      hiddenRouteNames: [],
      description: '板块负责人可处理本板块考核、任务、整改和汇总，但仍以工作台为默认入口。'
    }
  }

  return {
    roleId: role.id,
    landingPath: '/assessment/workbench',
    visibleRouteNames: LEADER_VISIBLE_ROUTES,
    hiddenRouteNames: ['AssessmentCommon', 'AssessmentBoard', 'AssessmentTasks'],
    description: '院领导优先查看汇总、风险和整改结果，减少细项填报入口干扰。'
  }
}

export function shouldShowAssessmentRoute(role: Role, routeName: string): boolean {
  return getAssessmentMenuPolicy(role).visibleRouteNames.includes(routeName)
}
