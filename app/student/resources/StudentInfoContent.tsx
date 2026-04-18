'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { useStudentInfo } from '../StudentInfoContext';
import LoadingSpinner from '@/components/LoadingSpinner';
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
  DocumentIcon
} from '@heroicons/react/24/outline';

// ============================================================================
// 類型定義
// ============================================================================

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

export default function ResourcesContent() {
  const { studentInfo, loading: studentLoading } = useStudentInfo();
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);

  // 取得公開的資源資料夾
  useEffect(() => {
    const fetchPublicResources = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'resources'),
          where('status', '==', 'public')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceFolder));
        
        // 依建立時間排序 (由新到舊)
        data.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        setFolders(data);
      } catch (error) {
        console.error('無法載入資源:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicResources();
  }, []);

  // 搜尋過濾邏輯
  const filteredFolders = useMemo(() => {
    return folders.filter(folder => {
      const queryStr = searchQuery.toLowerCase().trim();
      return (
        folder.title.toLowerCase().includes(queryStr) || 
        folder.indexCode.toLowerCase().includes(queryStr) ||
        folder.createdByName?.toLowerCase().includes(queryStr)
      );
    });
  }, [folders, searchQuery]);

  // 切換資料夾展開狀態
  const toggleFolder = (folderId: string) => {
    setExpandedFolderId(prev => prev === folderId ? null : folderId);
  };

  // 根據資源類型取得對應的 Icon 與顏色
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'video': return <VideoCameraIcon className="w-5 h-5 text-rose-500" />;
      case 'pdf': return <DocumentIcon className="w-5 h-5 text-red-500" />;
      case 'document': return <DocumentTextIcon className="w-5 h-5 text-blue-500" />;
      case 'link': 
      default: return <LinkIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  if (studentLoading && studentInfo === null) {
    return <LoadingSpinner fullScreen size={40} />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <CloudArrowDownIcon className="h-8 w-8 text-indigo-600" />
            線上資源
          </h1>
          <p className="text-gray-500 text-sm mt-1">搜尋並下載老師分享的教學資源、講義與補充影片。</p>
        </div>
      </div>

      {/* 搜尋列 */}
      <div className="mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-4">
        <div className="w-full relative">
          <MagnifyingGlassIcon className="w-6 h-6 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="輸入老師提供的 6 位數搜尋碼、資源名稱或老師姓名..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white text-base md:text-lg shadow-inner"
          />
        </div>
      </div>

      {/* 資源列表 */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <LoadingSpinner size={40} />
            <p className="text-gray-500 mt-4 font-medium">資料讀取中...</p>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpenIcon className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">找不到相關資源</h3>
            <p className="text-gray-500">請嘗試使用其他的搜尋碼或關鍵字。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredFolders.map((folder) => {
              const isExpanded = expandedFolderId === folder.id;
              // 過濾掉設為 private 的單筆項目，確保學生只能看見公開資源
              const publicItems = folder.items.filter(item => item.status !== 'private');

              return (
                <div 
                  key={folder.id} 
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isExpanded ? 'border-indigo-500 shadow-md ring-1 ring-indigo-100' : 'border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  {/* 資料夾標頭 (可點擊展開) */}
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 cursor-pointer select-none group"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100'}`}>
                        {isExpanded ? <FolderOpenIcon className="w-7 h-7" /> : <FolderIcon className="w-7 h-7" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {folder.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1.5 font-medium">
                          <span className="flex items-center bg-gray-100 px-2 py-0.5 rounded-md font-mono text-xs">
                            <KeyIcon className="w-3.5 h-3.5 mr-1" /> {folder.indexCode}
                          </span>
                          <span className="flex items-center">
                            <UserIcon className="w-4 h-4 mr-1" />
                            {folder.createdByName || '未知老師'}
                          </span>
                          <span className="flex items-center text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md text-xs">
                            共 {publicItems.length} 個項目
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex justify-end w-full sm:w-auto pr-2">
                      {isExpanded ? (
                        <ChevronUpIcon className="w-6 h-6 text-indigo-500" />
                      ) : (
                        <ChevronDownIcon className="w-6 h-6 text-gray-400 group-hover:text-indigo-400" />
                      )}
                    </div>
                  </div>

                  {/* 展開後的資源清單 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                      {publicItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          此資料夾中目前沒有公開的資源項目。
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {publicItems.map((item, index) => (
                            <a 
                              key={item.id || index} 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                            >
                              <div className="mr-4 p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                {getItemIcon(item.type)}
                              </div>
                              <span className="font-bold text-gray-700 group-hover:text-indigo-700 transition-colors line-clamp-1">
                                {item.title}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
