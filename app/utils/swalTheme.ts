import SwalLib from 'sweetalert2';

/** Tailwind 對應色 — 單一按鈕一律 indigo-600 */
export const SWAL_COLORS = {
  confirm: '#4f46e5',
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
