import { AppRouteRecord } from '@/types/router'

export const reviewRoutes: AppRouteRecord = {
  name: 'AssessmentReviewCenter',
  path: '/assessment-review',
  component: '/index/index',
  redirect: '/assessment-review/desk',
  meta: {
    title: '审核中心',
    icon: 'ri:file-check-line',
    roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
  },
  children: [
    {
      path: 'desk',
      name: 'AssessmentReviewDesk',
      component: '/assessment/review/desk',
      meta: {
        title: '审核台',
        icon: 'ri:todo-line',
        roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
      }
    },
    {
      path: 'leader-view',
      name: 'AssessmentLeaderView',
      component: '/assessment/review/leader-view',
      meta: {
        title: '领导视角',
        icon: 'ri:bar-chart-grouped-line',
        roles: ['R_SUPER', 'R_LEADER']
      }
    },
    {
      path: 'manager-view',
      name: 'AssessmentManagerView',
      component: '/assessment/review/manager-view',
      meta: {
        title: '负责人视角',
        icon: 'ri:group-line',
        roles: ['R_SUPER', 'R_MANAGER']
      }
    },
    {
      path: 'manager-tasks',
      name: 'AssessmentManagerTasks',
      component: '/assessment/review/manager-tasks',
      meta: {
        title: '分管工作安排',
        icon: 'ri:calendar-check-line',
        roles: ['R_SUPER', 'R_LEADER', 'R_MANAGER']
      }
    }
  ]
}
