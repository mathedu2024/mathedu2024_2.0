import SwalLib from 'sweetalert2';

/** Tailwind 對應色 — 確認鈕對齊 Academic Precision primary */
export const SWAL_COLORS = {
  confirm: '#2D6DF6',
  danger: '#ef4444',
  cancel: '#9ca3af',
} as const;

const Swal = SwalLib.mixin({
  confirmButtonColor: SWAL_COLORS.confirm,
  confirmButtonText: '確定',
  showConfirmButton: true,
  customClass: { popup: 'rounded-2xl' },
});

export default Swal;
