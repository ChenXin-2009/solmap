/**
 * SettingsMenu.tsx - 设置菜单
 * 位于右下角，点击按钮弹出设置菜单
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响设置菜单的显示效果

// 设置菜单配置
const SETTINGS_CONFIG = {
  // 🔧 按钮位置（相对于屏幕）
  position: {
    bottom: '2rem', // 距离底部距离（对应 bottom-6 = 1.5rem）
    right: '2rem',  // 距离右边距离（对应 right-6 = 1.5rem）
  },
  
  // 🔧 按钮样式
  button: {
    size: '3rem',    // 按钮大小（对应 w-10 h-10 = 2.5rem = 40px）
    iconSize: '2rem', // 图标大小（对应 w-5 h-5 = 1.25rem = 20px）
  },
  
  // 🔧 菜单样式
  menu: {
    width: '16rem',    // 菜单宽度（对应 w-64 = 16rem = 256px）
    maxHeight: '20rem', // 菜单最大高度（对应 max-h-80 = 20rem = 320px）
    padding: '1rem',    // 菜单内边距（对应 p-4 = 1rem = 16px）
    gap: '0.75rem',    // 菜单项间距（对应 gap-3 = 0.75rem = 12px）
  },
  
  // 🔧 切换开关样式（类似 2D/3D 切换）
  toggle: {
    container: {
      padding: '0.25rem', // 容器内边距（对应 p-1 = 0.25rem = 4px）
    },
    button: {
      paddingX: '0.75rem',  // 按钮左右内边距（对应 px-3 = 0.75rem = 12px）
      paddingY: '0.5rem',    // 按钮上下内边距（对应 py-2 = 0.5rem = 8px）
      minWidth: '3rem',    // 按钮最小宽度（对应 min-w-[3rem] = 3rem = 48px）
    },
    slider: {
      positionNormal: '0.25rem',   // 正常模式位置（对应 left-1 = 0.25rem = 4px）
      positionWide: '3.25rem',       // 超广角模式位置（对应 left-[4.25rem] = 4.25rem = 68px）
      width: '3rem',             // 滑块宽度（对应 w-[3.75rem] = 3.75rem = 60px）
      marginTop: '0.25rem',         // 滑块顶部边距（对应 top-1 = 0.25rem = 4px）
      marginBottom: '0.25rem',      // 滑块底部边距（对应 bottom-1 = 0.25rem = 4px）
    },
    animation: {
      duration: 300, // 动画持续时间（毫秒）
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // 缓动函数
    },
  },
};

interface SettingsMenuProps {
  cameraController: any; // CameraController 实例
}

export default function SettingsMenu({ cameraController }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWideAngle, setIsWideAngle] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // 切换超广角模式
  const handleWideAngleToggle = (wide: boolean) => {
    setIsWideAngle(wide);
    if (cameraController) {
      // 正常模式：45度，超广角模式：120度
      const fov = wide ? 120 : 45;
      cameraController.setFov(fov, true); // 传入 true 表示需要平滑过渡
    }
  };

  // 计算滑块位置
  const sliderLeftNormal = SETTINGS_CONFIG.toggle.slider.positionNormal;
  const sliderLeftWide = SETTINGS_CONFIG.toggle.slider.positionWide;
  const sliderWidth = SETTINGS_CONFIG.toggle.slider.width;
  const sliderTop = SETTINGS_CONFIG.toggle.slider.marginTop;
  const sliderBottom = SETTINGS_CONFIG.toggle.slider.marginBottom;

  return (
    <>
      {/* 设置按钮 */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onTouchStart={(e) => {
          // 确保触摸事件被正确处理，不被父元素阻止
          e.stopPropagation();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
        }}
        className="fixed bg-black/90 backdrop-blur-md rounded-full shadow-2xl border border-white/20 hover:bg-black/95 active:bg-black/95 transition-all duration-300 flex items-center justify-center touch-manipulation pointer-events-auto"
        style={{
          bottom: SETTINGS_CONFIG.position.bottom,
          right: SETTINGS_CONFIG.position.right,
          width: SETTINGS_CONFIG.button.size,
          height: SETTINGS_CONFIG.button.size,
          // 确保在移动端可见，使用非常高的z-index
          zIndex: 99999,
          // 兼容性：同时使用 Webkit 和标准属性
          WebkitTapHighlightColor: 'transparent',
          MozTapHighlightColor: 'transparent',
          tapHighlightColor: 'transparent',
          // 确保按钮可以接收触摸事件
          touchAction: 'manipulation',
          position: 'fixed',
          // 确保在火狐浏览器中可见
          display: 'flex',
          visibility: 'visible',
          opacity: 1,
        } as React.CSSProperties}
        aria-label="设置"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ width: SETTINGS_CONFIG.button.iconSize, height: SETTINGS_CONFIG.button.iconSize }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* 设置菜单 */}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-black/90 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]"
          style={{
            bottom: `calc(${SETTINGS_CONFIG.position.bottom} + ${SETTINGS_CONFIG.button.size} + 0.5rem)`,
            right: SETTINGS_CONFIG.position.right,
            width: SETTINGS_CONFIG.menu.width,
            maxHeight: SETTINGS_CONFIG.menu.maxHeight,
            padding: SETTINGS_CONFIG.menu.padding,
          }}
        >
          <div className="flex flex-col gap-3">
            {/* 菜单标题 */}
            <div className="text-white text-sm font-semibold mb-1">设置</div>

            {/* 相机视野切换 */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-white text-sm font-medium flex-shrink-0">相机视野</span>
              
              {/* 切换开关 */}
              <div
                className="relative bg-white/10 rounded-full"
                style={{ padding: SETTINGS_CONFIG.toggle.container.padding }}
              >
                <div className="flex relative">
                  {/* 背景滑块 */}
                  <div
                    className="absolute rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all ease-out shadow-lg"
                    style={{
                      left: isWideAngle ? sliderLeftWide : sliderLeftNormal,
                      width: sliderWidth,
                      top: sliderTop,
                      bottom: sliderBottom,
                      transition: `left ${SETTINGS_CONFIG.toggle.animation.duration}ms ${SETTINGS_CONFIG.toggle.animation.easing}, width ${SETTINGS_CONFIG.toggle.animation.duration}ms ${SETTINGS_CONFIG.toggle.animation.easing}`,
                    }}
                  />
                  
                  {/* 正常按钮 */}
                  <button
                    onClick={() => handleWideAngleToggle(false)}
                    className={`relative z-10 rounded-full text-xs font-semibold transition-all duration-300 ${
                      !isWideAngle
                        ? 'text-white drop-shadow-lg'
                        : 'text-gray-400 hover:text-gray-200'
                    } cursor-pointer`}
                    style={{
                      paddingLeft: SETTINGS_CONFIG.toggle.button.paddingX,
                      paddingRight: SETTINGS_CONFIG.toggle.button.paddingX,
                      paddingTop: SETTINGS_CONFIG.toggle.button.paddingY,
                      paddingBottom: SETTINGS_CONFIG.toggle.button.paddingY,
                      minWidth: SETTINGS_CONFIG.toggle.button.minWidth,
                    }}
                  >
                    正常
                  </button>
                  
                  {/* 超广角按钮 */}
                  <button
                    onClick={() => handleWideAngleToggle(true)}
                    className={`relative z-10 rounded-full text-xs font-semibold transition-all duration-300 ${
                      isWideAngle
                        ? 'text-white drop-shadow-lg'
                        : 'text-gray-400 hover:text-gray-200'
                    } cursor-pointer`}
                    style={{
                      paddingLeft: SETTINGS_CONFIG.toggle.button.paddingX,
                      paddingRight: SETTINGS_CONFIG.toggle.button.paddingX,
                      paddingTop: SETTINGS_CONFIG.toggle.button.paddingY,
                      paddingBottom: SETTINGS_CONFIG.toggle.button.paddingY,
                      minWidth: SETTINGS_CONFIG.toggle.button.minWidth,
                    }}
                  >
                    超广角
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

