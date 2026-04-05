'use client';

import Image from 'next/image';
import React, { useState, Suspense } from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

const teachers = [
  {
    name: '吳其恩 老師',
    subject: '數學科',
    photo: '/老師介紹/吳其恩.png',
    education: [
      '新北市 信義國小 (2013/08~2019/06)',
      '新北市 中山國中 (2019/08~2022/06)',
      '光仁高中 普通科 (2022/08~2025/06)',
      '東吳大學 數學系 (2025/09~)'
    ],
    experience: [
      '2018年 亞東技術院 彈指翻轉程式競賽',
      '2019年 北區四城市中小學學生專題寫作比賽',
      '2024年 ARML Local',
      '2024年 TI-Nspire學生數學競賽',
      '2024年 數學競賽校內培訓',
      '2025年 新北市高中計算器檢定',
      '2025年~ 光仁高中數學競賽校內培訓課程助教',
      '2026年~ 三民高中數學競賽校內培訓課程助教'
    ],
    expertise: [
      '國高中數學成績增強',
      '高中數學計算器教育',
      '數位與智慧教育研究'
    ],
    courses: [
      '國中數學課程',
      '高中數學課程',
    ]
  }
  // 可擴充更多老師
];

type Teacher = typeof teachers[number];

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <TeacherPageContent />
    </Suspense>
  );
}

function TeacherPageContent() {
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleShowDetails = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.style.overflow = 'unset';
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl min-h-screen">
      
      {/* 頁面標題 */}
      <div className="text-center mb-10 md:mb-16">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          老師介紹
        </h1>
        <p className="text-gray-500 text-lg">
          優秀的教學團隊，引領學生邁向卓越
        </p>
      </div>

      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {teachers.map((teacher) => (
          <motion.div
            key={teacher.name}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col sm:flex-row overflow-hidden h-full"
            variants={itemVariants}
          >
            {/* 圖片區塊 (1:1 比例) */}
            <div className="relative w-full pt-[100%] sm:pt-0 sm:w-72 sm:h-72 shrink-0 overflow-hidden bg-white border-b sm:border-b-0 sm:border-r border-gray-100">
              {teacher.photo ? (
                <Image
                  src={teacher.photo}
                  alt={teacher.name}
                  fill
                  className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 288px"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 bg-indigo-50">
                  <i className="fas fa-user text-4xl mb-2"></i>
                </div>
              )}
            </div>

            {/* 內容區塊 */}
            <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {teacher.name}
                  </h2>
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                    {teacher.subject}
                  </span>
                </div>
                
                <div className="space-y-3 mb-4">
                  {teacher.courses && teacher.courses.length > 0 && (
                    <div className="text-sm text-gray-600 flex items-start">
                      <i className="fas fa-book-open w-5 text-indigo-400 mt-0.5 shrink-0"></i>
                      <div className="flex flex-col">
                        {teacher.courses.map((course, index) => (
                          <span key={index}>{course}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {teacher.expertise && teacher.expertise.length > 0 && (
                    <div className="text-sm text-gray-600 flex items-start">
                      <i className="fas fa-star w-5 text-amber-400 mt-0.5 shrink-0"></i>
                      <div className="flex flex-col">
                        {teacher.expertise.map((exp, index) => (
                          <span key={index}>{exp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleShowDetails(teacher)}
                className="w-full py-2.5 rounded-xl bg-gray-50 text-indigo-600 font-semibold text-sm hover:bg-indigo-600 hover:text-white transition-all duration-300 flex items-center justify-center group-hover:shadow-md mt-2"
              >
                詳細介紹 <i className="fas fa-arrow-right ml-2 text-xs opacity-50 group-hover:opacity-100"></i>
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Detail Modal */}
      {showModal && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={handleCloseModal}
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-bounce-in">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedTeacher.name}</h2>
                  <p className="text-xs text-indigo-600 font-medium">{selectedTeacher.subject}</p>
                </div>
              </div>
              <button 
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-8">
                
                {/* 學歷 */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h4 className="flex items-center text-lg font-bold text-gray-800 mb-3">
                    <i className="fas fa-graduation-cap text-indigo-500 mr-2"></i> 學歷
                  </h4>
                  <ul className="space-y-2">
                    {selectedTeacher.education.map((edu, i) => (
                      <li key={i} className="flex items-start text-gray-700 text-sm">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 mr-2 shrink-0"></span>
                        {edu}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 經歷 */}
                <div>
                  <h4 className="flex items-center text-lg font-bold text-gray-800 mb-3 border-l-4 border-indigo-500 pl-3">
                    經歷
                  </h4>
                  <ul className="space-y-3">
                    {selectedTeacher.experience.map((exp, i) => (
                      <li key={i} className="text-gray-700 text-sm leading-relaxed border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                        {exp}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 雙欄資訊：專長 & 課程 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-lg font-bold text-gray-800 mb-3 border-l-4 border-amber-400 pl-3">
                      專長
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.expertise.map((item, i) => (
                        <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="flex items-center text-lg font-bold text-gray-800 mb-3 border-l-4 border-emerald-400 pl-3">
                      授課課程
                    </h4>
                    <ul className="space-y-1">
                      {selectedTeacher.courses.map((course, i) => (
                        <li key={i} className="flex items-center text-gray-700 text-sm">
                          <i className="fas fa-check text-emerald-500 mr-2 text-xs"></i>
                          {course}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors shadow-sm"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}