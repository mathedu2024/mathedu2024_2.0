import { redirect } from 'next/navigation';

/**
 * 舊管理登入入口：統一導向 /login
 * 保留 ?role= 以預選老師／管理員／作者
 */
export default async function PanelLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  const roleRaw = params.role;
  const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
  if (role) {
    qs.set('role', role);
  } else {
    qs.set('role', 'teacher');
  }

  const nextRaw = params.next;
  const next = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
  if (next) qs.set('next', next);

  const q = qs.toString();
  redirect(q ? `/login?${q}` : '/login?role=teacher');
}
