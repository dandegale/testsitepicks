'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(targetDate).getTime() - now;

      if (distance < 0) {
        clearInterval(timer);
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const Unit = ({ value, label }) => (
    <div className="flex flex-col items-center px-3 py-2 bg-black/40 border border-gray-800 rounded-lg min-w-[60px]">
      <span className="text-xl font-black text-pink-500 tabular-nums">{value}</span>
      <span className="text-[8px] font-black uppercase text-gray-500 tracking-tighter">{label}</span>
    </div>
  );

  return (
    <div className="flex gap-2 animate-in fade-in zoom-in duration-700">
      <Unit value={timeLeft.days} label="Days" />
      <Unit value={timeLeft.hours} label="Hrs" />
      <Unit value={timeLeft.minutes} label="Min" />
      <Unit value={timeLeft.seconds} label="Sec" />
    </div>
  );
}