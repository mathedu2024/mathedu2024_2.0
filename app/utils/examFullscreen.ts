/** 測驗全螢幕：盡量貼近 F11 瀏覽器全螢幕，並阻擋以快捷鍵退出 */

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  mozRequestFullScreen?: (options?: FullscreenOptions) => Promise<void>;
  msRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
};

export function isExamDocumentFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function requestExamDocumentFullscreen(): void {
  if (isExamDocumentFullscreen()) return;

  const el = document.documentElement as FullscreenElement;
  const options: FullscreenOptions = { navigationUI: 'hide' };

  const request =
    el.requestFullscreen?.bind(el) ??
    el.webkitRequestFullscreen?.bind(el) ??
    el.mozRequestFullScreen?.bind(el) ??
    el.msRequestFullscreen?.bind(el);

  if (!request) return;
  void request(options).catch(() => {});
}

export function exitExamDocumentFullscreen(): void {
  if (!isExamDocumentFullscreen()) return;

  const doc = document as FullscreenDocument;
  const exit =
    doc.exitFullscreen?.bind(doc) ??
    doc.webkitExitFullscreen?.bind(doc) ??
    doc.mozCancelFullScreen?.bind(doc) ??
    doc.msExitFullscreen?.bind(doc);

  if (!exit) return;
  void exit().catch(() => {});
}

const FS_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
] as const;

function isFullscreenExitKey(event: KeyboardEvent): boolean {
  return event.key === 'F11' || event.key === 'Escape' || event.keyCode === 122;
}

/** 啟用全螢幕並阻擋 F11 / Esc 退出；若仍離開全螢幕則立即重新進入 */
export function attachExamFullscreenGuards(): () => void {
  const keepFullscreen = () => {
    if (!isExamDocumentFullscreen()) {
      requestExamDocumentFullscreen();
    }
  };

  const onFullscreenChange = () => {
    // 瀏覽器常忽略 Esc 的 preventDefault，離開全螢幕後需立刻重新進入
    keepFullscreen();
    queueMicrotask(keepFullscreen);
    requestAnimationFrame(keepFullscreen);
  };

  const blockExitKey = (event: KeyboardEvent) => {
    if (!isFullscreenExitKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    keepFullscreen();
  };

  requestExamDocumentFullscreen();

  for (const eventName of FS_CHANGE_EVENTS) {
    document.addEventListener(eventName, onFullscreenChange);
  }
  document.addEventListener('keydown', blockExitKey, true);
  document.addEventListener('keyup', blockExitKey, true);
  window.addEventListener('keydown', blockExitKey, true);
  window.addEventListener('keyup', blockExitKey, true);

  const interval = window.setInterval(keepFullscreen, 300);

  return () => {
    window.clearInterval(interval);
    for (const eventName of FS_CHANGE_EVENTS) {
      document.removeEventListener(eventName, onFullscreenChange);
    }
    document.removeEventListener('keydown', blockExitKey, true);
    document.removeEventListener('keyup', blockExitKey, true);
    window.removeEventListener('keydown', blockExitKey, true);
    window.removeEventListener('keyup', blockExitKey, true);
    exitExamDocumentFullscreen();
  };
}
