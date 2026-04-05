import Swal from 'sweetalert2';

const alerts = {
  showSuccess: (title: string, text?: string) => {
    Swal.fire({
      icon: 'success',
      title,
      text,
      timer: 1500,
      showConfirmButton: false
    });
  },
  showError: (title: string, text?: string) => {
    Swal.fire({
      icon: 'error',
      title,
      text
    });
  },
  showWarning: (title: string, text?: string) => {
    Swal.fire({
      icon: 'warning',
      title,
      text
    });
  },
  confirm: async (title: string, text?: string): Promise<boolean> => {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: '確定',
      cancelButtonText: '取消'
    });
    return result.isConfirmed;
  }
};

export default alerts;