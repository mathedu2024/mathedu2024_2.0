import Swal, { SWAL_COLORS } from './swalTheme';

const alerts = {
  showSuccess: (title: string, text?: string) => {
    Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonColor: SWAL_COLORS.confirm,
    });
  },
  showError: (title: string, text?: string) => {
    Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonColor: SWAL_COLORS.confirm,
    });
  },
  showWarning: (title: string, text?: string) => {
    Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonColor: SWAL_COLORS.confirm,
    });
  },
  confirm: async (title: string, text?: string): Promise<boolean> => {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: SWAL_COLORS.confirm,
      cancelButtonColor: SWAL_COLORS.cancel,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
    });
    return result.isConfirmed;
  },
};

export default alerts;
