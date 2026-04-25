'use client';

import React from 'react';

interface BlockedYoutubePlayerProps {
  videoId: string;
  title?: string;
}

export default function BlockedYoutubePlayer({ 
  videoId, 
  title = '教學影片' 
}: BlockedYoutubePlayerProps) {
  // 換回原本的 youtube.com，並加上 modestbranding=1 與 rel=0 參數
  const embedUrl = `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`;

  return (
    <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black shadow-sm border border-gray-200">
      <div className="absolute inset-0 w-full h-full">
        {/* 底層影片：YouTube Iframe */}
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  );
}