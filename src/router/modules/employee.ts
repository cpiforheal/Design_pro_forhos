import { AppRouteRecord } from '@/types/router'

export const employeeRoutes: AppRouteRecord = {
  name: 'EmployeeAssessmentCenter',
  path: '/employee-assessment',
  component: '/index/index',
  redirect: '/employee-assessment/my',
  meta: {
    title: '员工端',
    icon: 'ri:user-heart-line',
    roles: ['R_EMPLOYEE']
  },
  children: [
    {
      path: 'my',
      name: 'EmployeeMyAssessment',
      component: '/assessment/my/index',
      meta: {
        title: '我的考核',
        icon: 'ri:home-smile-line',
        fixedTab: true,
        roles: ['R_EMPLOYEE']
      }
    },
    {
      path: 'tasks',
      name: 'EmployeeMyTasks',
      component: '/assessment/my/tasks',
      meta: {
        title: '我的任务',
        icon: 'ri:task-line',
        roles: ['R_EMPLOYEE']
      }
    },
    {
      path: 'rectification',
      name: 'EmployeeMyRectification',
      component: '/assessment/my/rectification',
      meta: {
        title: '我的整改',
        icon: 'ri:alert-line',
        roles: ['R_EMPLOYEE']
      }
    },
    {
      path: 'result',
      name: 'EmployeeMyResult',
      component: '/assessment/my/result',
      meta: {
        title: '我的结果',
        icon: 'ri:medal-line',
        roles: ['R_EMPLOYEE']
      }
    }
  ]
}
