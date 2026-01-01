/**
 * TimeSlider.tsx - 弧形时间滑块组件
 * 
 * 类似 NASA Eyes 的设计：
 * - 下凹弧线轨道（两端细，中间粗）
 * - 可拖动的空心圆圈滑块
 * - 向左倒退，向右快进
 * - 越靠边速度越快
 * - 松开回到中心暂停
 */

'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSolarSystemStore } from '@/lib/state';
import { TIME_SLIDER_CONFIG } from '@/lib/config/visualConfig';

interface TimeSliderProps {
  width?: number;
  height?: number;
}

// 从配置中读取速度参数
const SPEED_CONFIG = {
  maxSpeed: TIME_SLIDER_CONFIG.maxSpeed,
  exponent: TIME_SLIDER_CONFIG.speedExponent,
  deadZone: TIME_SLIDER_CONFIG.deadZone,
};

export default function TimeSlider({ 
  width = TIME_SLIDER_CONFIG.width, 
  height = TIME_SLIDER_CONFIG.height 
}: TimeSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0.5); // 0-1, 0.5 = 中心
  
  const startPlaying = useSolarSystemStore((state) => state.startPlaying);
  const lang = useSolarSystemStore((state) => state.lang);

  // 停止播放的方法
  const stopPlaying = () => {
    useSolarSystemStore.setState({ isPlaying: false });
  };

  // 弧线参数
  const cfg = TIME_SLIDER_CONFIG;
  const arcDepth = height * cfg.arcDepthRatio;
  const sliderRadius = cfg.sliderRadius;
  const trackPadding = cfg.trackPadding;
  const trackWidth = width - trackPadding * 2;
  
  // 计算弧线上的Y坐标（二次贝塞尔曲线）- 下凹弧线
  const getArcY = useCallback((normalizedX: number) => {
    // normalizedX: 0-1, 0=左边, 1=右边
    // 使用抛物线: y = 4 * depth * x * (1 - x)
    // 下凹：中间最低，两边最高
    const y = 4 * arcDepth * normalizedX * (1 - normalizedX);
    return trackPadding + y; // 从顶部算起，中间下凹
  }, [arcDepth, trackPadding]);

  // 计算滑块位置
  const sliderX = trackPadding + sliderPosition * trackWidth;
  const sliderY = getArcY(sliderPosition);

  // 根据滑块位置计算速度
  const calculateSpeed = useCallback((position: number) => {
    // position: 0-1, 0.5 = 中心
    const offset = position - 0.5; // -0.5 到 0.5
    const normalizedOffset = offset * 2; // -1 到 1
    
    // 死区检测
    if (Math.abs(normalizedOffset) < SPEED_CONFIG.deadZone) {
      return { speed: 0, direction: 'forward' as const };
    }
    
    // 应用指数曲线使边缘加速更明显
    const sign = normalizedOffset > 0 ? 1 : -1;
    const magnitude = Math.pow(Math.abs(normalizedOffset), SPEED_CONFIG.exponent);
    const speed = magnitude * SPEED_CONFIG.maxSpeed;
    
    return {
      speed,
      direction: sign > 0 ? 'forward' as const : 'backward' as const,
    };
  }, []);

  // 更新播放状态
  useEffect(() => {
    if (isDragging) {
      const { speed, direction } = calculateSpeed(sliderPosition);
      if (speed > 0) {
        startPlaying(speed, direction);
      } else {
        stopPlaying();
      }
    }
  }, [isDragging, sliderPosition, calculateSpeed, startPlaying, stopPlaying]);

  // 处理拖动开始
  const handleDragStart = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const normalizedX = Math.max(0, Math.min(1, (x - trackPadding) / trackWidth));
    
    setSliderPosition(normalizedX);
    setIsDragging(true);
  }, [trackPadding, trackWidth]);

  // 处理拖动移动
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const normalizedX = Math.max(0, Math.min(1, (x - trackPadding) / trackWidth));
    
    setSliderPosition(normalizedX);
  }, [isDragging, trackPadding, trackWidth]);

  // 处理拖动结束 - 保持当前位置，不自动归位
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // 不再自动归位到中心，保持当前位置继续播放
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

  // 计算当前速度显示
  const { speed, direction } = calculateSpeed(sliderPosition);
  const speedLabel = speed > 0 
    ? (speed >= 365 
        ? `${(speed / 365).toFixed(1)}${lang === 'zh' ? '年/秒' : 'y/s'}`
        : speed >= 30 
          ? `${(speed / 30).toFixed(1)}${lang === 'zh' ? '月/秒' : 'm/s'}`
          : `${speed.toFixed(0)}${lang === 'zh' ? '天/秒' : 'd/s'}`)
    : '';

  // 生成渐变弧线的多个点
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
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* SVG 弧线轨道 - 渐变宽度 */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <defs>
          {/* 渐变定义 */}
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={cfg.trackColorEnd} />
            <stop offset="50%" stopColor={cfg.trackColorCenter} />
            <stop offset="100%" stopColor={cfg.trackColorEnd} />
          </linearGradient>
          <linearGradient id="arcGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={direction === 'forward' ? cfg.forwardColorEnd : cfg.backwardColorEnd} />
            <stop offset="50%" stopColor={direction === 'forward' ? cfg.forwardColorCenter : cfg.backwardColorCenter} />
            <stop offset="100%" stopColor={direction === 'forward' ? cfg.forwardColorEnd : cfg.backwardColorEnd} />
          </linearGradient>
        </defs>
        
        {/* 绘制渐变宽度的弧线 - 使用多个线段 */}
        {arcPoints.slice(0, -1).map((point, i) => {
          const nextPoint = arcPoints[i + 1];
          // 宽度从两端到中间渐变
          const centerDist = Math.abs(point.t - 0.5) * 2; // 0在中间，1在两端
          const strokeWidth = cfg.trackMinWidth + (1 - centerDist) * (cfg.trackMaxWidth - cfg.trackMinWidth);
          
          return (
            <line
              key={i}
              x1={point.x}
              y1={point.y}
              x2={nextPoint.x}
              y2={nextPoint.y}
              stroke="url(#arcGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          );
        })}
        
        {/* 活动状态的高亮弧线 */}
        {speed > 0 && arcPoints.slice(0, -1).map((point, i) => {
          const nextPoint = arcPoints[i + 1];
          const centerDist = Math.abs(point.t - 0.5) * 2;
          const strokeWidth = cfg.trackMinWidth + (1 - centerDist) * (cfg.trackMaxWidth - cfg.trackMinWidth);
          
          return (
            <line
              key={`active-${i}`}
              x1={point.x}
              y1={point.y}
              x2={nextPoint.x}
              y2={nextPoint.y}
              stroke="url(#arcGradientActive)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                opacity: Math.min(1, speed / SPEED_CONFIG.maxSpeed),
              }}
            />
          );
        })}
      </svg>

      {/* 滑块 - 空心圆圈 */}
      <div
        style={{
          position: 'absolute',
          left: `${sliderX - sliderRadius}px`,
          top: `${sliderY - sliderRadius}px`,
          width: `${sliderRadius * 2}px`,
          height: `${sliderRadius * 2}px`,
          borderRadius: '50%',
          backgroundColor: 'transparent',
          border: `${cfg.sliderBorderWidth}px solid ${isDragging 
            ? (direction === 'forward' ? cfg.sliderForwardColor : cfg.sliderBackwardColor)
            : cfg.sliderBorderColor}`,
          boxShadow: isDragging 
            ? `0 0 ${cfg.sliderGlowRadius}px ${direction === 'forward' ? cfg.sliderForwardColor : cfg.sliderBackwardColor}`
            : 'none',
          transition: isDragging ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out, border-color 0.2s',
          pointerEvents: 'none',
        }}
      />

      {/* 速度显示 */}
      {speed > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: `${cfg.speedTextBottom}px`,
            transform: 'translateX(-50%)',
            color: direction === 'forward' ? cfg.speedTextForwardColor : cfg.speedTextBackwardColor,
            fontSize: `${cfg.speedTextSize}px`,
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {direction === 'backward' ? '◀ ' : ''}{speedLabel}{direction === 'forward' ? ' ▶' : ''}
        </div>
      )}
    </div>
  );
}
