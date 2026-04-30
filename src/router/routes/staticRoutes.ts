import { AppRouteRecordRaw } from '@/utils/router'

/**
 * 静态路由配置（不需要权限就能访问的路由）
 */
export const staticRoutes: AppRouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'Login',
    component: () => import('@views/admin/login/index.vue'),
    meta: { title: '后台管理登录', isHideTab: true }
  },
  {
    path: '/auth/login',
    name: 'AuthLogin',
    component: () => import('@views/admin/login/index.vue'),
    meta: { title: '后台管理登录', isHideTab: true }
  },
  {
    path: '/403',
    name: 'Exception403',
    component: () => import('@views/exception/403/index.vue'),
    meta: { title: '403', isHideTab: true }
  },
  {
    path: '/500',
    name: 'Exception500',
    component: () => import('@views/exception/500/index.vue'),
    meta: { title: '500', isHideTab: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'Exception404',
    component: () => import('@views/exception/404/index.vue'),
    meta: { title: '404', isHideTab: true }
  }
]
