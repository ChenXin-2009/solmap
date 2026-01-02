/**
 * 时间控制组件
 * 显示当前时间，提供弧形滑块控制时间流速
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSolarSystemStore } from '@/lib/state';
import TimeSlider from './TimeSlider';
import { TIME_CONTROL_CONFIG, TIME_SLIDER_CONFIG } from '@/lib/config/visualConfig';

// 使用节流来减少时间显示的更新频率
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

// 使用 React.memo 和选择器优化性能
const TimeControl = React.memo(() => {
  // 只订阅需要的状态，避免频繁重渲染
  const currentTime = useSolarSystemStore((state) => state.currentTime);
  const setCurrentTime = useSolarSystemStore((state) => state.setCurrentTime);
  const lang = useSolarSystemStore((state) => state.lang);
  const cameraDistance = useSolarSystemStore((state) => state.cameraDistance);
  
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // 使用 useState 和 useEffect 来避免 hydration 错误
  const [realTime, setRealTime] = useState<Date | null>(null);
  
  // 计算时间控件的透明度（3000AU 开始淡出，5000AU 完全隐藏）
  const TIME_CONTROL_FADE_START = 3000;
  const TIME_CONTROL_FADE_END = 5000;
  let timeControlOpacity = 1;
  if (cameraDistance >= TIME_CONTROL_FADE_END) {
    timeControlOpacity = 0;
  } else if (cameraDistance > TIME_CONTROL_FADE_START) {
    timeControlOpacity = 1 - (cameraDistance - TIME_CONTROL_FADE_START) / (TIME_CONTROL_FADE_END - TIME_CONTROL_FADE_START);
  }
  
  useEffect(() => {
    // 只在客户端设置真实时间
    setRealTime(new Date());
  }, []);
  
  // 使用节流的时间，减少重渲染频率（每100ms更新一次，而不是每帧）
  const displayTime = useThrottledTime(currentTime, 100);
  
  // 计算与当前时间的差值（天）- 使用节流后的时间
  const timeDiff = realTime 
    ? (displayTime.getTime() - realTime.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const absTimeDiff = Math.abs(timeDiff);
  
  // 精度阈值：超过100年（约36525天）提示精度问题
  const PRECISION_THRESHOLD_DAYS = 36525; // 100年
  const showPrecisionWarning = absTimeDiff > PRECISION_THRESHOLD_DAYS;

  // 格式化时间（时分秒）
  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // 格式化日期（用于日期选择器）
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 格式化时间差
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

  // 处理日期选择
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      // 保持当前时间的小时、分钟、秒
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      const seconds = currentTime.getSeconds();
      newDate.setHours(hours, minutes, seconds);
      setCurrentTime(newDate);
    }
  };

  // 处理日历按钮点击，直接打开日历选择器
  const handleCalendarClick = () => {
    if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  // 处理"现在"按钮点击
  const handleNowClick = () => {
    const now = new Date();
    setCurrentTime(now);
  };

  // 如果完全透明，不渲染
  if (timeControlOpacity <= 0) {
    return null;
  }

  const cfg = TIME_CONTROL_CONFIG;

  return (
    <>
      {/* 主控制行：日期 | 状态/日历 | 时间 */}
      <div 
        className="absolute left-0 right-0 z-10 flex flex-col items-center px-2 sm:px-4" 
        style={{ 
          bottom: `${cfg.bottomOffset}px`,
          gap: `${cfg.gapMobile}px`,
          willChange: 'auto', 
          transform: 'translateZ(0)', 
          pointerEvents: 'none',
          opacity: timeControlOpacity,
          transition: 'opacity 0.3s ease-out',
        }}
      >
        {/* 时间信息行 - 一行显示，使用固定宽度中间区域，禁止换行 */}
        <div 
          className="flex items-center justify-center flex-nowrap" 
          style={{ 
            pointerEvents: 'none',
            gap: `${cfg.gapMobile}px`,
            flexWrap: 'nowrap',
          }}
        >
          {/* 左边：日期 - 固定宽度右对齐 */}
          <div 
            className="font-mono font-semibold text-right" 
            style={{ 
              pointerEvents: 'none', 
              color: cfg.textColor,
              fontSize: `${cfg.dateTimeSizeMobile}px`,
              width: `${cfg.dateTimeWidth}px`,
              flexShrink: 0,
            }} 
            suppressHydrationWarning
          >
            {formatDate(displayTime)}
          </div>
          
          {/* 中间：时间差/现在 + 日历按钮 - 固定宽度居中 */}
          <div 
            className="flex items-center justify-center gap-2" 
            style={{ 
              pointerEvents: 'none',
              width: `${cfg.middleSectionWidth}px`,
              flexShrink: 0,
            }}
          >
            {absTimeDiff > 0.01 && realTime ? (
              <>
                <div 
                  className="font-bold" 
                  style={{ 
                    pointerEvents: 'none', 
                    color: timeDiff > 0 ? cfg.futureColor : cfg.pastColor,
                    fontSize: `${cfg.timeDiffSizeMobile}px`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {timeDiff > 0 
                    ? (lang === 'zh' ? `未来 ${formatTimeDiff(timeDiff)}` : `+${formatTimeDiff(timeDiff)}`)
                    : (lang === 'zh' ? `过去 ${formatTimeDiff(absTimeDiff)}` : `-${formatTimeDiff(absTimeDiff)}`)
                  }
                </div>
                <button
                  onClick={handleNowClick}
                  className="transition-colors font-medium"
                  title={lang === 'zh' ? '跳转到现在' : 'Jump to now'}
                  style={{ 
                    pointerEvents: 'auto',
                    backgroundColor: cfg.nowButtonBg,
                    color: cfg.nowButtonTextColor,
                    fontSize: `${cfg.nowButtonTextSize}px`,
                    padding: cfg.nowButtonPadding,
                    borderRadius: `${cfg.nowButtonRadius}px`,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cfg.nowButtonHoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = cfg.nowButtonBg}
                >
                  {lang === 'zh' ? '现在' : 'Now'}
                </button>
              </>
            ) : (
              <div 
                className="font-bold" 
                style={{ 
                  pointerEvents: 'none', 
                  color: cfg.nowColor,
                  fontSize: `${cfg.timeDiffSizeMobile}px`,
                }}
              >
                {lang === 'zh' ? '现在' : 'Now'}
              </div>
            )}
            
            {/* 日历按钮 */}
            <button
              ref={calendarButtonRef}
              onClick={handleCalendarClick}
              className="transition-colors cursor-pointer p-0.5"
              title={lang === 'zh' ? '选择日期' : 'Select date'}
              style={{ pointerEvents: 'auto', color: cfg.calendarButtonColor }}
              onMouseEnter={(e) => e.currentTarget.style.color = cfg.calendarButtonHoverColor}
              onMouseLeave={(e) => e.currentTarget.style.color = cfg.calendarButtonColor}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width={cfg.calendarButtonSize} 
                height={cfg.calendarButtonSize} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
          </div>
          
          {/* 右边：时间 - 固定宽度左对齐 */}
          <div 
            className="font-mono font-semibold text-left" 
            style={{ 
              pointerEvents: 'none', 
              color: cfg.textColor,
              fontSize: `${cfg.dateTimeSizeMobile}px`,
              width: `${cfg.dateTimeWidth}px`,
              flexShrink: 0,
            }} 
            suppressHydrationWarning
          >
            {formatTime(displayTime)}
          </div>
        </div>
        
        {/* 精度警告 */}
        {showPrecisionWarning && (
          <div 
            className="flex items-center gap-1 font-medium" 
            style={{ 
              pointerEvents: 'none', 
              color: cfg.warningColor,
              fontSize: `${cfg.warningSize}px`,
            }}
          >
            <span>⚠️</span>
            <span>{lang === 'zh' ? '精度可能降低' : 'Accuracy may be reduced'}</span>
          </div>
        )}

        {/* 弧形时间滑块 */}
        <div style={{ pointerEvents: 'auto' }}>
          <TimeSlider width={TIME_SLIDER_CONFIG.width} height={TIME_SLIDER_CONFIG.height} />
        </div>
      </div>

      {/* 隐藏的日期输入框，用于直接打开日历选择器 */}
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

export default TimeControl;
