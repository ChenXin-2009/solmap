/**
 * ViewModeToggle.tsx - 2D/3D 视图模式切换滑块
 * 带切换动效，位于左下角
 */

'use client';

import React, { useState } from 'react';
import { useSolarSystemStore } from '@/lib/state';

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响切换按钮的显示效果

// 切换按钮配置
const TOGGLE_CONFIG = {
  // 🔧 按钮位置（相对于屏幕）
  position: {
    bottom: '2.5rem', // 距离底部距离（对应 bottom-6 = 1.5rem）
    left: '2.5rem',   // 距离左边距离（对应 left-6 = 1.5rem）
  },
  
  // 🔧 容器样式
  container: {
    padding: '0.25rem', // 容器内边距（对应 p-1 = 0.25rem = 4px）
  },
  
  // 🔧 按钮样式
  button: {
    paddingX: '1rem',      // 按钮左右内边距（对应 px-4 = 1rem = 16px）
    paddingY: '0.5rem',    // 按钮上下内边距（对应 py-2 = 0.5rem = 8px）
    minWidth: '2rem',   // 按钮最小宽度（对应 min-w-[3.5rem] = 3.5rem = 56px）
  },
  
  // 🔧 蓝色椭圆滑块样式
  slider: {
    // 3D 模式位置（相对于容器左边，现在在左边）
    position3D: '0.25rem', // left-1 = 0.25rem = 4px
    // 2D 模式位置（相对于容器左边，现在在右边）
    position2D: '3rem',  // left-[5.75rem] = 5.75rem = 92px
    // 滑块宽度（覆盖整个按钮包括 padding）
    width: '3rem',        // w-[5.5rem] = 5.5rem = 88px (56px + 32px)
    // 滑块顶部和底部边距（相对于容器）
    marginTop: '0.25rem',   // top-1 = 0.25rem = 4px
    marginBottom: '0.25rem', // bottom-1 = 0.25rem = 4px
  },
  
  // 🔧 动画配置
  animation: {
    duration: 400, // 动画持续时间（毫秒）
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // 缓动函数
  },
};

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

  // 计算滑块位置（使用配置参数）
  // 注意：现在3D在左边，2D在右边，所以滑块位置需要对应调整
  const sliderLeft3D = TOGGLE_CONFIG.slider.position3D; // 3D在左边
  const sliderLeft2D = TOGGLE_CONFIG.slider.position2D; // 2D在右边
  const sliderWidth = TOGGLE_CONFIG.slider.width;
  const sliderTop = TOGGLE_CONFIG.slider.marginTop;
  const sliderBottom = TOGGLE_CONFIG.slider.marginBottom;

  return (
    <div 
      className="fixed z-50"
      style={{
        bottom: TOGGLE_CONFIG.position.bottom,
        left: TOGGLE_CONFIG.position.left,
      }}
    >
      {/* 加载动画 */}
      {isLoading && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]">
          <div className="flex items-center gap-2 bg-black/90 backdrop-blur-md text-white px-3 py-2 rounded-lg shadow-2xl border border-white/20">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">切换中...</span>
          </div>
        </div>
      )}
      
      {/* 滑块切换器 */}
      <div 
        className="relative bg-black/90 backdrop-blur-md rounded-full shadow-2xl border border-white/20"
        style={{ padding: TOGGLE_CONFIG.container.padding }}
      >
        <div className="flex relative">
          {/* 背景滑块 - 平滑滑动动画 */}
          <div
            className="absolute rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all ease-out shadow-lg"
            style={{
              left: viewMode === '3d' ? sliderLeft3D : sliderLeft2D,
              width: sliderWidth,
              top: sliderTop,
              bottom: sliderBottom,
              transition: `left ${TOGGLE_CONFIG.animation.duration}ms ${TOGGLE_CONFIG.animation.easing}, width ${TOGGLE_CONFIG.animation.duration}ms ${TOGGLE_CONFIG.animation.easing}`,
            }}
          />
          
          {/* 按钮 - 3D在左边，2D在右边 */}
          <button
            onClick={() => handleToggle('3d')}
            disabled={isTransitioning}
            className={`relative z-10 rounded-full text-sm font-semibold transition-all duration-300 ${
              viewMode === '3d'
                ? 'text-white drop-shadow-lg'
                : 'text-gray-400 hover:text-gray-200'
            } ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'}`}
            style={{
              paddingLeft: TOGGLE_CONFIG.button.paddingX,
              paddingRight: TOGGLE_CONFIG.button.paddingX,
              paddingTop: TOGGLE_CONFIG.button.paddingY,
              paddingBottom: TOGGLE_CONFIG.button.paddingY,
              minWidth: TOGGLE_CONFIG.button.minWidth,
            }}
          >
            3D
          </button>
          
          <button
            onClick={() => handleToggle('2d')}
            disabled={isTransitioning}
            className={`relative z-10 rounded-full text-sm font-semibold transition-all duration-300 ${
              viewMode === '2d'
                ? 'text-white drop-shadow-lg'
                : 'text-gray-400 hover:text-gray-200'
            } ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'}`}
            style={{
              paddingLeft: TOGGLE_CONFIG.button.paddingX,
              paddingRight: TOGGLE_CONFIG.button.paddingX,
              paddingTop: TOGGLE_CONFIG.button.paddingY,
              paddingBottom: TOGGLE_CONFIG.button.paddingY,
              minWidth: TOGGLE_CONFIG.button.minWidth,
            }}
          >
            2D
          </button>
        </div>
      </div>
    </div>
  );
}

