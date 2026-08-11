'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase-client';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { useRouter, useSearchParams } from 'next/navigation';
import alerts from '@/utils/alerts';
import { useHydrated } from '@/utils/useHydrated';
import {
  CloudArrowDownIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  FolderOpenIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  KeyIcon,
  UserIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'pdf' | 'document' | 'link';
  status?: 'public' | 'private';
}

interface ResourceFolder {
  id: string;
  title: string;
  indexCode: string;
  teacherId: string;
  createdByName?: string;
  createdByAccount?: string;
  status: 'public' | 'private';
  items: ResourceItem[];
  createdAt?: Timestamp;
}

function normalizeIndexCode(keyword: string): string {
  return keyword.trim().toUpperCase();
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  );
  const id = match?.[2];
  return id && id.length === 11 ? id : null;
}

function sortByCreatedAtDesc(a: ResourceFolder, b: ResourceFolder): number {
  return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
}

function ResourceTypeIcon({ type }: { type: ResourceItem['type'] }) {
  switch (type) {
    case 'video':
      return <VideoCameraIcon className="w-5 h-5 text-rose-500" />;
    case 'pdf':
      return <DocumentIcon className="w-5 h-5 text-red-500" />;
    case 'document':
      return <DocumentTextIcon className="w-5 h-5 text-primary" />;
    default:
      return <LinkIcon className="w-5 h-5 text-on-surfaceVariant" />;
  }
}

interface ResourceFolderCardProps {
  folder: ResourceFolder;
  isExpanded: boolean;
  teacherName: string;
  onToggle: (folderId: string) => void;
  onWatchVideo: (ytId: string, title: string, indexCode: string) => void;
}

const ResourceFolderCard = memo(function ResourceFolderCard({
  folder,
  isExpanded,
  teacherName,
  onToggle,
  onWatchVideo,
}: ResourceFolderCardProps) {
  const publicItems = folder.items.filter((item) => item.status !== 'private');

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
        isExpanded
          ? 'border-primary shadow-md ring-1 ring-primary/20'
          : 'border-outline-variant/40 shadow-sm hover:border-primary/40 hover:shadow-md'
      }`}
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 cursor-pointer select-none group"
        onClick={() => onToggle(folder.id)}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl transition-colors ${
              isExpanded
                ? 'bg-primary/10 text-primary'
                : 'bg-primary/10 text-primary group-hover:bg-primary/10'
            }`}
          >
            {isExpanded ? (
              <FolderOpenIcon className="w-7 h-7" />
            ) : (
              <FolderIcon className="w-7 h-7" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
              {folder.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-sm text-on-surfaceVariant mt-1.5 font-medium">
              <span className="flex items-center bg-surface-container px-2 py-0.5 rounded-md font-mono text-xs">
                <KeyIcon className="w-3.5 h-3.5 mr-1" /> {folder.indexCode}
              </span>
              <span className="flex items-center">
                <UserIcon className="w-4 h-4 mr-1" />
                {teacherName}
              </span>
              <span className="flex items-center text-primary bg-primary/10 px-2 py-0.5 rounded-md text-xs">
                共 {publicItems.length} 個項目
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex justify-end w-full sm:w-auto pr-2">
          {isExpanded ? (
            <ChevronUpIcon className="w-6 h-6 text-primary" />
          ) : (
            <ChevronDownIcon className="w-6 h-6 text-on-surfaceVariant group-hover:text-primary/70" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-outline-variant/40 bg-surface/50 p-5">
          {publicItems.length === 0 ? (
            <div className="text-center py-8 text-on-surfaceVariant text-sm">
              此資料夾中目前沒有公開的資源項目。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {publicItems.map((item, index) => {
                const ytId = item.type === 'video' ? extractYouTubeId(item.url) : null;
                const itemKey = item.id || `${folder.id}-${index}`;

                if (ytId) {
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      onClick={() => onWatchVideo(ytId, item.title, folder.indexCode)}
                      className="flex items-center text-left p-4 bg-white border border-outline-variant/40 rounded-xl hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group w-full"
                    >
                      <div className="mr-4 p-2 bg-surface rounded-lg group-hover:bg-primary/10 transition-colors">
                        <ResourceTypeIcon type={item.type} />
                      </div>
                      <span className="font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                        {item.title}
                      </span>
                    </button>
                  );
                }

                return (
                  <a
                    key={itemKey}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-4 bg-white border border-outline-variant/40 rounded-xl hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="mr-4 p-2 bg-surface rounded-lg group-hover:bg-primary/10 transition-colors">
                      <ResourceTypeIcon type={item.type} />
                    </div>
                    <span className="font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                      {item.title}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function EmptyState({
  icon: Icon,
  title,
  description,
  iconClassName,
  iconBgClassName = 'bg-surface',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconClassName: string;
  iconBgClassName?: string;
}) {
  return (
    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-outline-variant/50 shadow-sm">
      <div className={`w-20 h-20 ${iconBgClassName} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <Icon className={`w-10 h-10 ${iconClassName}`} />
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-2">{title}</h3>
      <p className="text-on-surfaceVariant">{description}</p>
    </div>
  );
}

export default function ResourcesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  const lastSearchedQuery = useRef<string | null>(null);
  const searchRequestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/teacher/list', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, string> = {};
        data.forEach((t: { id: string; name: string }) => {
          map[t.id] = t.name;
        });
        setTeacherMap(map);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });

    return () => controller.abort();
  }, []);

  const performSearch = useCallback(
    async (keyword: string, showAlertWhenEmpty = true) => {
      const indexCode = normalizeIndexCode(keyword);
      if (!indexCode) {
        if (showAlertWhenEmpty) {
          void alerts.showWarning('提示', '請輸入 6 位數搜尋碼');
        }
        return;
      }

      const requestId = ++searchRequestId.current;
      setLoading(true);
      setHasSearched(true);
      setExpandedFolderIds(new Set());
      lastSearchedQuery.current = keyword.trim();

      try {
        const q = query(collection(db, 'resources'), where('indexCode', '==', indexCode));
        const snapshot = await getDocs(q);

        if (requestId !== searchRequestId.current) return;

        const matched = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as ResourceFolder)
          .filter((folder) => folder.status === 'public')
          .sort(sortByCreatedAtDesc);

        setFolders(matched);
        router.replace(`/student/resources?q=${encodeURIComponent(keyword.trim())}`);
      } catch (error) {
        if (requestId !== searchRequestId.current) return;
        console.error('搜尋失敗:', error);
        void alerts.showError('錯誤', '搜尋資源時發生異常，請稍後再試');
      } finally {
        if (requestId === searchRequestId.current) {
          setLoading(false);
        }
      }
    },
    [router]
  );

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      await performSearch(searchQuery, true);
    },
    [performSearch, searchQuery]
  );

  useEffect(() => {
    const q = searchParams.get('q');
    if (!q || lastSearchedQuery.current === q) return;

    setSearchQuery(q);
    void performSearch(q, false);
  }, [searchParams, performSearch]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleWatchVideo = useCallback(
    (ytId: string, title: string, indexCode: string) => {
      router.push(
        `/student/watch?v=${ytId}&title=${encodeURIComponent(title)}&code=${encodeURIComponent(indexCode)}&q=${encodeURIComponent(searchQuery.trim())}`
      );
    },
    [router, searchQuery]
  );

  const getTeacherName = useCallback(
    (folder: ResourceFolder) =>
      teacherMap[folder.teacherId] || folder.createdByName || '未知老師',
    [teacherMap]
  );

  if (!hydrated) {
    return <PageLoadingArea />;
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3">
            <CloudArrowDownIcon className="h-8 w-8 text-primary" />
            線上資源
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">
            搜尋與下載教學資源
          </p>
        </div>
      </div>

      <div className="mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-outline-variant/40">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="w-full relative flex-1">
            <MagnifyingGlassIcon className="w-6 h-6 text-on-surfaceVariant absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="請輸入老師提供的索引碼進行搜尋"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-outline-variant/40 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-on-surface bg-surface focus:bg-surface-containerLowest text-base shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl shadow-sm transition-all disabled:opacity-70 whitespace-nowrap text-base"
          >
            搜尋
          </button>
        </form>
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <PageLoadingArea />
        ) : !hasSearched ? (
          <EmptyState
            icon={MagnifyingGlassIcon}
            iconBgClassName="bg-primary/10"
            iconClassName="text-primary/50"
            title="等待搜尋指令"
            description="請在上方輸入關鍵字後點擊「搜尋」，以確保您能專注找到所需的資源。"
          />
        ) : folders.length === 0 ? (
          <EmptyState
            icon={FolderOpenIcon}
            iconClassName="text-outline"
            title="找不到相關資源"
            description="請確認您輸入的索引碼是否正確。"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {folders.map((folder) => (
              <ResourceFolderCard
                key={folder.id}
                folder={folder}
                isExpanded={expandedFolderIds.has(folder.id)}
                teacherName={getTeacherName(folder)}
                onToggle={toggleFolder}
                onWatchVideo={handleWatchVideo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
