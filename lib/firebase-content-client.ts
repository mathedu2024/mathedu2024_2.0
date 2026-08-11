'use client';

/** 公告／考試日期／部落格前端讀取：固定使用主站 core Firebase */
export { db as contentDb } from './firebase-client';

export function isContentClientSeparated(): boolean {
  return false;
}
