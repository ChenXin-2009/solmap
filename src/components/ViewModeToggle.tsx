/**
 * ViewModeToggle.tsx - 2D/3D 视图模式切换滑块
 * 带切换动效，位于左下角
 */

'use client';

import React, { useState } from 'react';
import { useSolarSystemStore } from '@/lib/state';

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useSolarSystemStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleToggle = (mode: '2d' | '3d') => {
    if (mode === viewMode || isTransitioning) return;
    
    setIsTransitioning(true);
    setIsLoading(true);
    
    // 延迟切换，给用户视觉反馈
    setTimeout(() => {
      setViewMode(mode);
      setIsLoading(false);
      
      // 切换完成后，再等待一小段时间解除过渡状态
      setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
    }, 150);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* 加载动画 */}
      {isLoading && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2 bg-black/90 backdrop-blur-md text-white px-3 py-2 rounded-lg shadow-2xl border border-white/20">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">切换中...</span>
          </div>
        </div>
      )}
      
      {/* 滑块切换器 */}
      <div className="relative bg-black/90 backdrop-blur-md rounded-full p-1 shadow-2xl border border-white/20">
        <div className="flex relative">
          {/* 背景滑块 - 平滑滑动动画 */}
          <div
            className={`absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out shadow-lg ${
              viewMode === '2d' ? 'left-1 w-[3.5rem]' : 'left-[3.75rem] w-[3.5rem]'
            }`}
            style={{
              transition: 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
          
          {/* 按钮 */}
          <button
            onClick={() => handleToggle('2d')}
            disabled={isTransitioning}
            className={`relative z-10 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 min-w-[3.5rem] ${
              viewMode === '2d'
                ? 'text-white drop-shadow-lg'
                : 'text-gray-400 hover:text-gray-200'
            } ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'}`}
          >
            2D
          </button>
          
          <button
            onClick={() => handleToggle('3d')}
            disabled={isTransitioning}
            className={`relative z-10 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 min-w-[3.5rem] ${
              viewMode === '3d'
                ? 'text-white drop-shadow-lg'
                : 'text-gray-400 hover:text-gray-200'
            } ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'}`}
          >
            3D
          </button>
        </div>
      </div>
    </div>
  );
}

