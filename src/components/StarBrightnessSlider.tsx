/**
 * StarBrightnessSlider.tsx - 恒星亮度调整滑块组件
 * 
 * 与时间滑块完全一致的设计：
 * - 下凹弧线轨道（两端细，中间粗）
 * - 可拖动的空心圆圈滑块
 * - 显示当前亮度百分比
 * - 在时间控件隐藏后显示（远距离视图）
 */

'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSolarSystemStore } from '@/lib/state';
import { TIME_SLIDER_CONFIG, STAR_BRIGHTNESS_SLIDER_CONFIG } from '@/lib/config/visualConfig';

export default function StarBrightnessSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const starBrightness = useSolarSystemStore((state) => state.starBrightness);
  const setStarBrightness = useSolarSystemStore((state) => state.setStarBrightness);
  const cameraDistance = useSolarSystemStore((state) => state.cameraDistance);
  const lang = useSolarSystemStore((state) => state.lang);

  // 使用时间滑块的配置来保持样式一致
  const timeCfg = TIME_SLIDER_CONFIG;
  const cfg = STAR_BRIGHTNESS_SLIDER_CONFIG;
  
  // 使用时间滑块的尺寸
  const width = timeCfg.width;
  const height = timeCfg.height;
  
  // 计算滑块位置（0-1）
  const sliderPosition = (starBrightness - cfg.minBrightness) / (cfg.maxBrightness - cfg.minBrightness);

  // 弧线参数 - 使用时间滑块的配置
  const arcDepth = height * timeCfg.arcDepthRatio;
  const sliderRadius = timeCfg.sliderRadius;
  const trackPadding = timeCfg.trackPadding;
  const trackWidth = width - trackPadding * 2;
  
  // 计算弧线上的Y坐标（二次贝塞尔曲线）- 下凹弧线
  const getArcY = useCallback((normalizedX: number) => {
    const y = 4 * arcDepth * normalizedX * (1 - normalizedX);
    return trackPadding + y;
  }, [arcDepth, trackPadding]);

  // 计算滑块位置
  const sliderX = trackPadding + sliderPosition * trackWidth;
  const sliderY = getArcY(sliderPosition);

  // 处理拖动开始
  const handleDragStart = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const normalizedX = Math.max(0, Math.min(1, (x - trackPadding) / trackWidth));
    
    const newBrightness = cfg.minBrightness + normalizedX * (cfg.maxBrightness - cfg.minBrightness);
    setStarBrightness(newBrightness);
    setIsDragging(true);
  }, [trackPadding, trackWidth, cfg.minBrightness, cfg.maxBrightness, setStarBrightness]);

  // 处理拖动移动
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const normalizedX = Math.max(0, Math.min(1, (x - trackPadding) / trackWidth));
    
    const newBrightness = cfg.minBrightness + normalizedX * (cfg.maxBrightness - cfg.minBrightness);
    setStarBrightness(newBrightness);
  }, [isDragging, trackPadding, trackWidth, cfg.minBrightness, cfg.maxBrightness, setStarBrightness]);

  // 处理拖动结束
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 鼠标事件
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  // 触摸事件
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleDragStart(e.touches[0].clientX);
    }
  };

  // 全局鼠标/触摸事件监听
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 计算透明度（时间控件隐藏后显示）
  let opacity = 0;
  if (cameraDistance >= cfg.showFullDistance) {
    opacity = 1;
  } else if (cameraDistance > cfg.showStartDistance) {
    opacity = (cameraDistance - cfg.showStartDistance) / (cfg.showFullDistance - cfg.showStartDistance);
  }

  // 如果完全透明，不渲染
  if (opacity <= 0) {
    return null;
  }

  // 亮度百分比显示
  const brightnessPercent = Math.round(starBrightness * 100);

  // 生成渐变弧线的多个点 - 使用时间滑块的分段数
  const generateArcPoints = (segments: number = 50) => {
    const points: { x: number; y: number; t: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = trackPadding + t * trackWidth;
      const y = getArcY(t);
      points.push({ x, y, t });
    }
    return points;
  };

  const arcPoints = generateArcPoints(50);

  return (
    <div
      className="absolute left-0 right-0 z-10 flex flex-col items-center"
      style={{
        bottom: `${cfg.bottomOffset}px`,
        opacity,
        transition: 'opacity 0.3s ease-out',
        pointerEvents: 'none',
      }}
    >
      {/* 标签和百分比 */}
      <div 
        className="flex items-center gap-2 mb-2"
        style={{ 
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: `${timeCfg.speedTextSize}px`,
          fontWeight: 'bold',
        }}
      >
        <span>{lang === 'zh' ? '恒星亮度' : 'Star Brightness'}</span>
        <span>{brightnessPercent}%</span>
      </div>

      {/* 滑块容器 */}
      <div
        ref={containerRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* SVG 弧线轨道 - 使用时间滑块完全相同的渐变 */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            {/* 使用时间滑块相同的渐变定义 */}
            <linearGradient id="starArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={timeCfg.trackColorEnd} />
              <stop offset="50%" stopColor={timeCfg.trackColorCenter} />
              <stop offset="100%" stopColor={timeCfg.trackColorEnd} />
            </linearGradient>
            <linearGradient id="starArcGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={timeCfg.forwardColorEnd} />
              <stop offset="50%" stopColor={timeCfg.forwardColorCenter} />
              <stop offset="100%" stopColor={timeCfg.forwardColorEnd} />
            </linearGradient>
          </defs>
          
          {/* 绘制渐变宽度的弧线 - 使用时间滑块相同的宽度配置 */}
          {arcPoints.slice(0, -1).map((point, i) => {
            const nextPoint = arcPoints[i + 1];
            const centerDist = Math.abs(point.t - 0.5) * 2;
            const strokeWidth = timeCfg.trackMinWidth + (1 - centerDist) * (timeCfg.trackMaxWidth - timeCfg.trackMinWidth);
            
            return (
              <line
                key={i}
                x1={point.x}
                y1={point.y}
                x2={nextPoint.x}
                y2={nextPoint.y}
                stroke="url(#starArcGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}
          
          {/* 活动状态的高亮弧线 */}
          {isDragging && arcPoints.slice(0, -1).map((point, i) => {
            const nextPoint = arcPoints[i + 1];
            const centerDist = Math.abs(point.t - 0.5) * 2;
            const strokeWidth = timeCfg.trackMinWidth + (1 - centerDist) * (timeCfg.trackMaxWidth - timeCfg.trackMinWidth);
            
            return (
              <line
                key={`active-${i}`}
                x1={point.x}
                y1={point.y}
                x2={nextPoint.x}
                y2={nextPoint.y}
                stroke="url(#starArcGradientActive)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* 滑块 - 空心圆圈，使用时间滑块相同的样式 */}
        <div
          style={{
            position: 'absolute',
            left: `${sliderX - sliderRadius}px`,
            top: `${sliderY - sliderRadius}px`,
            width: `${sliderRadius * 2}px`,
            height: `${sliderRadius * 2}px`,
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: `${timeCfg.sliderBorderWidth}px solid ${isDragging ? timeCfg.sliderForwardColor : timeCfg.sliderBorderColor}`,
            boxShadow: isDragging ? `0 0 ${timeCfg.sliderGlowRadius}px ${timeCfg.sliderForwardColor}` : 'none',
            transition: isDragging ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out, border-color 0.2s',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
