import type { SessionData } from './session';

export type BackPanelRoleLabel = '管理員' | '老師' | '作者' | '學生';

export function getBackPanelRole(session: SessionData): BackPanelRoleLabel {
  if (session.currentRole) {
    if (session.currentRole === 'admin') return '管理員';
    if (session.currentRole === 'teacher') return '老師';
    if (session.currentRole === 'author') return '作者';
  }
  const role = session.role;
  if (Array.isArray(role)) {
    const lower = role.map((r) => String(r).toLowerCase());
    if (lower.includes('admin')) return '管理員';
    if (lower.includes('teacher')) return '老師';
    if (lower.includes('author')) return '作者';
    return '學生';
  }
  const lower = String(role ?? '').toLowerCase();
  if (lower === 'admin') return '管理員';
  if (lower === 'teacher') return '老師';
  if (lower === 'author') return '作者';
  return '學生';
}

export interface BackPanelUserShell {
  id: string;
  name: string;
  account: string;
  role: BackPanelRoleLabel;
}

export function buildBackPanelUserFromSession(session: SessionData): BackPanelUserShell {
  return {
    id: session.id,
    name: session.name || '',
    account: session.account,
    role: getBackPanelRole(session),
  };
}
