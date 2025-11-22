/**
 * 时间控制组件
 * 显示当前时间，提供前进/后退按钮
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSolarSystemStore } from '@/lib/state';

export default function TimeControl() {
  const { 
    currentTime, 
    setCurrentTime, 
    lang,
    isPlaying,
    timeSpeed,
    playDirection,
    startPlaying,
    togglePlayPause
  } = useSolarSystemStore();
  
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // 使用 useState 和 useEffect 来避免 hydration 错误
  const [realTime, setRealTime] = useState<Date | null>(null);
  
  useEffect(() => {
    // 只在客户端设置真实时间
    setRealTime(new Date());
  }, []);
  
  // 计算与当前时间的差值（天）
  const timeDiff = realTime 
    ? (currentTime.getTime() - realTime.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const absTimeDiff = Math.abs(timeDiff);
  
  // 精度阈值：超过100年（约36525天）提示精度问题
  const PRECISION_THRESHOLD_DAYS = 36525; // 100年
  const showPrecisionWarning = absTimeDiff > PRECISION_THRESHOLD_DAYS;

  // 格式化日期时间
  const formatDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

  // 速度预设值：每秒前进多少天
  // 1天 = 1天，1月 ≈ 30天，1年 = 365天
  const speedPresets = [
    { value: 1, label: lang === 'zh' ? '天' : 'Day' },      // 每秒前进1天
    { value: 30, label: lang === 'zh' ? '月' : 'Month' },   // 每秒前进30天（约1个月）
    { value: 365, label: lang === 'zh' ? '年' : 'Year' },   // 每秒前进365天（1年）
  ];

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

  // 处理时间前进/后退按钮点击
  const handleSpeedButtonClick = (speed: number, direction: 'forward' | 'backward') => {
    // 如果当前正在播放且速度和方向相同，则暂停
    if (isPlaying && timeSpeed === speed && playDirection === direction) {
      useSolarSystemStore.getState().togglePlayPause();
    } else {
      // 否则开始播放（或切换速度和方向）
      startPlaying(speed, direction);
    }
  };

  // 处理"现在"按钮点击
  const handleNowClick = () => {
    const now = new Date();
    setCurrentTime(now);
    // 如果正在播放，继续播放；否则不自动播放
  };

  return (
    <>
      <div className="w-full bg-black/90 backdrop-blur-sm border-b border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-2.5">
          {/* 主控制行：速度按钮（左） | 时间显示 | 速度按钮（右） */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* 左侧速度按钮组 - 后退 */}
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 flex-shrink-0">
              <span className="text-white text-xs font-medium hidden sm:inline">
                {lang === 'zh' ? '后退' : 'Back'}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {/* 反转排序，与前进按钮相反 */}
                {speedPresets.slice().reverse().map((preset) => {
                  const isActive = isPlaying && timeSpeed === preset.value && playDirection === 'backward';
                  return (
                    <button
                      key={`back-${preset.value}`}
                      onClick={() => handleSpeedButtonClick(preset.value, 'backward')}
                      className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                        isActive
                          ? 'bg-red-500 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                      title={`${lang === 'zh' ? '后退速度' : 'Backward speed'}: ${preset.value}x`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 中间时间显示区域 */}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0 px-2 relative">
              <div className="flex items-center gap-2">
                {/* 暂停/播放按钮 */}
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
                
                {/* 时间显示 */}
                <div className="text-white text-sm sm:text-lg font-mono font-semibold" suppressHydrationWarning>
                  {formatDateTime(currentTime)}
                </div>
                
                {/* 日历按钮 */}
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
              </div>

              {/* 时间差显示和"现在"按钮 */}
              <div className="flex items-center gap-2">
                {absTimeDiff > 0.01 && realTime ? (
                  <>
                    <div className={`text-xs font-medium ${timeDiff > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
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
                  <div className="text-xs font-medium text-green-400">
                    {lang === 'zh' ? '现在' : 'Now'}
                  </div>
                )}
              </div>
              
              {/* 精度警告 */}
              {showPrecisionWarning && (
                <div className="text-xs text-yellow-400 flex items-center gap-1 font-medium">
                  <span>⚠️</span>
                  <span>{lang === 'zh' ? '时移较远，精度可能降低' : 'Time shift is large, accuracy may be reduced'}</span>
                </div>
              )}
            </div>

            {/* 右侧速度按钮组 - 前进 */}
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-1">
                {speedPresets.map((preset) => {
                  const isActive = isPlaying && timeSpeed === preset.value && playDirection === 'forward';
                  return (
                    <button
                      key={`forward-${preset.value}`}
                      onClick={() => handleSpeedButtonClick(preset.value, 'forward')}
                      className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                        isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                      title={`${lang === 'zh' ? '前进速度' : 'Forward speed'}: ${preset.value}x`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-white text-xs font-medium hidden sm:inline">
                {lang === 'zh' ? '前进' : 'Forward'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 隐藏的日期输入框，用于直接打开日历选择器 */}
      <input
        ref={dateInputRef}
        type="date"
        value={formatDate(currentTime)}
        onChange={handleDateChange}
        className="hidden"
        max={formatDate(new Date(2100, 11, 31))}
        min={formatDate(new Date(1900, 0, 1))}
      />
    </>
  );
}
