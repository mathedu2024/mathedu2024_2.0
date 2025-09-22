import React from 'react';

interface Course {
  id: string;
  name: string;
  code: string;
  teachingMethod?: string;
  teachers?: string[];
  startDate?: string;
  endDate?: string;
  status?: '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
  gradeTags?: string[];
  subjectTag?: string;
  courseNature?: string;
  showInIntroduction?: boolean;
  archived?: boolean;
  description?: string;
  coverImageURL?: string;
  location?: string;
  liveStreamURL?: string;
  classTimes?: string[] | Record<string, string>[] | Record<string, unknown>[];
}

interface Teacher {
  id: string;
  name: string;
}

interface PercentileStatistics {
  平均: number | null;
  頂標: number | null;
  前標: number | null;
  均標: number | null;
  後標: number | null;
  底標: number | null;
}

interface CourseDetailModalProps {
  course: Course | { id: string; name: string; code: string } | null;
  teachers: Teacher[];
  open: boolean;
  onClose: () => void;
  showDescription: boolean;
  
  showStudents?: boolean;
  showDeleteButton?: boolean;
  onDelete?: () => void;
  showLiveStreamURL?: boolean;
  isGradeInfo?: boolean;
  editingColumn?: number | null;
  columnDetails?: { [idx: number]: { type: string; name: string; date: string; nature?: string } };
  onColumnDetailsChange?: (details: { [idx: number]: { type: string; name: string; date: string; nature?: string } }) => void;
  students?: {
    name: string;
    regularScores: { [columnId: string]: number | undefined };
    periodicScores?: { [name: string]: number | undefined };
  }[];
  getTaiwanPercentileLevels?: (scores: number[]) => PercentileStatistics;
  isPeriodic?: boolean;
  periodicScores?: string[];
}

export default function CourseDetailModal({
  course,
  teachers,
  open,
  onClose,
  showDeleteButton = false,
  onDelete,
  isGradeInfo = false,
  editingColumn = null,
  columnDetails = {},
  onColumnDetailsChange,
  students = [],
  getTaiwanPercentileLevels,
  isPeriodic = false,
  periodicScores = []
}: CourseDetailModalProps) {

  if (!open || !course) return null;

  const isSimpleCourse = !('teachingMethod' in course) && !('status' in course);

  const getTeacherNames = (teacherIds: string[] | undefined | null) => {
    if (!teacherIds || !Array.isArray(teacherIds)) {
      return '未指定';
    }
    return teacherIds.map(id => teachers.find(t => t.id === id)?.name).filter(Boolean).join(', ') || '未指定';
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未設定';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const currentColumn = editingColumn !== null ? columnDetails[editingColumn] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{course.name}</h2>
          </div>

          <div className="space-y-4">
            {/* === 成績欄位編輯 === */}
            {isGradeInfo && editingColumn !== null ? (
              <>
                <div className="mb-3">
                  <label className="block mb-1 font-semibold text-gray-900">名稱：</label>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={currentColumn?.name || ''}
                    onChange={e =>
                      onColumnDetailsChange?.({
                        ...columnDetails,
                        [editingColumn]: { ...currentColumn, name: e.target.value }
                      })
                    }
                    disabled={isPeriodic}
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-semibold text-gray-900">考試日期：</label>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full"
                    value={currentColumn?.date || ''}
                    onChange={e =>
                      onColumnDetailsChange?.({
                        ...columnDetails,
                        [editingColumn]: { ...currentColumn, date: e.target.value }
                      })
                    }
                  />
                </div>

                {/* 成績性質選擇（僅針對平時成績） */}
                {!isPeriodic && (
                  <div className="mb-3">
                    <label className="block mb-1 font-semibold text-gray-900">成績性質：</label>
                    <select
                      className="border rounded px-2 py-1 w-full"
                      value={currentColumn?.nature || '平時測驗'}
                      onChange={e =>
                        onColumnDetailsChange?.({
                          ...columnDetails,
                          [editingColumn]: { 
                            ...currentColumn, 
                            nature: e.target.value as '平時測驗' | '回家作業' | '上課態度'
                          }
                        })
                      }
                    >
                      <option value="平時測驗">平時測驗</option>
                      <option value="回家作業">回家作業</option>
                      <option value="上課態度">上課態度</option>
                    </select>
                  </div>
                )}

                {/* 成績統計 */}
                {isGradeInfo && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-4">成績統計</h4>
                    {(() => {
                      let scores: number[] = [];
                      
                      if (isPeriodic && editingColumn !== null && periodicScores && periodicScores[editingColumn]) {
                        // 定期評量：只分析該次評量的成績
                        const scoreName = periodicScores[editingColumn];
                        scores = students
                          .map(stu => stu.periodicScores?.[scoreName as keyof typeof stu.periodicScores])
                          .filter(score => typeof score === 'number' && !isNaN(score)) as number[];
                      } else if (!isPeriodic && editingColumn !== null) {
                        // 平時成績：分析該欄位的成績
                        scores = students
                          .map(stu => stu.regularScores?.[editingColumn])
                          .filter(score => typeof score === 'number' && !isNaN(score)) as number[];
                      }
                      
                      if (scores.length === 0) {
                        return <p className="text-gray-500">暫無成績資料</p>;
                      }
                      
                      const stats = getTaiwanPercentileLevels!(scores);
                      const max = Math.max(...scores);
                      const min = Math.min(...scores);
                      const sortedScores = [...scores].sort((a, b) => a - b);
                      const median = sortedScores.length % 2 === 0
                        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
                        : sortedScores[Math.floor(sortedScores.length / 2)];
                      
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{stats.平均}</div>
                            <div className="text-sm text-gray-600">平均</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{max}</div>
                            <div className="text-sm text-gray-600">最高</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{min}</div>
                            <div className="text-sm text-gray-600">最低</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{median}</div>
                            <div className="text-sm text-gray-600">中位數</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">{stats.頂標}</div>
                            <div className="text-sm text-gray-600">頂標</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-yellow-600">{stats.前標}</div>
                            <div className="text-sm text-gray-600">前標</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">{stats.均標}</div>
                            <div className="text-sm text-gray-600">均標</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-600">{stats.後標}</div>
                            <div className="text-sm text-gray-600">後標</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-600">{stats.底標}</div>
                            <div className="text-sm text-gray-600">底標</div>
                          </div>
                        </div>
                      );
                    })()
                    }
                  </div>
                )}

                {/* 定期評量說明 */}
                {isPeriodic && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">定期評量說明</h4>
                    <p className="text-sm text-gray-700">
                      定期評量名稱已預設為：第一次定期評量、第二次定期評量、期末評量，無法修改。
                    </p>
                  </div>
                )}
              </>
            ) : isSimpleCourse ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><h4 className="font-semibold text-gray-900 mb-1">課程代碼</h4><p>{course.code}</p></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">課程名稱</h4><p>{course.name}</p></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><h4 className="font-semibold text-gray-900 mb-1">課程狀態</h4><span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor((course as Course).status ?? '')}`}>{(course as Course).status ?? '未設定'}</span></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">授課老師</h4><p>{getTeacherNames((course as Course).teachers)}</p></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">開始日期</h4><p>{formatDate((course as Course).startDate)}</p></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">結束日期</h4><p>{formatDate((course as Course).endDate)}</p></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">課程性質</h4><p>{(course as Course).courseNature ?? '未設定'}</p></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">適用年級</h4><p>{getGradeTags((course as Course).gradeTags)}</p></div>
                <div><h4 className="font-semibold text-gray-900 mb-1">授課方式</h4><p>{(course as Course).teachingMethod ?? '未設定'}</p></div>
                {(course as Course).location && (<div><h4 className="font-semibold text-gray-900 mb-1">上課地點</h4><p>{(course as Course).location}</p></div>)}
                {((course as Course).teachingMethod === '線上上課' || (course as Course).teachingMethod === '實體與線上同步上課') && (course as Course).liveStreamURL && (
                  <div className="md:col-span-2"><h4 className="font-semibold text-gray-900 mb-1">會議室連結</h4><a href={(course as Course).liveStreamURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">點擊加入</a></div>
                )}
              </div>
            )}
          </div>

          {!isSimpleCourse && (course as Course).description && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-semibold text-gray-900 mb-2">課程簡介</h4>
              <p className="text-gray-600 whitespace-pre-line">{(course as Course).description}</p>
            </div>
          )}

          <div className="flex justify-end mt-6 pt-6 border-t">
            {showDeleteButton && onDelete && (<button onClick={onDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors mr-auto">刪除此欄</button>)}
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
}