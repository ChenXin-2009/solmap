/**
 * Integrated Time Control Component
 * 
 * Updated version of TimeControl that uses the Space-Time Foundation
 * Time Authority instead of direct state management.
 * 
 * Key changes:
 * 1. Uses RenderingIntegrationAdapter for time access
 * 2. Subscribes to Time Authority for time updates
 * 3. No direct time manipulation - all through Time Authority
 * 4. Maintains backward compatibility with existing UI
 */

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getRenderingAdapter } from '@/lib/space-time-foundation/rendering-integration';

// Language type
type Language = 'en' | 'zh';

// Props interface for the component
interface TimeControlIntegratedProps {
  lang?: Language;
  onLanguageChange?: (lang: Language) => void;
}

// Use throttling to reduce time display update frequency
function useThrottledTime(currentTime: Date, interval: number = 100) {
  const [throttledTime, setThrottledTime] = useState(currentTime);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current >= interval) {
      setThrottledTime(currentTime);
      lastUpdateRef.current = now;
    } else {
      const timeoutId = setTimeout(() => {
        setThrottledTime(currentTime);
        lastUpdateRef.current = Date.now();
      }, interval - (now - lastUpdateRef.current));
      return () => clearTimeout(timeoutId);
    }
  }, [currentTime, interval]);

  return throttledTime;
}

// Optimized TimeControl component using React.memo
const TimeControlIntegrated = React.memo<TimeControlIntegratedProps>(({ 
  lang = 'zh',
  onLanguageChange 
}) => {
  // Local state for time and playback
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [playDirection, setPlayDirection] = useState<'forward' | 'backward'>('forward');
  const [realTime, setRealTime] = useState<Date | null>(null);
  
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Get the rendering adapter
  const adapter = getRenderingAdapter();
  
  useEffect(() => {
    // Set real time only on client side
    setRealTime(new Date());
    
    // Subscribe to time updates from Time Authority
    const unsubscribe = adapter.subscribeToTime((julianDate) => {
      // Convert Julian Date to JavaScript Date
      const jsDate = adapter.getCurrentTime();
      setCurrentTime(jsDate);
    });
    
    // Initial time sync
    if (adapter.isReady()) {
      const initialTime = adapter.getCurrentTime();
      setCurrentTime(initialTime);
    }
    
    return unsubscribe;
  }, [adapter]);
  
  // Use throttled time to reduce re-render frequency (every 100ms instead of every frame)
  const displayTime = useThrottledTime(currentTime, 100);
  
  // Calculate time difference from current time (in days)
  const timeDiff = realTime 
    ? (displayTime.getTime() - realTime.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const absTimeDiff = Math.abs(timeDiff);
  
  // Precision threshold: warn if more than 100 years (~36525 days)
  const PRECISION_THRESHOLD_DAYS = 36525; // 100 years
  const showPrecisionWarning = absTimeDiff > PRECISION_THRESHOLD_DAYS;

  // Format date and time functions
  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format time difference
  const formatTimeDiff = (days: number): string => {
    const absDays = Math.abs(days);
    if (absDays < 1) {
      const hours = Math.floor(absDays * 24);
      const minutes = Math.floor((absDays * 24 - hours) * 60);
      if (hours > 0) {
        return lang === 'zh' ? `${hours}小时${minutes}分钟` : `${hours}h ${minutes}m`;
      }
      return lang === 'zh' ? `${minutes}分钟` : `${minutes}m`;
    } else if (absDays < 365) {
      const daysInt = Math.floor(absDays);
      return lang === 'zh' ? `${daysInt}天` : `${daysInt} days`;
    } else {
      const years = Math.floor(absDays / 365.25);
      const remainingDays = Math.floor(absDays % 365.25);
      if (remainingDays > 0) {
        return lang === 'zh' ? `${years}年${remainingDays}天` : `${years}y ${remainingDays}d`;
      }
      return lang === 'zh' ? `${years}年` : `${years} years`;
    }
  };

  // Speed presets: how many days to advance per second
  const speedPresets = [
    { value: 1, label: lang === 'zh' ? '天' : 'Day', type: 'day' },      // 1 day per second
    { value: 30, label: lang === 'zh' ? '月' : 'Month', type: 'month' },   // 30 days per second (~1 month)
    { value: 365, label: lang === 'zh' ? '年' : 'Year', type: 'year' },   // 365 days per second (1 year)
  ];

  // Handle date selection
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      // Keep current time's hours, minutes, seconds
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      const seconds = currentTime.getSeconds();
      newDate.setHours(hours, minutes, seconds);
      
      // TODO: Integrate with Time Authority to set time
      // For now, just update local state
      setCurrentTime(newDate);
    }
  };

  // Handle calendar button click
  const handleCalendarClick = () => {
    if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  // Handle speed button clicks
  const handleSpeedButtonClick = (speed: number, direction: 'forward' | 'backward') => {
    // If currently playing with same speed and direction, pause
    if (isPlaying && timeSpeed === speed && playDirection === direction) {
      setIsPlaying(false);
    } else {
      // Otherwise start playing (or change speed and direction)
      setTimeSpeed(speed);
      setPlayDirection(direction);
      setIsPlaying(true);
    }
  };

  // Handle "Now" button click
  const handleNowClick = () => {
    const now = new Date();
    setCurrentTime(now);
    // TODO: Integrate with Time Authority to set time to now
  };

  // Handle play/pause toggle
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <>
      {/* Main control row: speed buttons (left) | time display | speed buttons (right) */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 sm:py-2.5" style={{ willChange: 'auto', transform: 'translateZ(0)', pointerEvents: 'auto' }}>
        {/* Center time display area */}
        <div className="flex flex-col items-center gap-1 min-w-0 px-2 relative">
          <div className="flex items-center gap-2">
            {/* Backward button group - year/month/day (arrows pointing left) */}
            <div className="flex items-center gap-1">
              {speedPresets.slice().reverse().map((preset) => {
                const isActive = isPlaying && timeSpeed === preset.value && playDirection === 'backward';
                return (
                  <button
                    key={`back-${preset.value}`}
                    onClick={() => handleSpeedButtonClick(preset.value, 'backward')}
                    className={`p-1.5 rounded transition-colors ${
                      isActive
                        ? 'bg-red-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={`${lang === 'zh' ? '后退速度' : 'Backward speed'}: ${preset.value}x (${preset.label})`}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                );
              })}
            </div>
            
            {/* Pause/Play button */}
            <button
              onClick={togglePlayPause}
              className={`p-1.5 rounded transition-colors ${
                isPlaying
                  ? 'bg-red-500/80 hover:bg-red-500 text-white'
                  : 'bg-green-500/80 hover:bg-green-500 text-white'
              }`}
              title={isPlaying ? (lang === 'zh' ? '暂停' : 'Pause') : (lang === 'zh' ? '播放' : 'Play')}
            >
              {isPlaying ? (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              ) : (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              )}
            </button>
            
            {/* Time display - year/month/day on top, hour/minute/second below */}
            <div className="flex flex-col items-center gap-0.5">
              {/* Year/Month/Day */}
              <div className="text-white text-sm sm:text-base font-mono font-semibold" suppressHydrationWarning>
                {formatDate(displayTime)}
              </div>
              {/* Hour/Minute/Second - larger font */}
              <div className="text-white text-base sm:text-xl font-mono font-semibold" suppressHydrationWarning>
                {formatTime(displayTime)}
              </div>
            </div>
            
            {/* Calendar button */}
            <button
              ref={calendarButtonRef}
              onClick={handleCalendarClick}
              className="text-white hover:text-blue-400 transition-colors cursor-pointer p-1"
              title={lang === 'zh' ? '选择日期' : 'Select date'}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-white"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
            
            {/* Forward button group - year/month/day (arrows pointing right) */}
            <div className="flex items-center gap-1">
              {speedPresets.map((preset) => {
                const isActive = isPlaying && timeSpeed === preset.value && playDirection === 'forward';
                return (
                  <button
                    key={`forward-${preset.value}`}
                    onClick={() => handleSpeedButtonClick(preset.value, 'forward')}
                    className={`p-1.5 rounded transition-colors ${
                      isActive
                        ? 'bg-green-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={`${lang === 'zh' ? '前进速度' : 'Forward speed'}: ${preset.value}x (${preset.label})`}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time difference display and "Now" button */}
          <div className="flex items-center gap-2">
            {absTimeDiff > 0.01 && realTime ? (
              <>
                <div className={`text-xs font-bold ${timeDiff > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                  {timeDiff > 0 
                    ? (lang === 'zh' ? `未来 ${formatTimeDiff(timeDiff)}` : `Future ${formatTimeDiff(timeDiff)}`)
                    : (lang === 'zh' ? `过去 ${formatTimeDiff(absTimeDiff)}` : `Past ${formatTimeDiff(absTimeDiff)}`)
                  }
                </div>
                <button
                  onClick={handleNowClick}
                  className="px-2 py-0.5 text-xs bg-blue-500/80 hover:bg-blue-500 text-white rounded transition-colors font-medium"
                  title={lang === 'zh' ? '跳转到现在' : 'Jump to now'}
                >
                  {lang === 'zh' ? '现在' : 'Now'}
                </button>
              </>
            ) : (
              <div className="text-xs font-bold text-green-400">
                {lang === 'zh' ? '现在' : 'Now'}
              </div>
            )}
          </div>
          
          {/* Precision warning */}
          {showPrecisionWarning && (
            <div className="text-xs text-yellow-400 flex items-center gap-1 font-medium">
              <span>⚠️</span>
              <span>{lang === 'zh' ? '时移较远，精度可能降低' : 'Time shift is large, accuracy may be reduced'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden date input for calendar picker */}
      <input
        ref={dateInputRef}
        type="date"
        value={formatDate(displayTime)}
        onChange={handleDateChange}
        className="hidden"
        max={formatDate(new Date(2100, 11, 31))}
        min={formatDate(new Date(1900, 0, 1))}
      />
    </>  
  );
});

TimeControlIntegrated.displayName = 'TimeControlIntegrated';

export default TimeControlIntegrated;