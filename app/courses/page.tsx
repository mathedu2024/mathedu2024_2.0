'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Dropdown from '@/components/ui/Dropdown';

interface Course {
  id: string;
  name: string;
  code: string;
  teachingMethod: '實體上課' | '線上上課' | '非同步線上上課' | '實體與線上同步上課';
  teachers: string[] | Record<string, unknown> | Teacher[];
  startDate: string;
  endDate: string;
  status: '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
  gradeTags: string[];
  subjectTag: string;
  courseNature: string;
  showInIntroduction: boolean;
  archived: boolean;
  description?: string;
  coverImageURL?: string;
  location?: string;
  liveStreamURL?: string;
  classTimes?: string[] | Record<string, string>[];
  teacherNamesDisplay?: string;
  gradeTagsDisplay?: string;
}

interface Teacher {
  id: string;
  name: string;
  uid?: string;
  _id?: string;
}

// 優化：將靜態資料移至 Component 外部，避免每次 Render 重複宣告，節省記憶體與運算
const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];
const subjects = ['數學', '理化', '物理', '化學', '生物'];
const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
const statuses = ['未開課', '報名中', '開課中', '已額滿', '已結束'];

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // 篩選器狀態
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedNature, setSelectedNature] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 優化：使用 Promise.all 並行讀取課程與老師資料，大幅縮短等待時間
        const [coursesRes, teachersRes] = await Promise.all([
          fetch('/api/courses/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch('/api/teacher/list')
        ]);

        // 1. 先處理老師資料，建立快速查找表 (Hash Map)
        const teacherMap: Record<string, string> = {};
        if (teachersRes.ok) {
          const data = await teachersRes.json();
          const teachersList = Array.isArray(data) ? data : (data.data || data.teachers || data.users || []);
          
          // 使用迴圈建立 ID -> Name 的對照表
          teachersList.forEach((t: Teacher) => {
            if (t.id) teacherMap[t.id] = t.name;
            if (t.uid) teacherMap[t.uid] = t.name;
            if (t._id) teacherMap[t._id] = t.name;
          });
        } 

        // 2. 處理課程資料，並直接注入預先計算好的顯示字串
        if (coursesRes.ok) {
          const data = await coursesRes.json();
          let coursesList: Course[] = Array.isArray(data) ? data : (data.data || data.courses || []);
          
          // 利用迴圈預先計算老師名稱與年級字串，避免 Render 時重複運算
          coursesList = coursesList.map(course => {
            // 計算老師名稱
            const teacherData = course.teachers;
            let items: (string | Teacher)[] = [];
            if (Array.isArray(teacherData)) items = teacherData;
            else if (typeof teacherData === 'object' && teacherData !== null) items = Object.keys(teacherData);
            else if (typeof teacherData === 'string') items = [teacherData];

            const names = items.map(item => {
              if (typeof item === 'object' && item !== null && (item as Teacher).name) return (item as Teacher).name;
              const id = typeof item === 'string' ? item : ((item as Teacher).id || (item as Teacher).uid || (item as Teacher)._id);
              return id && teacherMap[id] ? teacherMap[id] : null;
            }).filter(Boolean).join(', ') || '未指定';

            // 計算年級標籤
            const gradeTagsStr = (course.gradeTags && Array.isArray(course.gradeTags)) ? course.gradeTags.join(', ') : '未指定';

            return { ...course, teacherNamesDisplay: names, gradeTagsDisplay: gradeTagsStr };
          });

          setCourses(coursesList);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // 優化：使用 useMemo 快取篩選結果，避免在開啟 Modal 或其他無關狀態改變時重新計算
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesGrade = selectedGrade === 'all' || (Array.isArray(course.gradeTags) && course.gradeTags.includes(selectedGrade));
      const matchesSubject = selectedSubject === 'all' || course.subjectTag === selectedSubject;
      const matchesNature = selectedNature === 'all' || course.courseNature === selectedNature;
      const matchesStatus = selectedStatus === 'all' || course.status === selectedStatus;
      
      return course.showInIntroduction && matchesGrade && matchesSubject && matchesNature && matchesStatus;
    });
  }, [courses, selectedGrade, selectedSubject, selectedNature, selectedStatus]);

  // UI Kit: 優化狀態顏色標籤
  const getStatusColor = (status: string) => {
    switch (status) {
      case '報名中': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case '開課中': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case '已額滿': return 'bg-rose-100 text-rose-800 border border-rose-200';
      case '未開課': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case '已結束': return 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '未設定';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  };

  const handleShowDetails = (course: Course) => {
    setSelectedCourse(course);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  // 監聽 Modal 狀態來控制背景捲動
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const clearFilters = () => {
    setSelectedGrade('all');
    setSelectedSubject('all');
    setSelectedNature('all');
    setSelectedStatus('all');
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl">
      {/* 頁面標題 */}
      <div className="text-center mb-10 md:mb-16">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          課程介紹
        </h1>
        <p className="text-gray-500 text-lg">
          找到適合您的學習計畫，開啟知識之旅
        </p>
      </div>

      {/* 手機版篩選器 (Accordion) */}
      <div className="md:hidden mb-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)} 
          className="w-full px-5 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="font-semibold text-gray-700 flex items-center">
            <i className="fas fa-filter mr-2 text-indigo-500"></i> 篩選條件
          </span>
          <i className={`fas fa-chevron-down text-gray-400 transform transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`}></i>
        </button>
        
        <div className={`transition-all duration-300 ease-in-out ${isFilterOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-5 space-y-4">
            <Dropdown
              value={selectedGrade}
              onChange={setSelectedGrade}
              options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
              placeholder="全部年級"
              className="w-full"
            />
            <Dropdown
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={[{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))]}
              placeholder="全部科目"
              className="w-full"
            />
            <Dropdown
              value={selectedNature}
              onChange={setSelectedNature}
              options={[{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))]}
              placeholder="全部性質"
              className="w-full"
            />
            <Dropdown
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[{ value: 'all', label: '全部狀態' }, ...statuses.map(s => ({ value: s, label: s }))]}
              placeholder="全部狀態"
              className="w-full"
            />
            <button
              onClick={clearFilters}
              className="w-full py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              清除所有篩選
            </button>
            <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-100">
               共 {filteredCourses.length} 筆結果
            </div>
          </div>
        </div>
      </div>

      {/* 桌面版篩選器 (Grid) */}
      <div className="hidden md:block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
             <i className="fas fa-search mr-2 text-indigo-500"></i> 搜尋與篩選
          </h2>
        </div>
        
        <div className="grid grid-cols-5 gap-4">
          <Dropdown
            value={selectedGrade}
            onChange={setSelectedGrade}
            options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
            placeholder="年級"
            className="w-full"
          />
          <Dropdown
            value={selectedSubject}
            onChange={setSelectedSubject}
            options={[{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))]}
            placeholder="科目"
            className="w-full"
          />
          <Dropdown
            value={selectedNature}
            onChange={setSelectedNature}
            options={[{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))]}
            placeholder="性質"
            className="w-full"
          />
          <Dropdown
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[{ value: 'all', label: '全部狀態' }, ...statuses.map(s => ({ value: s, label: s }))]}
            placeholder="狀態"
            className="w-full"
          />
          <button
            onClick={clearFilters}
            className="w-full h-[42px] px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
          >
            <i className="fas fa-undo-alt mr-2"></i> 重置
          </button>
        </div>
      </div>

      {/* 課程列表 (Responsive Grid) */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 text-3xl">
            <i className="fas fa-book-open"></i>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">沒有找到相關課程</h3>
          <p className="text-gray-500 text-sm">請嘗試調整篩選條件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {filteredCourses.map((course) => (
            <div 
              key={course.id} 
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col sm:flex-row overflow-hidden"
            >
              {/* 課程圖片 */}
              <div className="relative w-full pt-[100%] sm:pt-0 sm:w-72 sm:h-72 shrink-0 overflow-hidden bg-white border-b sm:border-b-0 sm:border-r border-gray-100">
                {course.coverImageURL ? (
                  <Image
                    src={course.coverImageURL}
                    alt={course.name}
                    fill
                    className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
                    <i className="fas fa-image text-3xl mb-2"></i>
                    <span className="text-xs">尚無圖片</span>
                  </div>
                )}
                {/* 狀態標籤 (手機版顯示在圖片上) */}
                <div className="absolute top-3 left-3 sm:hidden">
                   <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(course.status)}`}>
                    {course.status}
                  </span>
                </div>
              </div>

              {/* 課程內容 */}
              <div className="flex-1 p-5 sm:p-6 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="hidden sm:inline-block">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(course.status)}`}>
                          {course.status}
                      </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {course.name}
                </h3>

                <div className="text-xs text-gray-400 font-mono mb-3">
                  {course.code || `#${course.id.slice(0,6)}`}
                </div>

                <div className="space-y-2 mb-6 flex-grow">
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-chalkboard-teacher w-6 text-indigo-400 text-center mr-2"></i>
                    <span className="truncate">{course.teacherNamesDisplay}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                     <i className="fas fa-graduation-cap w-6 text-emerald-400 text-center mr-2"></i>
                     <span className="truncate">{course.gradeTagsDisplay}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                     <i className="fas fa-book w-6 text-rose-400 text-center mr-2"></i>
                     <span>{course.subjectTag}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleShowDetails(course)}
                  className="w-full py-2.5 rounded-xl bg-gray-50 text-indigo-600 font-semibold text-sm hover:bg-indigo-600 hover:text-white transition-all duration-300 flex items-center justify-center group-hover:shadow-md"
                >
                  查看詳情 <i className="fas fa-arrow-right ml-2 text-xs opacity-50 group-hover:opacity-100"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Detail Modal */}
      {showModal && selectedCourse && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={handleCloseModal}
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] overflow-hidden flex flex-col animate-bounce-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 pr-8 line-clamp-1">
                {selectedCourse.name}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              

              {/* Status Badge Row */}
              <div className="flex flex-wrap gap-3 mb-6">
                 <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(selectedCourse.status)}`}>
                    {selectedCourse.status}
                 </span>
                 <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 font-medium">
                    {selectedCourse.courseNature}
                 </span>
                 <span className="px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-600 font-medium">
                    {selectedCourse.teachingMethod}
                 </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-5 rounded-xl border border-gray-100">
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">授課老師</label>
                   <p className="text-gray-800 font-medium">{selectedCourse.teacherNamesDisplay}</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">適用對象</label>
                   <p className="text-gray-800 font-medium">{selectedCourse.gradeTagsDisplay} ({selectedCourse.subjectTag})</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">課程期間</label>
                   <p className="text-gray-800 font-medium">
                     {formatDate(selectedCourse.startDate)} ~ {formatDate(selectedCourse.endDate)}
                   </p>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">上課地點</label>
                   <p className="text-gray-800 font-medium">{selectedCourse.location || '未指定'}</p>
                </div>
              </div>

              {/* Class Times */}
              <div className="mb-8">
                 <h4 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-emerald-400 pl-3">上課時間</h4>
                 {Array.isArray(selectedCourse.classTimes) && selectedCourse.classTimes.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden"> 
                       {selectedCourse.classTimes.map((time: string | Record<string, string>, idx: number) => (
                         <div key={idx} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center text-gray-700 text-sm">
                            <i className="far fa-clock mr-3 text-gray-400"></i>
                            {typeof time === 'object' && time !== null
                              ? `${time.day} ${time.startTime} ~ ${time.endTime}`
                              : String(time)}
                         </div>
                       ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic text-sm">暫無時間表</p>
                  )}
              </div>

              {/* Description */}
              {selectedCourse.description && (
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-indigo-400 pl-3">課程介紹</h4>
                  <div className="prose prose-sm md:prose-base max-w-none text-gray-600 bg-white p-1 rounded-lg">
                    <p className="whitespace-pre-line leading-relaxed">{selectedCourse.description}</p>
                  </div>
                </div>
              )}
              

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 gap-3">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors shadow-sm"
              >
                關閉視窗
              </button>
              {selectedCourse.status === '報名中' && (
                <button
                  onClick={() => router.push(`/signup?courseId=${selectedCourse.id}`)}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-colors shadow-md shadow-indigo-200"
                >
                  立即報名
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}