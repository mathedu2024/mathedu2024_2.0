import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 避免 dev/build 把大型 server 套件整包打進 bundle，加快編譯
  serverExternalPackages: ["firebase-admin", "exceljs"],
  // 功能已併入課程 Hub；舊列表網址轉過去，深連結（建測驗／點名活動等）維持原路徑
  async redirects() {
    return [
      {
        source: '/student/grades',
        destination: '/student/courses',
        permanent: true,
      },
      {
        source: '/student/grades/:courseCode',
        destination: '/student/courses/:courseCode?tab=grades',
        permanent: true,
      },
      {
        source: '/back-panel/teacher-grades',
        destination: '/back-panel/teacher-courses',
        permanent: true,
      },
      {
        source: '/back-panel/teacher-grades/:courseCode',
        destination: '/back-panel/teacher-courses/:courseCode?tab=grades',
        permanent: true,
      },
      {
        source: '/back-panel/teacher-exams',
        destination: '/back-panel/teacher-courses',
        permanent: true,
      },
      {
        source: '/back-panel/teacher-surveys',
        destination: '/back-panel/teacher-courses',
        permanent: true,
      },
      {
        source: '/back-panel/teacher-attendance',
        destination: '/back-panel/teacher-courses',
        permanent: true,
      },
      {
        source: '/back-panel/teacher-attendance/:courseCode',
        destination: '/back-panel/teacher-courses/:courseCode?tab=attendance',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;