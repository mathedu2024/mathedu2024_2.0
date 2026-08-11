import Swal from '@/utils/swalTheme';
import {
  clearExamDraft,
  canStartExamTake,
  type ExamStartCheckResult,
} from '@/utils/examDraftStorage';

export type ExamTakeBlockedAlertResult = 'dismissed' | 'discarded-draft' | 'retry-allowed';

export async function showExamTakeBlockedAlert(
  check: ExamStartCheckResult,
  options?: {
    blockingTitle?: string;
    studentId?: string;
    targetQuizCode?: string;
  }
): Promise<ExamTakeBlockedAlertResult> {
  if (check.allowed) return 'retry-allowed';

  const title =
    check.blockType === 'active-session' ? '已有進行中的測驗' : '無法開啟測驗';

  const lines = [check.reason ?? '目前無法開啟此測驗，請稍後再試。'];
  if (options?.blockingTitle) {
    lines.push(`相關測驗：${options.blockingTitle}`);
  } else if (check.blockingQuizCode) {
    lines.push(`測驗代碼：${check.blockingQuizCode}`);
  }

  const canDiscardDraft =
    check.blockType === 'draft' &&
    !!options?.studentId &&
    !!check.blockingQuizCode;

  const result = await Swal.fire({
    icon: 'warning',
    title,
    html: lines.map((line) => `<p class="text-sm leading-relaxed">${line}</p>`).join(''),
    showCancelButton: canDiscardDraft,
    confirmButtonColor: '#2D6DF6',
    cancelButtonColor: '#9ca3af',
    confirmButtonText: canDiscardDraft ? '放棄暫存並繼續' : '我知道了',
    cancelButtonText: '取消',
  });

  if (!canDiscardDraft || !result.isConfirmed) {
    return 'dismissed';
  }

  clearExamDraft(check.blockingQuizCode!, options!.studentId!);

  if (options?.targetQuizCode) {
    const retry = canStartExamTake(options.studentId!, options.targetQuizCode);
    if (retry.allowed) return 'retry-allowed';
  }

  return 'discarded-draft';
}
