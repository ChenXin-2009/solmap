/**
 * 时间控制组件
 * 显示当前时间，提供前进/后退按钮
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSolarSystemStore } from '@/lib/state';

export default function TimeControl() {
  const { 
    currentTime, 
    setCurrentTime, 
    lang,
    isPlaying,
    togglePlayPause,
    timeSpeed,
    setTimeSpeed
  } = useSolarSystemStore();
  
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

  // 时间步进（天）
  const stepDays = (days: number) => {
    const newTime = new Date(currentTime.getTime() + days * 24 * 60 * 60 * 1000);
    setCurrentTime(newTime);
  };

  // 快速步进（年）
  const stepYears = (years: number) => {
    const newTime = new Date(currentTime);
    newTime.setFullYear(newTime.getFullYear() + years);
    setCurrentTime(newTime);
  };

  // 速度预设值
  const speedPresets = [
    { value: 0.1, label: lang === 'zh' ? '0.1x' : '0.1x' },
    { value: 1, label: lang === 'zh' ? '1x' : '1x' },
    { value: 10, label: lang === 'zh' ? '10x' : '10x' },
    { value: 100, label: lang === 'zh' ? '100x' : '100x' },
    { value: 1000, label: lang === 'zh' ? '1000x' : '1000x' },
  ];

  return (
    <div className="w-full bg-black/90 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        {/* 第一行：时间步进按钮和时间显示 */}
        <div className="flex items-center justify-between gap-4 mb-2">
          {/* 后退按钮组 */}
          <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => stepYears(-10)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '后退10年' : 'Rewind 10 years'}
          >
            {lang === 'zh' ? '<< 10年' : '<< 10y'}
          </button>
          <button
            onClick={() => stepYears(-1)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '后退1年' : 'Rewind 1 year'}
          >
            {lang === 'zh' ? '< 1年' : '< 1y'}
          </button>
          <button
            onClick={() => stepDays(-30)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '后退30天' : 'Rewind 30 days'}
          >
            {lang === 'zh' ? '< 30天' : '< 30d'}
          </button>
          <button
            onClick={() => stepDays(-1)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '后退1天' : 'Rewind 1 day'}
          >
            {lang === 'zh' ? '< 1天' : '< 1d'}
          </button>
        </div>

        {/* 当前时间显示 */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div className="text-white text-lg font-mono font-semibold" suppressHydrationWarning>
            {formatDateTime(currentTime)}
          </div>
          {absTimeDiff > 0.01 && realTime && (
            <div className={`text-xs font-medium ${timeDiff > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              {timeDiff > 0 
                ? (lang === 'zh' ? `未来 ${formatTimeDiff(timeDiff)}` : `Future ${formatTimeDiff(timeDiff)}`)
                : (lang === 'zh' ? `过去 ${formatTimeDiff(absTimeDiff)}` : `Past ${formatTimeDiff(absTimeDiff)}`)
              }
            </div>
          )}
          {showPrecisionWarning && (
            <div className="text-xs text-yellow-400 flex items-center gap-1 font-medium">
              <span>⚠️</span>
              <span>{lang === 'zh' ? '时移较远，精度可能降低' : 'Time shift is large, accuracy may be reduced'}</span>
            </div>
          )}
        </div>

          {/* 前进按钮组 */}
          <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => stepDays(1)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '前进1天' : 'Forward 1 day'}
          >
            {lang === 'zh' ? '1天 >' : '1d >'}
          </button>
          <button
            onClick={() => stepDays(30)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '前进30天' : 'Forward 30 days'}
          >
            {lang === 'zh' ? '30天 >' : '30d >'}
          </button>
          <button
            onClick={() => stepYears(1)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '前进1年' : 'Forward 1 year'}
          >
            {lang === 'zh' ? '1年 >' : '1y >'}
          </button>
          <button
            onClick={() => stepYears(10)}
            className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded transition-colors font-medium"
            title={lang === 'zh' ? '前进10年' : 'Forward 10 years'}
          >
            {lang === 'zh' ? '10年 >>' : '10y >>'}
          </button>
        </div>
        </div>

        {/* 第二行：播放控制和速度控制 */}
        <div className="flex items-center justify-center gap-4">
          {/* 播放/暂停按钮 */}
          <button
            onClick={togglePlayPause}
            className={`px-4 py-1.5 text-sm rounded transition-colors font-medium ${
              isPlaying
                ? 'bg-red-500/80 hover:bg-red-500 text-white'
                : 'bg-green-500/80 hover:bg-green-500 text-white'
            }`}
            title={isPlaying ? (lang === 'zh' ? '暂停' : 'Pause') : (lang === 'zh' ? '播放' : 'Play')}
          >
            {isPlaying ? (lang === 'zh' ? '⏸ 暂停' : '⏸ Pause') : (lang === 'zh' ? '▶ 播放' : '▶ Play')}
          </button>

          {/* 速度控制 */}
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-medium">
              {lang === 'zh' ? '速度:' : 'Speed:'}
            </span>
            <div className="flex items-center gap-1">
              {speedPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setTimeSpeed(preset.value)}
                  className={`px-2 py-1 text-xs rounded transition-colors font-medium ${
                    timeSpeed === preset.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={`${lang === 'zh' ? '速度' : 'Speed'}: ${preset.value}x`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* 自定义速度输入 */}
            <input
              type="number"
              min="0.1"
              max="1000"
              step="0.1"
              value={timeSpeed}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  setTimeSpeed(value);
                }
              }}
              className="w-16 px-2 py-1 text-xs bg-white/10 text-white rounded border border-white/20 focus:border-blue-500 focus:outline-none"
              title={lang === 'zh' ? '自定义速度' : 'Custom speed'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

