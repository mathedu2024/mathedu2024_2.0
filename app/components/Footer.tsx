import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full py-8 text-gray-500 text-sm bg-gray-50 border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:gap-8 items-center justify-center w-full">
        <div className="w-full text-center break-all mb-2 md:mb-0 md:w-auto md:text-left flex flex-col md:flex-row items-center md:gap-2">
           <span className="font-semibold text-gray-400 uppercase text-xs tracking-wider">Contact</span>
           <span className="text-gray-600 hover:text-indigo-600 transition-colors">E-mail：mathedu2024.class@gmail.com</span>
        </div>
        <div className="w-full text-center break-all md:w-auto md:text-left flex flex-col md:flex-row items-center md:gap-2">
           <span className="font-semibold text-gray-400 uppercase text-xs tracking-wider">Line</span>
           <span className="text-gray-600 hover:text-indigo-600 transition-colors">@674ofxrd</span>
        </div>
        <div className="mt-4 md:mt-0 text-xs text-gray-400">
           © 2024 高中學習資源教育網 2.0
        </div>
      </div>
    </footer>
  );
}