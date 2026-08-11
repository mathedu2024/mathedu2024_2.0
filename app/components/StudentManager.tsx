'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import MultiSelectDropdown from './MultiSelectDropdown';
import LoadingSpinner from './LoadingSpinner';
import PageLoadingArea from './ui/PageLoadingArea';
import { btnStyles, btnWithIconStyle, btnIcon, btnIconGap, tableActionStyles, tableActionRow } from './ui';
import { courseListTableStyles } from './studentCourseListShared';
import Dropdown from './ui/Dropdown';
import Swal from 'sweetalert2';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  UserIcon, 
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  XMarkIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { isCourseArchived } from './StudentCourseSelector';
import {
  fetchAdminCoursesList,
  fetchStudentList,
  invalidateStudentList,
} from '@/utils/teacherClientApi';
import {
  removeCoursesFromEnrolledList,
  resolveCoursesFromCatalog,
  enrolledKeyMatchesCourse,
} from '@/services/courseId';

interface Student {
  id: string; // Document ID: studentId
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  grade: string;
  account: string;
  email: string;
  phone: string;
  address: string;
  remarks: string;
  enrolledCourses: string[];
}

interface Course extends MinimalCourse {
  id: string;
  name: string;
  code: string;
}

interface MinimalCourse {
  name: string;
  code: string;
  status?: string;
  archived?: boolean | string;
}

interface ImportStudentPayload {
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  grade: string;
  account: string;
  email: string;
  phone: string;
  address: string;
  remarks: string;
  enrolledCourses: string[];
  password: string;
}

export default function StudentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchGrade, setBatchGrade] = useState<string>('不變更');
  const [batchCourses, setBatchCourses] = useState<string[]>([]);
  const [batchRemoveCourses, setBatchRemoveCourses] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<{ studentId?: string; email?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];

  const isDisplayableCourse = useCallback((course: Course | null | undefined): course is Course => {
    if (!course) return false;
    const name = String(course.name ?? '').trim();
    const code = String(course.code ?? '').trim();
    if (!name || !code) return false;
    const isPlaceholder = (value: string) => /^(undefined|null)$/i.test(value);
    return !isPlaceholder(name) && !isPlaceholder(code);
  }, []);

  const activeCourses = useMemo(
    () => courses.filter((c) => isDisplayableCourse(c) && !isCourseArchived(c)),
    [courses, isDisplayableCourse]
  );

  const resolveCatalogCourse = useCallback(
    (enrolledKey: string): Course | null => {
      if (!enrolledKey?.trim()) return null;
      const course = courses.find((c) => enrolledKeyMatchesCourse(enrolledKey, c)) ?? null;
      return isDisplayableCourse(course) ? course : null;
    },
    [courses, isDisplayableCourse]
  );

  const countKnownCourses = useCallback(
    (enrolledKeys: string[] = []) =>
      enrolledKeys.filter((key) => !!resolveCatalogCourse(key)).length,
    [resolveCatalogCourse]
  );

  const activeCourseSelectOptions = useMemo(
    () =>
      [...activeCourses]
        .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' }))
        .map((course) => ({
          label: `${course.name} (${course.code})`,
          value: course.id,
        })),
    [activeCourses]
  );

  const fetchStudents = useCallback(async (options?: { bypassCache?: boolean }) => {
    if (options?.bypassCache) invalidateStudentList();
    setLoading(true);
    try {
      const fetchedStudents = await fetchStudentList<Student>();
      setStudents(Array.isArray(fetchedStudents) ? fetchedStudents : []);
    } catch (error) {
      console.error("從資料庫獲取學生資料失敗:", error);
      Swal.fire('錯誤', '讀取學生資料時發生錯誤！', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const coursesRaw = await fetchAdminCoursesList();
        const courses = (Array.isArray(coursesRaw) ? coursesRaw : [])
          .map((c: MinimalCourse & { id?: string }) => ({
            ...c,
            id: c.id || `${c.name}(${c.code})`
          }))
          .filter((c: Course) => {
            const name = String(c.name ?? '').trim();
            const code = String(c.code ?? '').trim();
            if (!name || !code) return false;
            return !/^(undefined|null)$/i.test(name) && !/^(undefined|null)$/i.test(code);
          });
        setCourses(courses);
      } catch (error) {
        console.error("從資料庫獲取課程失敗:", error);
      }
    };

    fetchCourses();
    fetchStudents();
  }, [fetchStudents]);

  const handleStudentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const studentId = e.target.value;
    // 學號不可為中文或標點符號
    const invalidId = /[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\p{P}\p{S}]/u.test(studentId);
    setFormErrors(prev => ({ ...prev, studentId: invalidId ? '學號不可包含中文或標點符號' : undefined }));
    setEditingStudent(prev => prev ? { ...prev, studentId, account: studentId } : null);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    // 基本 email 格式檢查
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setFormErrors(prev => ({ ...prev, email: email && !valid ? '電子郵件格式錯誤' : undefined }));
    setEditingStudent(prev => prev ? { ...prev, email } : null);
  };
  
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    // 檢查學號
    if (!editingStudent.studentId || !editingStudent.name) {
        Swal.fire('警告', '學號和姓名是必填欄位！', 'warning');
        return;
    }
    // 檢查學號不可為中文或標點符號
    if (/[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\p{P}\p{S}]/u.test(editingStudent.studentId)) {
      setFormErrors(prev => ({ ...prev, studentId: '學號不可包含中文或標點符號' }));
      return;
    }
    // 檢查學號是否重複
    const isDuplicate = students.some(s => s.studentId === editingStudent.studentId && s.id !== editingStudent.id);
    if (isDuplicate) {
      setFormErrors(prev => ({ ...prev, studentId: '此學號已被使用' }));
      Swal.fire('警告', '此學號已被使用，請更換學號！', 'warning');
      return;
    }
    // 檢查 email 格式
    if (editingStudent.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingStudent.email)) {
      setFormErrors(prev => ({ ...prev, email: '電子郵件格式錯誤' }));
      return;
    }
    setFormErrors({});
    setLoading(true);

    try {
      const { studentId, name } = editingStudent;
      const docId = studentId; // 只用學號作為文件名稱
      
      const studentData: Omit<Student, 'id'> & { password?: string } = {
        studentId: editingStudent.studentId,
        name: editingStudent.name,
        gender: editingStudent.gender,
        grade: editingStudent.grade,
        account: editingStudent.account,
        email: editingStudent.email,
        phone: editingStudent.phone,
        address: editingStudent.address,
        remarks: editingStudent.remarks,
        enrolledCourses: (editingStudent.enrolledCourses || []).filter(
          (key) => !!resolveCatalogCourse(key)
        ),
      };

      if (!editingStudent.id) { // Only set password for new students
        studentData.password = 'abcd1234';
      }

      const originalStudent = students.find(s => s.id === docId);
      const oldCourses = originalStudent?.enrolledCourses || [];
      const newCourses = (editingStudent.enrolledCourses || []).filter(
        (key) => !!resolveCatalogCourse(key)
      );

      const syncedCourses = await updateStudentCourses(docId, oldCourses, newCourses, {
        id: editingStudent.studentId,
        name: editingStudent.name,
        account: editingStudent.account,
        email: editingStudent.email,
        studentId: editingStudent.studentId,
        grade: editingStudent.grade,
      });

      await fetch('/api/student/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, ...studentData, enrolledCourses: syncedCourses }),
      });
      
      Swal.fire({
        icon: 'success',
        title: '成功',
        text: `學生 "${name}" 的資料已成功儲存！`,
        confirmButtonColor: '#4f46e5'
      });
      setIsEditing(false);
      setEditingStudent(null);
      fetchStudents({ bypassCache: true }); // Re-fetch students to update the list
    } catch (error) {
      console.error("儲存學生資料失敗:", error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: '儲存學生資料時發生錯誤！',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingStudent(null);
    setIsEditing(false);
  };

  const handleDelete = async (studentToDelete: Student) => {
    const result = await Swal.fire({
      title: '請確認',
      text: `確定要刪除學生 ${studentToDelete.name} 的資料嗎？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        await fetch('/api/student/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: studentToDelete.id }),
        });
        // 從課程中移除學生
        if (studentToDelete.enrolledCourses && studentToDelete.enrolledCourses.length > 0) {
          await updateStudentCourses(studentToDelete.id, studentToDelete.enrolledCourses, []);
        }
        Swal.fire({
            icon: 'success',
            title: '已刪除!',
            text: '學生資料已成功刪除。',
            confirmButtonColor: '#4f46e5'
        });
        fetchStudents({ bypassCache: true }); // Re-fetch
      } catch (error) {
        console.error("刪除學生資料失敗:", error);
        Swal.fire({
            icon: 'error',
            title: '錯誤',
            text: '刪除學生資料時發生錯誤！',
            confirmButtonColor: '#ef4444'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (id: string) => {
    const result = await Swal.fire({
      title: '請確認',
      text: '確定要將密碼復原為預設密碼嗎？',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#4f46e5',
    });

    if (!result.isConfirmed) {
      return;
    }
    await fetch('/api/student/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    Swal.fire({
        icon: 'success',
        title: '成功',
        text: '密碼已復原為預設值',
        confirmButtonColor: '#4f46e5'
    });
  };

  const filteredStudents = students.filter(student => {
    const name = student.name || '';
    const account = student.account || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  useEffect(() => {
    const currentIds = new Set(students.map((s) => s.id));
    setSelectedStudentIds((prev) => prev.filter((id) => currentIds.has(id)));
  }, [students]);

  const isAllFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every((student) => selectedStudentIds.includes(student.id));

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredStudents.map((s) => s.id));
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
      return;
    }
    const merged = new Set([...selectedStudentIds, ...filteredStudents.map((s) => s.id)]);
    setSelectedStudentIds(Array.from(merged));
  };

  const handleBatchUpdate = async () => {
    if (selectedStudentIds.length === 0) {
      Swal.fire('提示', '請先勾選要批次修改的學生。', 'info');
      return;
    }
    if (batchGrade === '不變更' && batchCourses.length === 0 && batchRemoveCourses.length === 0) {
      Swal.fire('提示', '請至少設定要更新的年級、加入課程或移除課程。', 'info');
      return;
    }

    const result = await Swal.fire({
      title: '確認批次修改',
      html: `
        <div style="text-align:left;line-height:1.8">
          <div>選取學生數：<b>${selectedStudentIds.length}</b></div>
          <div>調整年級：<b>${batchGrade === '不變更' ? '不變更' : batchGrade}</b></div>
          <div>加入課程數：<b>${batchCourses.length}</b></div>
          <div>移除課程數：<b>${batchRemoveCourses.length}</b></div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確認執行',
      cancelButtonText: '取消',
      confirmButtonColor: '#4f46e5',
    });
    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      let updatedCount = 0;
      
      // --- 以前端 Promise.all 方式呼叫單筆儲存 API 取代 bulk-update API，避免後端 500 錯誤 ---
      const syncPromises = selectedStudentIds.map(async (studentId) => {
        const originalStudent = students.find(s => s.id === studentId);
        if (originalStudent) {
          const oldCourses = originalStudent.enrolledCourses || [];
          let newCourses = [...oldCourses];
          if (batchCourses.length > 0) {
            newCourses = Array.from(new Set([...newCourses, ...batchCourses]));
          }
          if (batchRemoveCourses.length > 0) {
            const coursesToRemove = resolveCoursesFromCatalog(batchRemoveCourses, courses);
            newCourses = removeCoursesFromEnrolledList(newCourses, coursesToRemove);
          }
          const finalGrade = batchGrade === '不變更' ? originalStudent.grade : batchGrade;

          const syncedCourses = await updateStudentCourses(studentId, oldCourses, newCourses, {
            id: originalStudent.studentId,
            name: originalStudent.name,
            account: originalStudent.account,
            email: originalStudent.email,
            studentId: originalStudent.studentId,
            grade: finalGrade,
          });

          const updatedStudentData = {
            ...originalStudent,
            grade: finalGrade,
            enrolledCourses: syncedCourses,
          };

          const res = await fetch('/api/student/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedStudentData),
          });

          if (res.ok) {
            updatedCount++;
          }
        }
      });
      await Promise.all(syncPromises);

      Swal.fire({
        icon: 'success',
        title: '批次修改完成',
        html: `
          <div style="text-align:left;line-height:1.8">
            <div>成功更新學生：<b>${updatedCount}</b> 筆</div>
            <div>更新年級：<b>${batchGrade !== '不變更' ? '是' : '否'}</b></div>
            <div>加入課程：<b>${batchCourses.length}</b> 堂</div>
            <div>移除課程：<b>${batchRemoveCourses.length}</b> 堂</div>
          </div>
        `,
        confirmButtonColor: '#4f46e5',
      });
      setSelectedStudentIds([]);
      setBatchGrade('不變更');
      setBatchCourses([]);
      setBatchRemoveCourses([]);
      fetchStudents({ bypassCache: true });
    } catch (error) {
      console.error('批次修改失敗:', error);
      Swal.fire('錯誤', '批次修改失敗，請稍後再試。', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateStudentCourses = async (
    studentDocId: string,
    oldCourses: string[],
    newCourses: string[],
    studentInfo?: Record<string, unknown>
  ): Promise<string[]> => {
    const res = await fetch('/api/course-student-list/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: studentDocId, oldCourses, newCourses, studentInfo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '課程同步失敗');
    }
    const data = await res.json();
    return data.enrolledCourses || newCourses;
  };

  // --- Excel 模板下載功能 ---
  const handleDownloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const templateData = Array.from({ length: 50 }, (_, index) => {
      if (index === 0) {
        return {
          '學號': '112001',
          '姓名': '王小明',
          '性別': '男',
          '年級': '高一',
          '電子郵件': 'example@mail.com',
          '電話': '0912345678',
          '地址': '台北市... (選填)',
          '備註': '範例資料 (請刪除此列)'
        };
      }
      return {
        '學號': '',
        '姓名': '',
        '性別': '',
        '年級': '',
        '電子郵件': '',
        '電話': '',
        '地址': '',
        '備註': ''
      };
    });
    
    // 1. 建立活頁簿與工作表
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('學生匯入模板');

    // 2. 定義欄位與標題 (設定 key 以便對應資料)
    worksheet.columns = Object.keys(templateData[0]).map(key => ({
      header: key,
      key: key,
      width: 20
    }));

    // 3. 填入範例資料
    worksheet.addRows(templateData);

    // 加上填寫說明
    worksheet.addRow([]);
    const titleRow = worksheet.addRow(['【填寫說明】(請在匯入前將本說明與上方範例列刪除)']);
    titleRow.font = { bold: true, color: { argb: 'FFFF0000' } }; // 紅色粗體字
    worksheet.mergeCells(`A${titleRow.number}:H${titleRow.number}`);

    const instructions = [
      '1. 學號、姓名、性別、年級為必填欄位。',
      '2. 性別請務必填寫「男」或「女」（不可填寫男生、女生等）。',
      '3. 年級請填寫：國一、國二、國三、高一、高二、高三、職一、職二、職三、大一、進修。',
      '4. 匯入前請確保學號未與檔案內其他資料或系統中現有學生重複。'
    ];
    instructions.forEach(text => {
      const row = worksheet.addRow([text]);
      row.font = { color: { argb: 'FF555555' } }; // 深灰色字體
      worksheet.mergeCells(`A${row.number}:H${row.number}`);
    });

    // 4. 生成 Buffer 並觸發瀏覽器下載
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '學生資料匯入模板.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  // --- Excel 檔案讀取與大量上傳功能 ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const processExcelFile = async (file: File) => {
    // exceljs 不支援舊版的 .xls 或其他格式，需在此攔截以避免解析錯誤
    if (!file.name.match(/\.xlsx$/i)) {
      Swal.fire('格式錯誤', '僅支援 .xlsx 格式的 Excel 檔案，請將檔案「另存新檔」為 .xlsx 格式後再試。', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        
        const ExcelJS = (await import('exceljs')).default;
        // 1. 載入 Excel 檔案
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.getWorksheet(1); // 取得第一個工作表
        if (!worksheet) throw new Error('讀取不到工作表內容');

        const data: (Record<string, string | number> & { _rowNum: number })[] = [];
        const headers: string[] = [];
        
        // 2. 獲取標題列 (第一列) 用於欄位對應
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber] = cell.text.trim();
        });

        // 3. 遍歷資料列 (從第二列開始)
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return; // 跳過標題
          const rowObject: Record<string, string | number> = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber];
            if (header) rowObject[header] = cell.text.trim();
          });
          
          const studentId = String(rowObject['學號'] || '').trim();
          const name = String(rowObject['姓名'] || '').trim();
          const gender = String(rowObject['性別'] || '').trim();
          const grade = String(rowObject['年級'] || '').trim();

          // 略過說明列或全空列
          if (studentId.includes('【填寫說明】') || studentId.match(/^\d+\./)) return;
          if (!studentId && !name && !gender && !grade) return;

          data.push({ ...rowObject, _rowNum: rowNumber });
        });

        if (data.length === 0) {
          Swal.fire('提示', 'Excel 檔案中沒有有效資料', 'info');
          return;
        }

        const importRows: ImportStudentPayload[] = [];
        const parseErrors: string[] = [];
        const excelStudentIds = new Set<string>();

        for (const row of data) {
          const rowNum = row._rowNum;
          const studentId = String(row['學號'] || '').trim();
          const name = String(row['姓名'] || '').trim();
          const rawGender = String(row['性別'] || '').trim();
          const rawGrade = String(row['年級'] || '').trim();
          
          if (!studentId || !name || !rawGender || !rawGrade) {
            parseErrors.push(`第 ${rowNum} 列：學號、姓名、性別、年級為必填欄位。`);
            continue;
          }

          if (/[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\p{P}\p{S}]/u.test(studentId)) {
            parseErrors.push(`第 ${rowNum} 列：學號格式錯誤（不可包含中文或標點符號）。`);
            continue;
          }

          if (rawGender !== '男' && rawGender !== '女') {
            parseErrors.push(`第 ${rowNum} 列：性別必須填寫「男」或「女」。`);
            continue;
          }

          if (!grades.includes(rawGrade)) {
            parseErrors.push(`第 ${rowNum} 列：年級「${rawGrade}」不符合系統設定。`);
            continue;
          }

          if (excelStudentIds.has(studentId)) {
            parseErrors.push(`第 ${rowNum} 列：檔案內學號重複（${studentId}）。`);
            continue;
          }
          excelStudentIds.add(studentId);

          if (students.some(s => s.studentId === studentId)) {
            parseErrors.push(`第 ${rowNum} 列：系統中已存在相同學號的學生（${studentId}）。`);
            continue;
          }

          // 性別轉換
          const genderMap: { [key: string]: 'male' | 'female' } = { '男': 'male', '女': 'female' };
          const gender = genderMap[rawGender] || 'male';

          // 組合存檔資料
          const studentData: ImportStudentPayload = {
            studentId: studentId,
            name: name,
            gender: gender,
            grade: rawGrade,
            account: studentId,
            email: String(row['電子郵件'] || '').trim(),
            phone: String(row['電話'] || ''),
            address: String(row['地址'] || '').trim(),
            remarks: String(row['備註'] || '').trim(),
            enrolledCourses: [],
            password: 'abcd1234' // 預設密碼
          };
          importRows.push(studentData);
        }

        if (parseErrors.length > 0) {
          Swal.fire({
            icon: 'error',
            title: '匯入失敗',
            html: `
              <div style="text-align:left; max-height: 250px; overflow-y: auto;">
                <p class="mb-2 font-bold text-red-600">請修正以下錯誤後再重新匯入（整批資料尚未建立）：</p>
                <ul style="list-style-type: decimal; padding-left: 20px; font-size: 0.9em; line-height: 1.5;">
                  ${parseErrors.map(err => `<li>${err}</li>`).join('')}
                </ul>
              </div>
            `,
            confirmButtonColor: '#ef4444',
          });
          return;
        }

        if (importRows.length === 0) {
          Swal.fire('提示', '沒有可匯入的有效資料，請檢查 Excel 內容。', 'info');
          return;
        }

        const res = await fetch('/api/student/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: importRows }),
        });
        if (!res.ok) {
          throw new Error(`批次匯入失敗（${res.status}）`);
        }
        const result = await res.json();

        Swal.fire({
          icon: 'success',
          title: '匯入完成',
          html: `
            <div style="text-align:left;line-height:1.8">
              <div>成功新增：<b>${result.createdCount}</b> 筆</div>
            </div>
          `,
          confirmButtonColor: '#4f46e5',
        });

        setIsImportModalOpen(false);
        fetchStudents({ bypassCache: true });
      } catch (error) {
        console.error("讀取 Excel 失敗:", error);
        Swal.fire('錯誤', '解析檔案時發生錯誤，請確認檔案格式是否正確。', 'error');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // 清除 input
      }
    };
    
    reader.onerror = () => {
      Swal.fire('錯誤', '檔案讀取失敗', 'error');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file); // exceljs 使用 ArrayBuffer 讀取
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processExcelFile(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isExistingStudent = Boolean(editingStudent?.id?.trim());
  const lockedFieldClass =
    'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed font-mono';

  return (
    <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <UserGroupIcon className="h-8 w-8 text-indigo-600" />
            學生資料管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理學生資訊與註冊狀態</p>
        </div>
      </div>

      {!isEditing && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 flex-shrink-0 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 px-4 py-3 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row flex-1 min-w-0 gap-3 md:gap-4">
              <div className="relative flex-1 min-w-0">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="搜尋學生姓名或帳號..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
              </div>
              <div className="w-full sm:w-44 md:w-48 shrink-0">
                <Dropdown
                  value={selectedGrade}
                  onChange={setSelectedGrade}
                  options={[{ value: 'all', label: '全部年級' }, ...grades.map((g) => ({ value: g, label: g }))]}
                  placeholder="全部年級"
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className={btnStyles.secondary}
              >
                下載模板
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className={btnStyles.secondary}
              >
                匯入 Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => {
                setEditingStudent({
                  id: '',
                  studentId: '',
                  name: '',
                  gender: 'male',
                  grade: '高一',
                  account: '',
                  email: '',
                  phone: '',
                  address: '',
                  remarks: '',
                  enrolledCourses: []
                });
                setIsEditing(true);
              }}
                className={btnWithIconStyle(btnStyles.primary)}
              >
                <PlusIcon className={`${btnIcon} ${btnIconGap}`} />
                新增學生
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 px-4 py-3">
            <div className="text-sm text-gray-600 font-medium shrink-0 whitespace-nowrap">
              已選取 <span className="text-indigo-600 font-bold">{selectedStudentIds.length}</span> 位學生
            </div>
            <div className="w-full lg:w-40 shrink-0">
              <Dropdown
                value={batchGrade}
                onChange={setBatchGrade}
                options={[{ value: '不變更', label: '年級不變更' }, ...grades.map((g) => ({ value: g, label: `改為 ${g}` }))]}
                placeholder="年級變更"
                className="w-full"
              />
            </div>
            <div className="w-full lg:flex-1 min-w-0">
              <MultiSelectDropdown
                options={activeCourseSelectOptions}
                selectedOptions={batchCourses}
                onChange={setBatchCourses}
                placeholder="加入課程..."
                className="w-full"
              />
            </div>
            <div className="w-full lg:flex-1 min-w-0">
              <MultiSelectDropdown
                options={activeCourseSelectOptions}
                selectedOptions={batchRemoveCourses}
                onChange={setBatchRemoveCourses}
                placeholder="移除課程..."
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={handleBatchUpdate}
              disabled={loading || selectedStudentIds.length === 0 || (batchGrade === '不變更' && batchCourses.length === 0 && batchRemoveCourses.length === 0)}
              className={`${btnStyles.primary} w-full lg:w-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              批次修改
            </button>
          </div>
        </div>
      )}

      {/* 新增／編輯學生彈出視窗 — ui-sample Modal Style */}
      {isEditing && editingStudent && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden transform scale-100 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                {editingStudent.id ? '編輯學生資料' : '新增學生資料'}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="text-white/80 hover:text-white"
                aria-label="關閉"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <form
              id="student-editor-form"
              onSubmit={handleAddStudent}
              className="p-6 overflow-y-auto flex-1 custom-scrollbar"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">學號 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingStudent.studentId}
                    onChange={isExistingStudent ? undefined : handleStudentIdChange}
                    className={isExistingStudent ? lockedFieldClass : 'w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono'}
                    required
                    readOnly={isExistingStudent}
                    disabled={isExistingStudent}
                    placeholder={isExistingStudent ? '' : '請輸入學號'}
                  />
                  {formErrors.studentId && <div className="text-red-500 text-xs mt-1">{formErrors.studentId}</div>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">帳號 {isExistingStudent ? '' : '(自動帶入)'}</label>
                  <input
                    type="text"
                    value={editingStudent.account}
                    readOnly
                    disabled
                    className={lockedFieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">姓名 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={editingStudent.name}
                      onChange={(e) => setEditingStudent(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                      placeholder="請輸入姓名"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">性別 <span className="text-red-500">*</span></label>
                  <Dropdown
                    value={editingStudent.gender}
                    onChange={(value) => setEditingStudent(prev => prev ? { ...prev, gender: value as 'male' | 'female' } : null)}
                    options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]}
                    placeholder="選擇性別"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">年級 <span className="text-red-500">*</span></label>
                  <Dropdown
                    value={editingStudent.grade}
                    onChange={(value) => setEditingStudent(prev => prev ? { ...prev, grade: value } : null)}
                    options={grades.map(g => ({ value: g, label: g }))}
                    placeholder="選擇年級"
                    className="w-full"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">選修課程</label>
                  <MultiSelectDropdown
                    options={activeCourseSelectOptions}
                    selectedOptions={
                      editingStudent.enrolledCourses
                        ? [...new Set(
                            editingStudent.enrolledCourses
                              .map((enrolledKey) => resolveCatalogCourse(enrolledKey))
                              .filter((course): course is Course => !!course && !isCourseArchived(course))
                              .map((course) => course.id)
                          )]
                        : []
                    }
                    onChange={(selected) => {
                      const knownEnrolled = (editingStudent.enrolledCourses || []).filter((enrolledKey) => {
                        const course = resolveCatalogCourse(enrolledKey);
                        return !!course && isCourseArchived(course);
                      });
                      setEditingStudent((prev) =>
                        prev ? { ...prev, enrolledCourses: [...knownEnrolled, ...selected] } : null
                      );
                    }}
                    placeholder="選擇學生選修的課程..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">電子郵件</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={editingStudent.email}
                      onChange={handleEmailChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="student@example.com"
                    />
                  </div>
                  {formErrors.email && <div className="text-red-500 text-xs mt-1">{formErrors.email}</div>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">電話</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <PhoneIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      value={editingStudent.phone}
                      onChange={(e) => setEditingStudent(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0912-345-678"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">地址</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPinIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={editingStudent.address}
                      onChange={(e) => setEditingStudent(prev => prev ? { ...prev, address: e.target.value } : null)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="請輸入通訊地址"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">備註</label>
                  <textarea
                    value={editingStudent.remarks}
                    onChange={(e) => setEditingStudent(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="可選填相關備註..."
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                disabled={loading}
              >
                取消
              </button>
              <button
                type="submit"
                form="student-editor-form"
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center justify-center disabled:opacity-70"
                disabled={loading}
              >
                {loading ? <LoadingSpinner size={16} color="white" className="mr-2" /> : null}
                {loading ? '儲存中...' : (editingStudent.id ? '更新資料' : '新增學生')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex-1 min-h-0">
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <PageLoadingArea />
            ) : (
              <>
                {/* Mobile View: Modular Cards */}
                <div className={`${courseListTableStyles.mobile.wrapper} pb-20`}>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <div key={student.id} className={courseListTableStyles.mobile.card}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                              <label className="inline-flex items-center gap-2 mb-2 text-sm text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(student.id)}
                                  onChange={() => toggleStudentSelection(student.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                                />
                                選取此學生
                              </label>
                              <div className={courseListTableStyles.mobile.courseName}>{student.name}</div>
                              <p className={`${courseListTableStyles.mobile.courseCode} bg-gray-100 px-2 py-0.5 rounded inline-block`}>{student.studentId}</p>
                          </div>
                          <span className={`${courseListTableStyles.mobile.statusBadge} ${
                              student.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                          }`}>
                              {student.gender === 'male' ? '男' : '女'}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex justify-between">
                                <span className="text-gray-500">年級:</span>
                                <span className="font-medium text-gray-800">{student.grade}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">課程數:</span>
                                <span className="font-medium text-gray-800">{countKnownCourses(student.enrolledCourses)} 堂</span>
                            </div>
                        </div>
                        
                        <div className={`${tableActionRow} pt-2 border-t border-gray-100`}>
                          <button 
                            onClick={() => handleResetPassword(student.id)} 
                            className={tableActionStyles.warning}
                          >
                            重設密碼
                          </button>
                          <button 
                            onClick={() => handleEdit(student)} 
                            className={tableActionStyles.primary}
                          >
                            編輯
                          </button>
                          <button 
                            onClick={() => handleDelete(student)} 
                            className={tableActionStyles.danger}
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">沒有找到符合條件的學生資料</p>
                    </div>
                  )}
                </div>

                {/* Desktop View: Table */}
                <div className={courseListTableStyles.desktop.wrapper}>
                  <table className={courseListTableStyles.desktop.table}>
                    <thead className={courseListTableStyles.desktop.thead}>
                      <tr>
                        <th scope="col" className={`${courseListTableStyles.desktop.th} w-10 !px-4`}>
                          <input
                            type="checkbox"
                            checked={isAllFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                            title="全選目前篩選結果"
                          />
                        </th>
                        <th scope="col" className={courseListTableStyles.desktop.th}>姓名</th>
                        <th scope="col" className={courseListTableStyles.desktop.th}>學號</th>
                        <th scope="col" className={courseListTableStyles.desktop.th}>年級</th>
                        <th scope="col" className={courseListTableStyles.desktop.th}>性別</th>
                        <th scope="col" className={courseListTableStyles.desktop.th}>課程數</th>
                        <th scope="col" className={`${courseListTableStyles.desktop.th} text-right min-w-[180px]`}>操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.length > 0 ? filteredStudents.map(student => (
                        <tr key={student.id} className={courseListTableStyles.desktop.row}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className={courseListTableStyles.desktop.courseName}>{student.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-gray-600">{student.studentId}</span>
                          </td>
                          <td className="px-6 py-4">
                              <span className={courseListTableStyles.desktop.studentCount}>
                                  {student.grade}
                              </span>
                          </td>
                          <td className="px-6 py-4">
                              <span className={`${courseListTableStyles.desktop.statusBadge} ${
                                  student.gender === 'male' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-pink-50 text-pink-700 border border-pink-200'
                              }`}>
                                  {student.gender === 'male' ? '男' : '女'}
                              </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {countKnownCourses(student.enrolledCourses)}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className={courseListTableStyles.desktop.actionRow}>
                              <button 
                                onClick={() => handleResetPassword(student.id)} 
                                className={courseListTableStyles.desktop.actionWarning}
                              >
                                重設密碼
                              </button>
                              <button 
                                onClick={() => handleEdit(student)} 
                                className={courseListTableStyles.desktop.actionPrimary}
                              >
                                編輯
                              </button>
                              <button 
                                onClick={() => handleDelete(student)} 
                                className={courseListTableStyles.desktop.actionDanger}
                              >
                                刪除
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                            沒有找到符合條件的學生資料
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
      </div>

      {/* Import Excel Modal */}

      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
              <h3 className="text-xl font-bold flex items-center">
                <CloudArrowUpIcon className="w-6 h-6 mr-2" />
                匯入 Excel 檔案
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 bg-white overflow-y-auto flex-1 custom-scrollbar">
            
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudArrowUpIcon className={`w-16 h-16 mx-auto mb-4 ${dragActive ? 'text-indigo-500' : 'text-gray-400'}`} />
              <p className="text-gray-800 font-bold mb-2">點擊選擇檔案，或將檔案拖曳至此處</p>
            <p className="text-gray-500 text-sm mb-6">支援 .xlsx 格式</p>
              <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                瀏覽檔案
              </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}