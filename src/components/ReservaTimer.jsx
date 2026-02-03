import React, { useState, useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';

const ReservaTimer = ({ createdAt, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Use ref for callback to avoid resetting timer if parent re-renders
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const created = new Date(createdAt).getTime();
    const expiry = created + 2 * 60 * 60 * 1000; // 2 hours

    const updateTimer = () => {
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft(0);
        if (onExpireRef.current) onExpireRef.current();
        return;
      }
      setTimeLeft(diff);
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  // Format MM:SS
  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const hours = Math.floor((timeLeft / 1000 / 60 / 60));
  const seconds = Math.floor((timeLeft / 1000) % 60);

  const formatTime = () => {
    if (timeLeft <= 0) return "Expirado";
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  let colorClass = 'text-green-600 bg-green-50';
  if (timeLeft < 10 * 60 * 1000) colorClass = 'text-red-600 bg-red-50 animate-pulse';
  else if (timeLeft < 30 * 60 * 1000) colorClass = 'text-yellow-600 bg-yellow-50';

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-current ${colorClass}`}>
      <Timer className="w-4 h-4" />
      <span className="font-mono font-bold text-sm">
        {formatTime()}
      </span>
    </div>
  );
};

export default ReservaTimer;