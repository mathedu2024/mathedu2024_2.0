'use client';

import Image from 'next/image';
import React, { useState, Suspense } from 'react';

export default function TeacherPage() {
  return (
    <Suspense>
      <TeacherPageContent />
    </Suspense>
  );
}

function TeacherPageContent() {
  const teachers = [
    {
      name: '吳其恩 老師',
      subject: '數學科',
      photo: '/老師介紹/吳其恩.png',
      education: [
        '新北市 信義國小(2013/08~2019/06)',
        '新北市 中山國中(2019/08~2022/06)',
        '光仁高中 普通科(2022/08~2025/06)',
        '東吳大學 數學系(2025/09~)'
      ],
      experience: [
        '2019年 北區四城市中小學學生專題寫作比賽',
        '2024年 ARML Local',
        '2024年 TI-Nspire學生數學競賽',
        '2024年 數學競賽校內培訓',
        '2025年 新北市高中計算器檢定',
        '2025年 數學競賽校內培訓課程助教'
      ],
      expertise: [
        '國高中數學成績補強',
        '數位與智慧教育研究'
      ],
      courses: [
        '國中數學系列課程',
        '高中數學系列課程'
      ]
    }
    // 可擴充更多老師
  ];
  type Teacher = typeof teachers[number];
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-12 text-blue-600 tracking-tight drop-shadow-sm">
        師資介紹
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2 sm:px-4 md:px-0">
        {teachers.map((teacher) => (
          <div
            key={teacher.name}
            className="bg-white rounded-lg shadow-md hover:shadow-xl overflow-hidden hover:bg-gray-50 transition-all duration-300 flex flex-col md:block mb-6 md:mb-0 relative"
          >
            {/* 圖片區塊 */}
            <div className="w-full relative md:w-1/2 md:relative md:float-left md:mr-6 mb-4 md:mb-0">
              <div className="block pt-[100%]" />
              <Image
                src={teacher.photo}
                alt={teacher.name}
                fill
                priority
                style={{ objectFit: 'cover' }}
                className="w-full h-full rounded-none md:absolute md:inset-0"
              />
            </div>
            {/* 內容區塊 */}
            <div className="w-full flex flex-col justify-between p-4 sm:p-6 gap-2 text-left bg-white md:absolute md:top-0 md:right-0 md:bottom-0 md:w-1/2 md:overflow-y-auto">
              <div>
                <h2 className="text-3xl md:text-2xl font-bold text-blue-800 mb-2 line-clamp-2">{teacher.name}</h2>
                <div className="text-xl md:text-xl text-blue-600 font-semibold mb-2">{teacher.subject}</div>
                <div className="text-lg md:text-lg text-blue-700 mb-4 leading-tight">
                  {teacher.courses && teacher.courses.length > 0 ? teacher.courses.join(' / ') : ''}
                </div>
              </div>
              <button
                className="w-full bg-blue-600 text-white py-3 md:py-2 px-4 rounded-lg text-lg md:text-sm font-bold hover:bg-blue-700 transition-colors duration-200 mt-2"
                onClick={() => { setSelectedTeacher(teacher); setShowModal(true); }}
              >
                詳細資料
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* Detail Modal */}
      {showModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedTeacher.name}</h2>
              </div>
              {/* Teacher Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">負責科目</h4>
                    <span className="text-blue-700 font-semibold">{selectedTeacher.subject}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">學歷</h4>
                    <ul className="list-disc list-inside text-gray-700">
                      {selectedTeacher.education.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                  <div className="md:col-span-2">
                    <h4 className="font-semibold text-gray-900 mb-1">經歷</h4>
                    <ul className="list-disc list-inside text-gray-700">
                      {selectedTeacher.experience.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">專長</h4>
                    <ul className="list-disc list-inside text-gray-700">
                      {selectedTeacher.expertise.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">授課課程</h4>
                    <ul className="list-disc list-inside text-gray-700">
                      {selectedTeacher.courses.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                </div>
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