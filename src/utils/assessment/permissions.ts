import { boards, defaultEmployeeBoardId } from '@/data/assessmentData'
import type { Board, BoardId, Role, RoleId } from '@/types/assessment'

export function canViewBoard(role: Role, boardId: BoardId, employeeBoardId?: BoardId): boolean {
  if (role.scope === 'super') {
    return true
  }

  if (role.scope === 'all') {
    return boardId !== 'allStaff'
  }

  if (role.scope === 'board') {
    return role.boardIds.includes(boardId)
  }

  const resolvedEmployeeBoardId = employeeBoardId ?? defaultEmployeeBoardId
  return boardId === 'allStaff' || boardId === resolvedEmployeeBoardId
}

export function getVisibleBoards(role: Role, employeeBoardId?: BoardId): Board[] {
  return boards.filter((board) => canViewBoard(role, board.id, employeeBoardId))
}

export function getRoleById(roles: Role[], roleId: RoleId): Role {
  return roles.find((role) => role.id === roleId) ?? roles[0]
}

export function getBoardById(boardId: BoardId): Board {
  return boards.find((board) => board.id === boardId) ?? boards[0]
}

export function resolveBoardOwner(boardId: BoardId): string {
  return getBoardById(boardId).owner
}

export function getDefaultBoardId(role: Role, employeeBoardId?: BoardId): BoardId {
  if (role.scope === 'super') {
    return role.defaultBoardId
  }

  if (role.scope === 'employee') {
    return employeeBoardId ?? defaultEmployeeBoardId
  }

  const visibleBoards = getVisibleBoards(role, employeeBoardId)
  return visibleBoards[0]?.id ?? role.defaultBoardId
}

export function getPermissionSummary(role: Role, employeeBoardId?: BoardId): string {
  const visibleBoards = getVisibleBoards(role, employeeBoardId)

  if (role.scope === 'super') {
    return '当前身份为超级管理员：可维护员工、权限、考核周期、模板和全部考核数据。'
  }

  if (role.scope === 'employee') {
    const employeeBoard = visibleBoards.find((board) => board.id !== 'allStaff')
    return `当前身份可查看：全员通用考核 + ${employeeBoard?.name ?? '所属板块'}。`
  }

  return `当前身份可查看：${visibleBoards.map((board) => board.name).join('、')}。`
}
