// 基礎用戶介面
export interface BaseUser {
  // 基本資訊
  account: string;           // 登入帳號（唯一）
  password: string;          // 密碼（實際應用中應加密）
  name: string;              // 顯示名稱
  role: 'admin' | 'teacher' | 'student';  // 用戶角色
  
  // 聯絡資訊
  email?: string;            // 電子郵件
  phone?: string;            // 電話號碼
  
  // 時間戳記
  createdAt: string;         // 建立時間 (ISO 8601)
  updatedAt: string;         // 更新時間 (ISO 8601)
  
  // 狀態
  isActive: boolean;         // 帳號是否啟用
  lastLoginAt?: string;      // 最後登入時間
}

// 管理員專用欄位
export interface AdminUser extends BaseUser {
  role: 'admin';
  permissions?: string[];    // 特殊權限列表
  note?: string;            // 備註
}

// 教師專用欄位
export interface TeacherUser extends BaseUser {
  role: 'teacher';
  courses?: string[];        // 授課課程列表 ["課程名稱(課程代碼)"]
  subjects?: string[];       // 專長科目
  introduction?: string;     // 教師介紹
  avatarURL?: string;        // 頭像圖片網址
  experience?: string;       // 教學經驗
  education?: string;        // 學歷背景
}

// 學生專用欄位
export interface StudentUser extends BaseUser {
  role: 'student';
  studentId: string;         // 學號
  grade: string;            // 年級 (高一、高二、高三)
  class: string;            // 班級 (1年1班)
  enrolledCourses?: string[]; // 已選課程列表 ["課程名稱(課程代碼)"]
  parentName?: string;       // 家長姓名
  parentPhone?: string;      // 家長電話
  emergencyContact?: string; // 緊急聯絡人
}

// 聯合類型
export type User = AdminUser | TeacherUser | StudentUser;

// 測試管理員帳號
export const TEST_ADMIN: AdminUser = {
  account: 'admin',
  password: 'admin123',
  name: '系統管理員',
  role: 'admin',
  email: 'admin@school.edu.tw',
  phone: '0912345678',
  isActive: true,
  permissions: ['user_management', 'course_management', 'system_settings'],
  note: '主要系統管理員',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

// Session timeout in milliseconds (30 minutes)
export const SESSION_TIMEOUT = 30 * 60 * 1000; 