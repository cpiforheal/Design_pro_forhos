import { AppRouteRecord } from '@/types/router'

export const assessmentRoutes: AppRouteRecord = {
  name: 'Assessment',
  path: '/assessment',
  component: '/index/index',
  redirect: '/assessment/workbench',
  meta: {
    title: '考核平台',
    icon: 'ri:hospital-line',
    roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
  },
  children: [
    {
      path: 'workbench',
      name: 'AssessmentWorkbench',
      component: '/assessment/workbench',
      meta: {
        title: '考核工作台',
        icon: 'ri:dashboard-3-line',
        fixedTab: true,
        roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
      }
    },
    {
      path: 'common',
      name: 'AssessmentCommon',
      component: '/assessment/common',
      meta: {
        title: '全员通用',
        icon: 'ri:team-line',
        roles: ['R_SUPER', 'R_MANAGER']
      }
    },
    {
      path: 'board',
      name: 'AssessmentBoard',
      component: '/assessment/board',
      meta: {
        title: '板块考核',
        icon: 'ri:node-tree',
        roles: ['R_SUPER', 'R_MANAGER']
      }
    },
    {
      path: 'tasks',
      name: 'AssessmentTasks',
      component: '/assessment/tasks',
      meta: {
        title: '本周任务',
        icon: 'ri:task-line',
        roles: ['R_SUPER', 'R_MANAGER']
      }
    },
    {
      path: 'rectification',
      name: 'AssessmentRectification',
      component: '/assessment/rectification',
      meta: {
        title: '整改台账',
        icon: 'ri:alert-line',
        roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
      }
    },
    {
      path: 'summary',
      name: 'AssessmentSummary',
      component: '/assessment/summary',
      meta: {
        title: '汇总看板',
        icon: 'ri:bar-chart-box-line',
        roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
      }
    }
  ]
}
