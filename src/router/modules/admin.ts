import { AppRouteRecord } from '@/types/router'

export const adminRoutes: AppRouteRecord = {
  name: 'AssessmentAdmin',
  path: '/assessment-admin',
  component: '/index/index',
  redirect: '/assessment-admin/employees',
  meta: {
    title: '系统管理',
    icon: 'ri:settings-3-line',
    menuPermission: 'employee-view',
    roles: ['R_SUPER']
  },
  children: [
    {
      path: 'employees',
      name: 'AssessmentEmployees',
      component: '/assessment/admin/employees',
      meta: {
        title: '员工管理',
        icon: 'ri:contacts-book-2-line',
        menuPermission: 'employee-view',
        roles: ['R_SUPER']
      }
    },
    {
      path: 'login-logs',
      name: 'AssessmentLoginLogs',
      component: '/assessment/admin/login-logs',
      meta: {
        title: '账号日志',
        icon: 'ri:file-list-3-line',
        menuPermission: 'employee-view',
        roles: ['R_SUPER']
      }
    },
    {
      path: 'new-user',
      name: 'AssessmentNewUser',
      component: '/assessment/admin/new-user',
      meta: {
        title: '新增用户',
        icon: 'ri:user-add-line',
        menuPermission: 'employee-add',
        roles: ['R_SUPER']
      }
    },
    {
      path: 'permissions',
      name: 'AssessmentPermissionAssign',
      component: '/assessment/admin/permissions',
      meta: {
        title: '权限分配',
        icon: 'ri:shield-user-line',
        menuPermission: 'permission-assign',
        roles: ['R_SUPER']
      }
    },
    {
      path: 'organization',
      name: 'AssessmentOrganization',
      component: '/assessment/admin/organization',
      meta: {
        title: '组织责任配置',
        icon: 'ri:organization-chart',
        menuPermission: 'organization-config',
        roles: ['R_SUPER']
      }
    },
    {
      path: 'staffing',
      name: 'AssessmentStaffing',
      component: '/assessment/admin/staffing',
      meta: {
        title: '定编定岗',
        icon: 'ri:team-line',
        menuPermission: 'organization-config',
        roles: ['R_SUPER']
      }
    },
    {
      path: 'cycles',
      name: 'AssessmentCycleTemplate',
      component: '/assessment/admin/cycles',
      meta: {
        title: '周期模板',
        icon: 'ri:calendar-check-line',
        menuPermission: 'cycle-template',
        roles: ['R_SUPER']
      }
    }
  ]
}
