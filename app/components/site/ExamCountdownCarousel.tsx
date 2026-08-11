'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ExamCountdownItem {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
}

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
  started: boolean;
};

const accentByIndex = [
  { border: 'border-tertiary', text: 'text-tertiary', icon: 'text-tertiary' },
  { border: 'border-primary', text: 'text-primary', icon: 'text-primary' },
  { border: 'border-secondary', text: 'text-secondary', icon: 'text-secondary' },
  { border: 'border-primary', text: 'text-primary', icon: 'text-primary' },
];

function calcTimeLeft(startDate: string): TimeLeft {
  if (!startDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true, started: false };
  }
  const now = new Date();
  const taiwanNow = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
  const target = new Date(startDate);
  const examStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const todayStart = new Date(taiwanNow.getFullYear(), taiwanNow.getMonth(), taiwanNow.getDate());
  const dayDiff = Math.floor((examStart.getTime() - todayStart.getTime()) / (1000 * 3600 * 24));

  if (dayDiff < 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true, started: false };
  }
  if (dayDiff === 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: false, started: true };
  }

  const endOfDayTarget = new Date(examStart);
  endOfDayTarget.setHours(0, 0, 0, 0);
  const diffMs = endOfDayTarget.getTime() - taiwanNow.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  const seconds = Math.max(0, Math.floor((diffMs % (1000 * 60)) / 1000));
  return { days, hours, minutes, seconds, finished: false, started: false };
}

function pad(n: number, width = 2) {
  return n.toString().padStart(width, '0');
}

export default function ExamCountdownCarousel({ exams }: { exams: ExamCountdownItem[] }) {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (exams.length === 0) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [exams.length]);

  useEffect(() => {
    if (exams.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % exams.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [exams.length]);

  useEffect(() => {
    setIndex(0);
  }, [exams]);

  const current = exams[index] ?? null;
  const accent = accentByIndex[index % accentByIndex.length];

  const timeLeft = useMemo(() => {
    void tick;
    return current ? calcTimeLeft(current.startDate) : null;
  }, [current, tick]);

  if (!exams.length) {
    return (
      <div className="bg-surface-containerLowest rounded-xl shadow-elevate p-8 border-t-4 border-outline-variant text-center text-on-surfaceVariant">
        尚無考試時程資料
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="overflow-hidden">
        <AnimatePresence mode="wait">
          {current && timeLeft && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35 }}
              className={`bg-surface-containerLowest rounded-xl shadow-elevate p-6 sm:p-8 border-t-4 ${accent.border}`}
            >
              <div className="flex items-center justify-between mb-6 gap-3">
                <h3 className="font-display text-lg sm:text-xl font-bold text-on-surface flex items-center gap-2 min-w-0">
                  <i className={`fas fa-clock ${accent.icon} shrink-0`} aria-hidden />
                  <span className="truncate">距離 {current.name} 還有</span>
                </h3>
              </div>

              {timeLeft.finished ? (
                <div className="text-center py-6 text-outline font-medium">考試已結束</div>
              ) : timeLeft.started ? (
                <div className={`text-center py-6 font-display text-2xl font-bold ${accent.text}`}>考試開始</div>
              ) : (
                <div className="flex justify-between text-center gap-2 sm:gap-4">
                  {[
                    { value: pad(timeLeft.days, 3), label: '天' },
                    { value: pad(timeLeft.hours), label: '時' },
                    { value: pad(timeLeft.minutes), label: '分' },
                    { value: pad(timeLeft.seconds), label: '秒' },
                  ].map((unit) => (
                    <div key={unit.label} className="bg-surface-container rounded-lg p-3 sm:p-4 flex-1 min-w-0">
                      <div className={`font-mono text-2xl sm:text-4xl font-bold tabular-nums ${accent.text}`}>
                        {unit.value}
                      </div>
                      <div className="font-mono text-[10px] sm:text-xs font-semibold tracking-wider text-on-surfaceVariant mt-1 uppercase">
                        {unit.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 text-center text-xs text-on-surfaceVariant font-mono">
                {current.startDate}
                {current.endDate && current.endDate !== current.startDate ? ` ~ ${current.endDate}` : ''}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {exams.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {exams.map((exam, i) => (
            <button
              key={exam.id}
              type="button"
              aria-label={`切換至 ${exam.name}`}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === index ? 'bg-primary' : 'bg-outline-variant hover:bg-outline'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
