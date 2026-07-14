'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import BackButton from '@/components/ui/BackButton';
import BlockedYoutubePlayer from '../../../components/BlockedYoutubePlayer';

function normalizeYouTubeId(input: string | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const idPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (idPattern.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (host.includes('youtu.be')) {
      const candidate = url.pathname.replace('/', '');
      return idPattern.test(candidate) ? candidate : null;
    }

    if (host.includes('youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId && idPattern.test(watchId)) return watchId;

      const pathSegments = url.pathname.split('/').filter(Boolean);
      const embedIdx = pathSegments.findIndex((segment) => segment === 'embed');
      if (embedIdx >= 0 && pathSegments[embedIdx + 1] && idPattern.test(pathSegments[embedIdx + 1])) {
        return pathSegments[embedIdx + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

export default function WatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const videoParam = searchParams.get('v');
  const title = searchParams.get('title') || '影片播放';
  const indexCode = searchParams.get('code');
  const preservedQuery = searchParams.get('q') || '';
  const videoId = normalizeYouTubeId(videoParam);
  const backToResources = () => {
    const target = preservedQuery
      ? `/student/resources?q=${encodeURIComponent(preservedQuery)}`
      : '/student/resources';
    router.push(target);
  };

  if (!videoId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="page-shell w-full min-w-0 py-6 md:py-8">
          <div className="max-w-3xl mx-auto bg-white border border-red-100 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <ExclamationTriangleIcon className="w-7 h-7" />
            <h1 className="text-xl md:text-2xl font-bold">無法載入影片</h1>
          </div>
          <p className="text-gray-600 mb-6">
            影片連結可能無效或缺少參數，請回到線上資源頁面重新選擇影片。
          </p>
          <BackButton label="返回資源頁" onClick={backToResources} variant="primary" withSpacing={false} />
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="page-shell w-full min-w-0 py-4 md:py-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <BlockedYoutubePlayer videoId={videoId} title={title} />
          <div className="px-5 py-4 md:px-6 md:py-5">
            <h1 className="text-base md:text-xl font-bold text-gray-800 break-words">{title}</h1>
            {indexCode && (
              <p className="mt-2 text-sm text-gray-600">
                索引碼：
                <span className="ml-1 inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                  {indexCode}
                </span>
              </p>
            )}
            <BackButton label="返回資源頁" onClick={backToResources} withSpacing={false} className="mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
