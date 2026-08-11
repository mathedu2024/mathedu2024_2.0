import {
  buildEmailTemplateParams,
  type SendAppEmailOptions,
} from '@/utils/email';

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_4cq55em';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_r6jbq0k';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'Oxm7lO3VyhQ4vxUTW';
/** EmailJS Account → API Keys → Private Key（伺服器寄信必填） */
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || '';

/**
 * 伺服器端寄信（邀請、忘記密碼等）。
 * 需在 EmailJS Security 開啟 non-browser API，並設定 EMAILJS_PRIVATE_KEY。
 */
export async function sendAppEmailServer(options: SendAppEmailOptions): Promise<void> {
  if (!EMAILJS_PRIVATE_KEY) {
    throw new Error(
      '缺少 EMAILJS_PRIVATE_KEY。請到 EmailJS → Account → API Keys 複製 Private Key，寫入 .env.local 後重啟伺服器。'
    );
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: buildEmailTemplateParams(options),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error(
        `EmailJS 401：Public/Private Key 不正確或未啟用。請到 https://dashboard.emailjs.com/admin/account/security 確認已勾選 non-browser API，並核對 EMAILJS_PRIVATE_KEY。詳情：${text.slice(0, 120)}`
      );
    }
    if (res.status === 403) {
      throw new Error(
        `EmailJS 403：請到 https://dashboard.emailjs.com/admin/account/security 勾選「Allow EmailJS API for non-browser applications」。詳情：${text.slice(0, 120)}`
      );
    }
    throw new Error(`EmailJS server send failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
