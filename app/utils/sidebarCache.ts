import type { ReactElement } from 'react';

export interface SidebarCachedUserInfo {
  id: string;
  name: string;
  account?: string;
  studentId?: string;
  role: string | string[];
  currentRole?: string;
}

export interface SidebarCachedMenuItem {
  id: string;
  title: string;
  icon?: ReactElement;
  disabled?: boolean;
  href?: string;
}

let cachedUserInfo: SidebarCachedUserInfo | null = null;
let cachedMenuItems: SidebarCachedMenuItem[] = [];
let cachedActiveTab: string | null | undefined = undefined;

export function getCachedUserInfo(): SidebarCachedUserInfo | null {
  return cachedUserInfo;
}

export function setCachedUserInfo(info: SidebarCachedUserInfo | null): void {
  cachedUserInfo = info;
}

export function getCachedMenuItems(): SidebarCachedMenuItem[] {
  return cachedMenuItems;
}

export function setCachedMenuItems(items: SidebarCachedMenuItem[]): void {
  cachedMenuItems = items;
}

export function getCachedActiveTab(): string | null | undefined {
  return cachedActiveTab;
}

export function setCachedActiveTab(tab: string | null | undefined): void {
  cachedActiveTab = tab;
}

/** 清除 Sidebar / 手機選單的跨頁快取，避免登出或切換身分後殘留舊資料 */
export function clearSidebarCache(): void {
  cachedUserInfo = null;
  cachedMenuItems = [];
  cachedActiveTab = undefined;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('sidebar_user_info');
    } catch {
      // ignore
    }
  }
}
