/**
 * 通用 EmailJS 寄信工具（瀏覽器端）。
 * 敏感信（邀請、忘記密碼）請改走 `@/utils/emailServer`。
 */

import { DEFAULT_ACCOUNT_PASSWORD, getSiteUrl } from '@/utils/accountDefaults';

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_4cq55em';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_r6jbq0k';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'Oxm7lO3VyhQ4vxUTW';

const DEFAULT_SITE_NAME = '高中學習資源教育網 2.0';

export type EmailDetailRow = {
  label: string;
  value: string;
};

export type SendAppEmailOptions = {
  toEmail: string;
  subject: string;
  title: string;
  intro?: string;
  details?: EmailDetailRow[];
  note?: string;
  buttonText?: string;
  buttonUrl?: string;
  brandName?: string;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphsHtml(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
}

function detailsHtml(rows: EmailDetailRow[]): string {
  if (!rows.length) return '';
  const rowsMarkup = rows
    .map(
      (row) => `
          <div class="row">
            <div class="label">${escapeHtml(row.label)}</div>
            <div class="value">${escapeHtml(row.value)}</div>
          </div>`
    )
    .join('');
  return `<div class="card">${rowsMarkup}\n        </div>`;
}

export function buildEmailTemplateParams(options: SendAppEmailOptions): Record<string, string> {
  const brandName = options.brandName || DEFAULT_SITE_NAME;
  const siteUrl = getSiteUrl();
  const buttonUrl = options.buttonUrl || siteUrl;
  const buttonText = options.buttonText || `前往 ${DEFAULT_SITE_NAME}`;
  const showButton = Boolean(options.buttonText || options.buttonUrl);

  return {
    to_email: options.toEmail,
    subject: options.subject,
    title: options.title,
    brand_name: brandName,
    intro_html: options.intro ? paragraphsHtml(options.intro) : '',
    details_html: options.details ? detailsHtml(options.details) : '',
    note_html: options.note ? `<p class="note">${escapeHtml(options.note)}</p>` : '',
    button_html: showButton
      ? `<p style="text-align:center; margin: 20px 0 8px;">
          <a class="btn" href="${escapeHtml(buttonUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(buttonText)}</a>
        </p>`
      : '',
    site_url: siteUrl,
  };
}

export async function sendAppEmail(options: SendAppEmailOptions): Promise<void> {
  const emailjs = (await import('@emailjs/browser')).default;
  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    buildEmailTemplateParams(options),
    EMAILJS_PUBLIC_KEY
  );
}

/** 依序寄送；回傳成功／失敗數（單封失敗不中斷） */
export async function sendAppEmails(
  list: SendAppEmailOptions[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const item of list) {
    try {
      await sendAppEmail(item);
      sent += 1;
    } catch (err) {
      console.warn('EmailJS send failed:', err);
      failed += 1;
    }
  }
  return { sent, failed };
}

export function buildCourseAnnouncementEmail(input: {
  toEmail: string;
  studentName?: string;
  courseName: string;
  courseCode?: string;
  announcementTitle: string;
  contentPreview: string;
  buttonUrl: string;
}): SendAppEmailOptions {
  const greeting = input.studentName ? `親愛的 ${input.studentName} 您好：` : '親愛的同學您好：';
  return {
    toEmail: input.toEmail,
    subject: `課程公告-${input.courseName}-${input.announcementTitle}`,
    title: '課程公告通知',
    intro: `${greeting}\n老師剛發布了一則課程公告，摘要如下：`,
    details: [
      { label: '課程', value: input.courseCode ? `${input.courseName}（${input.courseCode}）` : input.courseName },
      { label: '標題', value: input.announcementTitle },
      ...(input.contentPreview
        ? [{ label: '摘要', value: input.contentPreview.slice(0, 160) + (input.contentPreview.length > 160 ? '…' : '') }]
        : []),
    ],
    note: '請登入系統查看完整公告內容。',
    buttonText: '查看課程公告',
    buttonUrl: input.buttonUrl,
  };
}

export function buildTutoringStudentNotifyEmail(input: {
  toEmail: string;
  name: string;
  studentId: string;
  topic: string;
  time: string;
  teacher: string;
  mode: string;
  format: string;
}): SendAppEmailOptions {
  return {
    toEmail: input.toEmail,
    subject: `輔導預約成功通知-${input.topic}`,
    title: '輔導預約成功通知',
    intro: '親愛的同學您好：\n您已成功完成本次輔導預約，以下為您的預約資訊：',
    details: [
      { label: '姓名', value: input.name },
      { label: '學號', value: input.studentId },
      { label: '主題', value: input.topic },
      { label: '預約時段', value: input.time },
      { label: '老師', value: input.teacher },
      { label: '輔導模式', value: input.mode },
      { label: '輔導形式', value: input.format },
    ],
    note: '如需取消或調整輔導預約，請點擊下方按鈕並登入系統操作。',
    buttonText: `前往 ${DEFAULT_SITE_NAME}`,
    buttonUrl: getSiteUrl(),
  };
}

export function buildTutoringTeacherNotifyEmail(input: {
  toEmail: string;
  teacherName?: string;
  studentName: string;
  studentId: string;
  topic: string;
  time: string;
  mode: string;
  format: string;
  problemDescription?: string;
}): SendAppEmailOptions {
  const greeting = input.teacherName ? `親愛的 ${input.teacherName} 老師您好：` : '親愛的老師您好：';
  return {
    toEmail: input.toEmail,
    subject: `輔導預約提醒-${input.topic}`,
    title: '輔導預約提醒（老師）',
    intro: `${greeting}\n有一位學生完成輔導預約，資訊如下：`,
    details: [
      { label: '學生', value: input.studentName },
      { label: '學號', value: input.studentId },
      { label: '主題', value: input.topic },
      { label: '預約時段', value: input.time },
      { label: '輔導模式', value: input.mode },
      { label: '輔導形式', value: input.format },
      ...(input.problemDescription
        ? [{ label: '問題描述', value: input.problemDescription.slice(0, 200) }]
        : []),
    ],
    note: '請登入後台查看完整預約名單。',
    buttonText: '前往後台',
    buttonUrl: `${getSiteUrl()}/back-panel`,
  };
}

export function buildTeacherInviteEmail(input: {
  toEmail: string;
  name: string;
  inviteUrl: string;
}): SendAppEmailOptions {
  return {
    toEmail: input.toEmail,
    subject: '教師帳號邀請開通',
    title: '教師帳號邀請',
    intro: `親愛的 ${input.name} 您好：\n管理員已邀請您開通「${DEFAULT_SITE_NAME}」帳號，請點擊下方按鈕設定您的登入帳號名稱。`,
    details: [
      { label: '收件信箱', value: input.toEmail },
      { label: '預設密碼', value: DEFAULT_ACCOUNT_PASSWORD },
    ],
    note: `開通成功後請使用您自訂的帳號與預設密碼「${DEFAULT_ACCOUNT_PASSWORD}」登入，並儘速至後台修改密碼。邀請連結有時效限制。`,
    buttonText: '設定帳號並開通',
    buttonUrl: input.inviteUrl,
  };
}

export function buildPasswordResetEmail(input: {
  toEmail: string;
  name?: string;
  account: string;
  resetUrl: string;
  userLabel: string;
}): SendAppEmailOptions {
  const greeting = input.name ? `親愛的 ${input.name} 您好：` : '您好：';
  return {
    toEmail: input.toEmail,
    subject: `重設密碼通知-${input.userLabel}`,
    title: '重設密碼',
    intro: `${greeting}\n我們收到您的重設密碼請求。請點擊下方按鈕設定新密碼（連結有時效限制）。`,
    details: [
      { label: '帳號', value: input.account },
      { label: '身分', value: input.userLabel },
    ],
    note: '若您並未提出此請求，請忽略本郵件，密碼將維持不變。',
    buttonText: '重設密碼',
    buttonUrl: input.resetUrl,
  };
}

export function buildEmailVerificationEmail(input: {
  toEmail: string;
  name?: string;
  account: string;
  verifyUrl: string;
}): SendAppEmailOptions {
  const greeting = input.name ? `親愛的 ${input.name} 您好：` : '您好：';
  return {
    toEmail: input.toEmail,
    subject: '請驗證您的電子郵件',
    title: '驗證電子郵件',
    intro: `${greeting}\n感謝您註冊「${DEFAULT_SITE_NAME}」。請點擊下方按鈕完成信箱驗證（連結有時效限制）。`,
    details: [
      { label: '帳號', value: input.account },
      { label: '信箱', value: input.toEmail },
    ],
    note: '若您並未註冊本站，請忽略本郵件。',
    buttonText: '驗證信箱',
    buttonUrl: input.verifyUrl,
  };
}
