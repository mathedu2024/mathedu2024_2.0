'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Course {
  id: string;
  name: string;
  code: string;
  teachingMethod: '實體上課' | '線上上課' | '非同步線上上課' | '實體與線上同步上課';
  teachers: string[];
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
  classTimes?: string[] | Record<string, string>[]; // 支援物件或字串陣列
}

interface Teacher {
  id: string;
  name: string;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // 篩選器狀態
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedNature, setSelectedNature] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // 篩選選項
  const grades = ['國一', '國二', '國三', '高一', '高二', '高三'];
  const subjects = ['數學', '理化', '物理', '化學', '生物'];
  const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
  const statuses = ['未開課', '報名中', '開課中', '已額滿', '已結束'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 讀取所有課程資料
        const res = await fetch('/api/courses/list');
        if (res.ok) {
          const allCourses = await res.json();
          setCourses(allCourses);
        } else {
          setCourses([]);
        }
        // 讀取所有老師
        const res2 = await fetch('/api/teacher/list');
        if (res2.ok) {
          const teachers = await res2.json();
          setTeachers(teachers);
        } else {
          setTeachers([]);
        }
      } catch {
        setCourses([]);
        setTeachers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 篩選課程
  const filteredCourses = courses.filter(course => {
    const matchesGrade = selectedGrade === 'all' || course.gradeTags.includes(selectedGrade);
    const matchesSubject = selectedSubject === 'all' || course.subjectTag === selectedSubject;
    const matchesNature = selectedNature === 'all' || course.courseNature === selectedNature;
    const matchesStatus = selectedStatus === 'all' || course.status === selectedStatus;
    
    return matchesGrade && matchesSubject && matchesNature && matchesStatus;
  });

  const getTeacherNames = (teacherIds: string[] | undefined | null) => {
    if (!teacherIds || !Array.isArray(teacherIds)) {
      return '未指定';
    }
    return teacherIds
      .map(id => teachers.find(t => t.id === id)?.name)
      .filter(name => name)
      .join(', ') || '未指定';
  };

  const getGradeTags = (gradeTags: string[] | undefined | null) => {
    if (!gradeTags || !Array.isArray(gradeTags)) {
      return '未指定';
    }
    return gradeTags.join(', ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '未開課':
        return 'bg-gray-100 text-gray-800';
      case '報名中':
        return 'bg-green-100 text-green-800';
      case '開課中':
        return 'bg-blue-100 text-blue-800';
      case '已額滿':
        return 'bg-red-100 text-red-800';
      case '已結束':
        return 'bg-gray-200 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '未設定';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleShowDetails = (course: Course) => {
    setSelectedCourse(course);
    setShowModal(true);
  };

  const clearFilters = () => {
    setSelectedGrade('all');
    setSelectedSubject('all');
    setSelectedNature('all');
    setSelectedStatus('all');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-12" style={{ color: 'rgb(70, 131, 229)' }}>
        課程介紹
      </h1>

      {/* 課程篩選器 */}
      {/* 手機：Accordion 收合群組 */}
      <div className="md:hidden mb-8">
        <details className="bg-white rounded-lg p-4 shadow">
          <summary className="text-xl font-semibold mb-2 cursor-pointer">課程篩選</summary>
          <div className="grid grid-cols-1 gap-4 mt-2">
            {/* 年級篩選 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">年級</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部年級</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
            {/* 科目篩選 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">科目</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部科目</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
            {/* 課程性質篩選 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">課程性質</label>
              <select
                value={selectedNature}
                onChange={(e) => setSelectedNature(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部性質</option>
                {courseNatures.map(nature => (
                  <option key={nature} value={nature}>{nature}</option>
                ))}
              </select>
            </div>
            {/* 課程狀態篩選 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">課程狀態</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部狀態</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            {/* 清除篩選按鈕 */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors duration-200 text-sm font-medium"
              >
                清除篩選
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              顯示 {filteredCourses.length} 個課程 (共 {courses.length} 個課程)
            </div>
          </div>
        </details>
      </div>
      {/* 桌機：維持展開 */}
      <div className="hidden md:block bg-white rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">課程篩選</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* 年級篩選 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">年級</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部年級</option>
              {grades.map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>
          {/* 科目篩選 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">科目</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部科目</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          {/* 課程性質篩選 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">課程性質</label>
            <select
              value={selectedNature}
              onChange={(e) => setSelectedNature(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部性質</option>
              {courseNatures.map(nature => (
                <option key={nature} value={nature}>{nature}</option>
              ))}
            </select>
          </div>
          {/* 課程狀態篩選 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">課程狀態</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部狀態</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          {/* 清除篩選按鈕 */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors duration-200 text-sm font-medium"
            >
              清除篩選
            </button>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          顯示 {filteredCourses.length} 個課程 (共 {courses.length} 個課程)
        </div>
      </div>

      {/* Course Grid */}
      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-r-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在載入課程資料...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {courses.length === 0 ? '目前沒有可顯示的課程' : '沒有符合篩選條件的課程'}
            </h3>
            <p className="text-gray-500">
              {courses.length === 0 
                ? '請稍後再來查看，或聯繫我們了解更多資訊。' 
                : '請嘗試調整篩選條件或清除篩選。'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2 sm:px-4 md:px-0">
            {filteredCourses.map((course) => (
              <div key={course.id} className="bg-white overflow-hidden hover:bg-gray-50 transition-all duration-300 flex flex-col md:block mb-6 md:mb-0 relative">
                {/* 圖片區塊 */}
                <div className="w-full aspect-square relative md:w-1/2 md:aspect-auto md:relative md:float-left md:mr-6 mb-4 md:mb-0">
                  <div className="hidden md:block pt-[100%]" />
                  {course.coverImageURL ? (
                    <Image
                      src={course.coverImageURL}
                      alt={course.name}
                      layout="fill"
                      objectFit="cover"
                      className="w-full h-full rounded-none md:absolute md:inset-0"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 rounded-none md:absolute md:inset-0">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📖</div>
                        <div className="text-sm text-gray-500">課程圖片</div>
                      </div>
                    </div>
                  )}
                </div>
                {/* 內容區塊 */}
                <div className="w-full flex flex-col justify-between p-4 sm:p-6 gap-2 text-left bg-white md:absolute md:top-0 md:right-0 md:bottom-0 md:w-1/2 md:overflow-y-auto">
                  <div>
                    <h3 className="text-2xl md:text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                      {course.name}
                    </h3>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-start mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(course.status)}`}> 
                          {course.status}
                        </span>
                      </div>
                      <div className="text-base md:text-base text-gray-700 mb-1">
                        <div className="font-medium inline-block w-20">授課老師：</div>
                        <span className="inline-block break-all" title={getTeacherNames(course.teachers)}>{getTeacherNames(course.teachers)}</span>
                      </div>
                      <div className="text-base md:text-base text-gray-700 mb-1">
                        <div className="font-medium inline-block w-20">年級：</div>
                        <span className="inline-block break-all">{getGradeTags(course.gradeTags)}</span>
                      </div>
                      <div className="text-base md:text-base text-gray-700 mb-1">
                        <div className="font-medium inline-block w-20">科目：</div>
                        <span className="inline-block break-all">{course.subjectTag}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleShowDetails(course)}
                    className="w-full bg-blue-600 text-white py-3 md:py-2 px-4 rounded-lg text-lg md:text-sm font-bold hover:bg-blue-700 transition-colors duration-200 mt-2"
                  >
                    詳細介紹
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedCourse.name}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Course Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">課程狀態</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedCourse.status)}`}>
                      {selectedCourse.status}
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">授課老師</h4>
                    <p className="text-gray-700">{getTeacherNames(selectedCourse.teachers)}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">開始日期</h4>
                    <p className="text-gray-700">{formatDate(selectedCourse.startDate)}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">結束日期</h4>
                    <p className="text-gray-700">{formatDate(selectedCourse.endDate)}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">課程性質</h4>
                    <p className="text-gray-700">{selectedCourse.courseNature}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">適用年級</h4>
                    <p className="text-gray-700">{getGradeTags(selectedCourse.gradeTags)}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">授課方式</h4>
                    <p className="text-gray-700">{selectedCourse.teachingMethod}</p>
                  </div>
                </div>

                {/* 新增：上課時間 */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">上課時間</h4>
                  {Array.isArray(selectedCourse.classTimes) && selectedCourse.classTimes.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-700">
                      {selectedCourse.classTimes.map((time: string | Record<string, string>, idx: number) => (
                        <li key={idx}>
                          {typeof time === 'object' && time !== null && 'day' in time && 'startTime' in time && 'endTime' in time
                            ? `${(time as Record<string, string>)['day']} ${(time as Record<string, string>)['startTime']} ~ ${(time as Record<string, string>)['endTime']}`
                            : String(time)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-700">未設定</p>
                  )}
                </div>

                {selectedCourse.description && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">課程描述</h4>
                    <p className="text-gray-700 whitespace-pre-line text-lg leading-relaxed">{selectedCourse.description}</p>
                  </div>
                )}

                {selectedCourse.location && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">上課地點</h4>
                    <p className="text-gray-700">{selectedCourse.location}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end mt-6 pt-6 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
