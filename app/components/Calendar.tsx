'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface CalendarProps {
  onDateSelect: (date: string) => void;
}

export default function Calendar({ onDateSelect }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      onDateSelect(date.toISOString().split('T')[0]);
    }
  };

  return (
    <div className="react-datepicker-wrapper w-full">
      <style jsx global>{`
        .react-datepicker {
          font-family: inherit;
          border-radius: 1rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        .react-datepicker__header {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          border-top-left-radius: 1rem;
          border-top-right-radius: 1rem;
          padding-top: 1rem;
        }
        .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
          background-color: #4f46e5 !important; /* Indigo-600 */
          border-radius: 0.5rem;
        }
        .react-datepicker__day:hover {
          background-color: #e0e7ff !important; /* Indigo-100 */
          border-radius: 0.5rem;
        }
        .react-datepicker__current-month {
          color: #111827;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .react-datepicker__day-name {
          color: #6b7280;
        }
      `}</style>
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        inline
        dateFormat="yyyy/MM/dd"
        // 雖然 inline 模式不需要 input class，但保留以防未來改為 popup 模式
        className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
  );
}