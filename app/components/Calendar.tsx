'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Import the styles


interface CalendarProps {
  onDateSelect: (date: string) => void;
}

export default function Calendar({ onDateSelect }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      onDateSelect(date.toISOString().split('T')[0]); // Format as YYYY-MM-DD
    }
  };

  return (
    <div className="react-datepicker-wrapper">
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        inline // Display the calendar inline
        dateFormat="yyyy/MM/dd"
        className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
