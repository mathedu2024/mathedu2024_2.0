'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PageLoadingArea from './ui/PageLoadingArea';
import { tableActionStyles } from './ui';
import {
  ChartBarIcon,
  TrashIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';
import Dropdown from './ui/Dropdown';
import GradeImportModal from './GradeImportModal';
import GradeOverview from './GradeOverview';
import GradeEntrySheet from './GradeEntrySheet';
import Swal from '@/utils/swalTheme';
import { DEFAULT_PERIODIC_ITEM_KEYS, defaultGradeSettings } from '@/services/gradeShape';
import {
  useCourseGrades,
  confirmDiscardGradeChanges,
  type ColumnDetail,
  type GradeSettings,
  type PeriodicColumnMeta,
  type RegularType,
} from '@/hooks/useCourseGrades';

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

const regularTypeOptions = [
  { value: '小考', label: '小考' },
  { value: '作業', label: '作業' },
  { value: '上課態度', label: '上課態度' },
];

const Modal = ({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  size?: string;
  children?: React.ReactNode;
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) return null;
  const maxWidth = { md: 'max-w-lg', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size as 'md' | 'lg' | 'xl'];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center">{title}</h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default function GradeManager({
  userInfo,
  courseCodeFromUrl = '',
  embedded = false,
  onDirtyChange,
  leaveConfirmRef,
}: {
  userInfo?: UserInfo | null;
  courseCodeFromUrl?: string;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  leaveConfirmRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}) {
  const g = useCourseGrades({
    userInfoId: userInfo?.id,
    courseCodeFromUrl,
    onDirtyChange,
    leaveConfirmRef,
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryFocusStudentId, setEntryFocusStudentId] = useState<string | null>(null);
  const [columnEditor, setColumnEditor] = useState<
    { kind: 'regular'; index: number } | { kind: 'periodic'; key: string } | null
  >(null);
  const [editorDistribution, setEditorDistribution] = useState<{
    statistics: Record<string, number | null>;
    distribution: { range: string; count: number }[];
  } | null>(null);
  const [editorDistLoading, setEditorDistLoading] = useState(false);

  const [listSearch, setListSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    if (!columnEditor || !g.selectedCourse) {
      setEditorDistribution(null);
      return;
    }
    const columnId = columnEditor.kind === 'regular' ? columnEditor.index : columnEditor.key;
    const scoreKind = columnEditor.kind === 'periodic' ? 'periodic' : 'regular';
    let cancelled = false;
    setEditorDistLoading(true);
    setEditorDistribution(null);
    fetch('/api/grades/distribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: g.selectedCourse.id,
        courseKey: `${g.selectedCourse.name}(${g.selectedCourse.code})`,
        columnId,
        scoreKind,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.statistics && data.distribution) {
          setEditorDistribution({
            statistics: data.statistics,
            distribution: data.distribution,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setEditorDistribution(null);
      })
      .finally(() => {
        if (!cancelled) setEditorDistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [columnEditor, g.selectedCourse]);

  const filteredCourses = useMemo(() => {
    return g.courses
      .filter((course) => {
        const statusMatch =
          selectedStatus === 'all' ? course.status !== '已封存' : course.status === selectedStatus;
        const natureMatch = selectedNature === 'all' || course.courseNature === selectedNature;
        return (
          (course.name.toLowerCase().includes(listSearch.toLowerCase()) ||
            course.code.toLowerCase().includes(listSearch.toLowerCase())) &&
          (selectedGrade === 'all' || (course.gradeTags && course.gradeTags.includes(selectedGrade))) &&
          (selectedSubject === 'all' || course.subjectTag === selectedSubject) &&
          natureMatch &&
          statusMatch
        );
      })
      .sort((a, b) => {
        const statuses = ['報名中', '開課中', '未開課', '已額滿', '已結束', '已封存', '資料建置中...'];
        const priorityA = statuses.indexOf(a.status || '');
        const priorityB = statuses.indexOf(b.status || '');
        const pa = priorityA !== -1 ? priorityA : 999;
        const pb = priorityB !== -1 ? priorityB : 999;
        if (pa !== pb) return pa - pb;
        return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
      });
  }, [g.courses, listSearch, selectedGrade, selectedSubject, selectedNature, selectedStatus]);

  const openEntry = (studentId?: string) => {
    setEntryFocusStudentId(studentId ?? null);
    setEntryOpen(true);
  };

  const closeEntry = async (discard: boolean) => {
    if (discard && g.isDirty) {
      const ok = await confirmDiscardGradeChanges();
      if (!ok) return;
      g.discardChanges();
    }
    setEntryOpen(false);
    setEntryFocusStudentId(null);
  };

  return (
    <div
      className={
        embedded
          ? 'w-full min-w-0 flex flex-col animate-fade-in'
          : 'page-shell w-full min-w-0 flex flex-col h-full animate-fade-in'
      }
    >
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
          <div className="border-l-4 border-primary pl-4">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <ClipboardDocumentListIcon className="h-8 w-8 text-primary" />
              成績管理
            </h1>
            <p className="text-gray-500 text-sm mt-1">設定評量比例並登記學生的平時與定期成績。</p>
          </div>
          {g.selectedCourse && (
            <button
              type="button"
              onClick={() => void g.selectCourse(null)}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium flex items-center text-sm"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" /> 返回列表
            </button>
          )}
        </div>
      )}

      {g.isLoading ? (
        <PageLoadingArea />
      ) : !g.selectedCourse ? (
        embedded ? (
          <PageLoadingArea />
        ) : (
          <>
            {g.courses.length > 0 && (
              <CourseFilter
                searchTerm={listSearch}
                onSearchChange={setListSearch}
                selectedGrade={selectedGrade}
                onGradeChange={setSelectedGrade}
                selectedSubject={selectedSubject}
                onSubjectChange={setSelectedSubject}
                selectedNature={selectedNature}
                onNatureChange={setSelectedNature}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                onReset={() => {
                  setListSearch('');
                  setSelectedGrade('all');
                  setSelectedSubject('all');
                  setSelectedNature('all');
                  setSelectedStatus('all');
                }}
              />
            )}
            {filteredCourses.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
                <h3 className="mt-2 text-xl font-bold text-gray-900">尚無符合的課程</h3>
              </div>
            ) : (
              <>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hidden md:block">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 font-bold min-w-[200px]">課程名稱</th>
                        <th className="px-6 py-4 font-bold text-right w-[150px]">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCourses.map((course) => (
                        <tr key={course.id} className="hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 text-base">{course.name}</div>
                            <div className="text-xs font-mono text-gray-500 mt-1">{course.code}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => void g.selectCourse(course)}
                              className={tableActionStyles.primary}
                            >
                              管理成績
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-4">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-white border border-gray-100 rounded-xl shadow-sm p-5"
                      onClick={() => void g.selectCourse(course)}
                    >
                      <h3 className="font-bold text-gray-900 text-lg">{course.name}</h3>
                      <p className="text-xs font-mono text-gray-500 mt-1">{course.code}</p>
                      <button
                        type="button"
                        className={`${tableActionStyles.primary} w-full mt-3`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void g.selectCourse(course);
                        }}
                      >
                        管理成績
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )
      ) : g.isCourseLoading ? (
        <PageLoadingArea />
      ) : (
        <div className="space-y-4">
          {g.isArchived && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
              <span className="font-bold mr-2">提示：</span>
              此課程已封存，您只能查看成績紀錄與下載 Excel，無法修改成績。
            </div>
          )}
          <GradeOverview
            course={g.selectedCourse}
            students={g.computedData}
            periodicColumnDetails={g.periodicColumnDetails}
            isArchived={g.isArchived}
            isDirty={g.isDirty}
            isSaving={g.isSaving}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenImport={() => setShowImportModal(true)}
            onExport={() => void g.handleExportGrades()}
            onSave={() => void g.handleSaveChanges()}
            onDiscard={g.discardChanges}
            onOpenEntry={openEntry}
            onScoreChange={g.handleScoreChange}
            onFinalChange={g.handleFinalScoreChange}
          />
        </div>
      )}

      {g.selectedCourse && (
        <GradeEntrySheet
          open={entryOpen}
          course={g.selectedCourse}
          students={g.computedData}
          focusStudentId={entryFocusStudentId}
          columnDetails={g.columnDetails}
          regularColumns={g.regularColumns}
          periodicColumnDetails={g.periodicColumnDetails}
          isArchived={g.isArchived}
          isDirty={g.isDirty}
          isSaving={g.isSaving}
          onClose={() => {
            setEntryOpen(false);
            setEntryFocusStudentId(null);
          }}
          onSave={() => void g.handleSaveChanges()}
          onDiscardAndClose={() => void closeEntry(true)}
          onAddRegularColumn={g.addRegularColumn}
          onEditRegularColumn={(index) => setColumnEditor({ kind: 'regular', index })}
          onEditPeriodicColumn={(key) => setColumnEditor({ kind: 'periodic', key })}
          onScoreChange={g.handleScoreChange}
          onFinalChange={g.handleFinalScoreChange}
        />
      )}

      {/* 權重設定 */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="課程成績設定" size="lg">
        {(() => {
          const s = (g.settings ?? defaultGradeSettings) as GradeSettings;
          const regSum = s.percents.quiz + s.percents.hw + s.percents.att;
          const finalPeriodicPct = 100 - s.percents.periodic;
          return (
            <div className="space-y-8">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="text-base font-bold text-gray-900 mb-4">平時成績各項目佔比 (建議加總為 100%)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {(
                    [
                      ['quiz', '小考', '小考'],
                      ['hw', '作業', '作業'],
                      ['att', '上課態度', '上課態度'],
                    ] as const
                  ).map(([key, type, label]) => {
                    const modeCfg = s.calcModes[type] ?? { mode: 'all' as const, n: 3 };
                    return (
                      <div key={key} className="space-y-3">
                        <div>
                          <label className="block text-base font-medium text-gray-900 mb-2">{label} (%)</label>
                          <input
                            type="number"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-base focus:ring-2 focus:ring-primary outline-none"
                            value={s.percents[key]}
                            onChange={(e) =>
                              g.setSettings((prev) => {
                                const base = (prev ?? defaultGradeSettings) as GradeSettings;
                                return {
                                  ...base,
                                  percents: { ...base.percents, [key]: Number(e.target.value) || 0 },
                                };
                              })
                            }
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={`calcMode-${type}`}
                              className="w-4 h-4 accent-[#2D6DF6]"
                              checked={modeCfg.mode === 'all'}
                              onChange={() =>
                                g.setSettings((prev) => {
                                  const base = (prev ?? defaultGradeSettings) as GradeSettings;
                                  return {
                                    ...base,
                                    calcModes: {
                                      ...base.calcModes,
                                      [type]: { ...base.calcModes[type], mode: 'all' },
                                    },
                                  };
                                })
                              }
                            />
                            平均
                          </label>
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={`calcMode-${type}`}
                              className="w-4 h-4 accent-[#2D6DF6]"
                              checked={modeCfg.mode === 'best'}
                              onChange={() =>
                                g.setSettings((prev) => {
                                  const base = (prev ?? defaultGradeSettings) as GradeSettings;
                                  return {
                                    ...base,
                                    calcModes: {
                                      ...base.calcModes,
                                      [type]: {
                                        mode: 'best',
                                        n: Math.max(1, base.calcModes[type]?.n ?? 3),
                                      },
                                    },
                                  };
                                })
                              }
                            />
                            擇優
                          </label>
                          {modeCfg.mode === 'best' && (
                            <input
                              type="number"
                              min={1}
                              className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                              value={modeCfg.n}
                              onChange={(e) => {
                                const n = Math.max(1, Number(e.target.value) || 1);
                                g.setSettings((prev) => {
                                  const base = (prev ?? defaultGradeSettings) as GradeSettings;
                                  return {
                                    ...base,
                                    calcModes: { ...base.calcModes, [type]: { mode: 'best', n } },
                                  };
                                });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className={`mt-5 text-base font-bold ${regSum === 100 ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                  目前平時權重加總：{regSum}%
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="text-base font-bold text-gray-900 mb-4">學期總成績佔比</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-base font-medium mb-2">平時加權 佔總成績 (%)</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg p-2.5"
                      value={s.percents.periodic}
                      onChange={(e) =>
                        g.setSettings((prev) => {
                          const base = (prev ?? defaultGradeSettings) as GradeSettings;
                          return {
                            ...base,
                            percents: { ...base.percents, periodic: Number(e.target.value) || 0 },
                          };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium mb-2">定期平均 佔總成績 (%)</label>
                    <input
                      type="number"
                      disabled
                      className="w-full border rounded-lg p-2.5 bg-gray-200 font-bold"
                      value={finalPeriodicPct}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                <div className="font-bold">採計「定期平均」時納入的項目</div>
                {DEFAULT_PERIODIC_ITEM_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-[#2D6DF6]"
                      checked={s.periodicEnabled[k] !== false}
                      onChange={(e) =>
                        g.setSettings((prev) => {
                          const base = (prev ?? defaultGradeSettings) as GradeSettings;
                          return {
                            ...base,
                            periodicEnabled: { ...base.periodicEnabled, [k]: e.target.checked },
                          };
                        })
                      }
                    />
                    {k}
                  </label>
                ))}
              </div>

              <div className="border-t pt-6 space-y-3">
                <div className="font-bold">學生端顯示設定</div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#2D6DF6]"
                    checked={s.periodicEnabled?.['showOriginalTotalToStudents'] !== false}
                    onChange={(e) =>
                      g.setSettings((prev) => {
                        const base = (prev ?? defaultGradeSettings) as GradeSettings;
                        return {
                          ...base,
                          periodicEnabled: {
                            ...base.periodicEnabled,
                            showOriginalTotalToStudents: e.target.checked,
                          },
                        };
                      })
                    }
                  />
                  允許學生查看「原始成績」
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#2D6DF6]"
                    checked={s.periodicEnabled?.['showFinalTotalToStudents'] !== false}
                    onChange={(e) =>
                      g.setSettings((prev) => {
                        const base = (prev ?? defaultGradeSettings) as GradeSettings;
                        return {
                          ...base,
                          periodicEnabled: {
                            ...base.periodicEnabled,
                            showFinalTotalToStudents: e.target.checked,
                          },
                        };
                      })
                    }
                  />
                  允許學生查看「最終成績」
                </label>
              </div>

              <button
                type="button"
                className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-container"
                onClick={() => {
                  setShowSettingsModal(false);
                  void g.handleSaveChanges();
                }}
              >
                確認設定
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* 欄位設定 */}
      <Modal
        open={columnEditor !== null}
        onClose={() => setColumnEditor(null)}
        title={columnEditor?.kind === 'regular' ? '平時成績項目設定' : '定期評量項目設定'}
        size="xl"
      >
        {columnEditor && (
          <div className="space-y-6">
            {columnEditor.kind === 'regular' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">項目名稱</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg p-2 mt-1 ${g.isArchived ? 'bg-gray-100' : ''}`}
                    value={g.columnDetails[columnEditor.index]?.name ?? ''}
                    disabled={g.isArchived}
                    onChange={(e) =>
                      g.setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: prev[String(columnEditor.index)]?.type ?? '小考',
                          name: e.target.value,
                          date: prev[String(columnEditor.index)]?.date ?? '',
                          maxScore: prev[String(columnEditor.index)]?.maxScore ?? 100,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">滿分</label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg p-2 mt-1 ${g.isArchived ? 'bg-gray-100' : ''}`}
                    value={g.columnDetails[columnEditor.index]?.maxScore ?? 100}
                    disabled={g.isArchived}
                    onChange={(e) =>
                      g.setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          ...(prev[String(columnEditor.index)] as ColumnDetail),
                          maxScore: Number(e.target.value) || 100,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">日期</label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg p-2 mt-1 ${g.isArchived ? 'bg-gray-100' : ''}`}
                    value={g.columnDetails[columnEditor.index]?.date ?? ''}
                    disabled={g.isArchived}
                    onChange={(e) =>
                      g.setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: prev[String(columnEditor.index)]?.type ?? '小考',
                          name: prev[String(columnEditor.index)]?.name ?? '',
                          date: e.target.value,
                          maxScore: prev[String(columnEditor.index)]?.maxScore ?? 100,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">成績類別</label>
                  <div className={`mt-1 ${g.isArchived ? 'pointer-events-none opacity-60' : ''}`}>
                    <Dropdown
                      value={g.columnDetails[columnEditor.index]?.type ?? '小考'}
                      onChange={(type) =>
                        g.setColumnDetails((prev) => ({
                          ...prev,
                          [String(columnEditor.index)]: {
                            type: type as RegularType,
                            name: prev[String(columnEditor.index)]?.name ?? '',
                            date: prev[String(columnEditor.index)]?.date ?? '',
                            maxScore: prev[String(columnEditor.index)]?.maxScore ?? 100,
                          },
                        }))
                      }
                      options={regularTypeOptions}
                      placeholder="選擇成績類別"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 border px-4 py-3">
                  <div className="text-xs text-gray-500">評量名稱（固定）</div>
                  <div className="text-base font-bold mt-1">{columnEditor.key}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">日期</label>
                    <input
                      type="date"
                      className={`w-full border rounded-lg p-2 mt-1 ${g.isArchived ? 'bg-gray-100' : ''}`}
                      value={g.periodicColumnDetails[columnEditor.key]?.date ?? ''}
                      disabled={g.isArchived}
                      onChange={(e) =>
                        g.setPeriodicColumnDetails((prev) => ({
                          ...prev,
                          [columnEditor.key]: {
                            name: columnEditor.key,
                            date: e.target.value,
                            type: prev[columnEditor.key]?.type ?? '定期評量',
                            maxScore: prev[columnEditor.key]?.maxScore ?? 100,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">滿分</label>
                    <input
                      type="number"
                      className={`w-full border rounded-lg p-2 mt-1 ${g.isArchived ? 'bg-gray-100' : ''}`}
                      value={g.periodicColumnDetails[columnEditor.key]?.maxScore ?? 100}
                      disabled={g.isArchived}
                      onChange={(e) =>
                        g.setPeriodicColumnDetails((prev) => ({
                          ...prev,
                          [columnEditor.key]: {
                            ...(prev[columnEditor.key] as PeriodicColumnMeta),
                            maxScore: Number(e.target.value) || 100,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {editorDistLoading ? (
              <PageLoadingArea minHeight="min-h-[8rem]" />
            ) : editorDistribution ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-bold mb-3 flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2 text-primary" /> 五標與平均
                  </h5>
                  <table className="min-w-full text-sm border rounded-xl overflow-hidden">
                    <tbody className="divide-y">
                      {(
                        [
                          ['頂標', editorDistribution.statistics.頂標],
                          ['前標', editorDistribution.statistics.前標],
                          ['均標', editorDistribution.statistics.均標],
                          ['後標', editorDistribution.statistics.後標],
                          ['底標', editorDistribution.statistics.底標],
                          ['平均', editorDistribution.statistics.平均],
                        ] as const
                      ).map(([label, val]) => (
                        <tr key={label}>
                          <td className="px-4 py-2">{label}</td>
                          <td className="px-4 py-2 text-right font-mono">{val ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h5 className="font-bold mb-3">分數分布</h5>
                  <div className="space-y-2">
                    {(() => {
                      const total = editorDistribution.distribution.reduce((sum, d) => sum + d.count, 0);
                      return editorDistribution.distribution.map((d) => {
                        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                        return (
                          <div key={d.range} className="flex items-center gap-2 text-sm">
                            <span className="w-16">{d.range}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-20 text-right text-gray-500">
                              {d.count} 人 ({pct}%)
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                尚無分數資料或無法載入統計（儲存後全班有分數時會顯示）
              </p>
            )}

            {columnEditor.kind === 'regular' && !g.isArchived && (
              <div className="border-t pt-4">
                <button
                  type="button"
                  className="w-full py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center justify-center"
                  onClick={() => {
                    void Swal.fire({
                      icon: 'warning',
                      title: '確定刪除此欄？',
                      text: '將一併移除所有學生此欄成績，且欄位會重新編號。',
                      showCancelButton: true,
                      confirmButtonText: '確定刪除',
                      cancelButtonText: '取消',
                      confirmButtonColor: '#dc2626',
                    }).then((r) => {
                      if (r.isConfirmed) {
                        g.deleteRegularColumn(columnEditor.index);
                        setColumnEditor(null);
                      }
                    });
                  }}
                >
                  <TrashIcon className="w-4 h-4 mr-2" /> 刪除此平時欄位
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {g.selectedCourse && userInfo?.id && (
        <GradeImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          courseId={g.selectedCourse.id}
          teacherId={userInfo.id}
          students={g.students}
          columnDetails={g.columnDetails}
          regularColumns={g.regularColumns}
          onImportRegular={g.handleImportRegular}
          onImportPeriodic={g.handleImportPeriodic}
        />
      )}
    </div>
  );
}
