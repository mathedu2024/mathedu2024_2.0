'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TeacherPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // 初始化 activeTab 根據網址 query
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // 切換分頁時，更新網址 query
  const handleTabChange = (tab: string | null) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab) {
      url.searchParams.set('tab', tab);
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-12" style={{ color: 'rgb(70, 131, 229)' }}>
        師資介紹
      </h1>
      
      <div className="space-y-8">
        {/* 吳其恩老師區塊 */}
        <div className="bg-white rounded-xl overflow-hidden p-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* 照片區域 */}
            <div className="w-full md:w-1/3 relative aspect-square">
              <Image
                src="/老師介紹/吳其恩.png"
                alt="吳其恩老師"
                fill
                priority
                style={{ objectFit: 'contain' }}
              />
            </div>
            
            {/* 資訊區域 */}
            <div className="w-full md:w-2/3 space-y-4">
              <h2 className="text-3xl font-bold">吳其恩 老師</h2>
              
              <div>
                <h3 className="text-xl font-semibold text-blue-600 mb-2">所屬科目</h3>
                <p>數學科</p>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-blue-600 mb-2">學歷</h3>
                <li>新北市 信義國小(2013/08~2019/06)</li>
                <li>新北市 中山國中(2019/08~2022/06)</li>
                <li>光仁高中 普通科(2022/08~2025/06)</li>
                <li>東吳大學 數學系(2025/09~)</li>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-blue-600 mb-2">經歷</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>2024數學競賽校內培訓</li>
                  <li>2024ARML Local</li>
                  <li>2024年TI-Nspire學生數學競賽</li>
                  <li>2025數學競賽校內培訓課程助教</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-blue-600 mb-2">專長</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>國高中數學成績補強</li>
                  <li>數位與智慧教育研究</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-blue-600 mb-2">授課課程</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>國中數學系列課程</li>
                  <li>高中數學系列課程</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}