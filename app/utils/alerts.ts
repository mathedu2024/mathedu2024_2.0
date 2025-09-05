import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

// 通用配置
const commonConfig = {
	confirmButtonText: '確定',
	confirmButtonColor: '#3B82F6', // 主視覺藍色
	scrollbarPadding: false,
	heightAuto: false,
	allowOutsideClick: false,
	allowEscapeKey: true,
	backdrop: true,
	...Swal.mixin({
		customClass: {
			confirmButton: 'swal2-confirm-blue'
		}
	})
};

export const showSuccess = (message: string, options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'success',
		title: message,
		...commonConfig,
		...options,
	});
};

export const showError = (message: string, options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'error',
		title: '發生錯誤',
		text: message,
		...commonConfig,
		...options,
	});
};

// 類型一：錯誤代號
export const showErrorCode = (errorCode: string, options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'error',
		title: `錯誤${errorCode}`,
		text: '請稍後再試一次或聯絡管理員(電子郵件：mathedu2024.class@gmail.com)',
		...commonConfig,
		...options,
	});
};

// 類型二：密碼輸入錯誤
export const showPasswordError = (options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'error',
		title: '密碼錯誤',
		...commonConfig,
		...options,
	});
};

// 類型三：查無此帳號
export const showAccountNotFound = (options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'error',
		title: '查無此帳號',
		text: '請聯絡管理員(電子郵件：mathedu2024.class@gmail.com)',
		...commonConfig,
		...options,
	});
};

export const showInfo = (message: string, options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'info',
		title: message,
		confirmButtonText: '知道了',
		...commonConfig,
		...options,
	});
};

export const showWarning = (message: string, options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'warning',
		title: message,
		confirmButtonText: '知道了',
		...commonConfig,
		...options,
	});
};

export const confirm = (message: string, options: SweetAlertOptions = {}) => {
	return Swal.fire({
		icon: 'question' as SweetAlertIcon,
		title: message,
		showCancelButton: true,
		confirmButtonText: '確認',
		cancelButtonText: '取消',
		focusCancel: true,
		confirmButtonColor: '#3B82F6',
		cancelButtonColor: '#6B7280',
		scrollbarPadding: false,
		heightAuto: false,
		allowOutsideClick: false,
		allowEscapeKey: true,
		backdrop: true,
		...options,
	}).then(result => result.isConfirmed);
};

export const toast = (message: string, icon: SweetAlertIcon = 'success', options: SweetAlertOptions = {}) => {
	return Swal.fire({
		toast: true,
		position: 'top-end',
		showConfirmButton: false,
		timer: 2000,
		timerProgressBar: true,
		icon,
		title: message,
		...options,
	});
};

const alerts = { 
	showSuccess, 
	showError, 
	showErrorCode, 
	showPasswordError, 
	showAccountNotFound, 
	showInfo, 
	showWarning, 
	confirm, 
	toast 
};

export default alerts;


