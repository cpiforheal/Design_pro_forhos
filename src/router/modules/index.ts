import { AppRouteRecord } from '@/types/router'
import { employeeRoutes } from './employee'
import { assessmentRoutes } from './assessment'
import { reviewRoutes } from './review'
import { adminRoutes } from './admin'

/**
 * 当前系统仅保留医院每周二考核相关菜单。
 * art-design-pro 原示例模块（template/widgets/examples/article/result/safeguard/help 等）已从菜单路由移除。
 */
export const routeModules: AppRouteRecord[] = [
  employeeRoutes,
  assessmentRoutes,
  reviewRoutes,
  adminRoutes
]
