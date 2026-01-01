/**
 * DistanceDisplay.tsx - 距离地球显示组件
 * 
 * 在左侧垂直居中显示相机距离地球的距离
 * 支持多种单位：AU、公里、光分钟等
 */

'use client';

import React from 'react';
import { DISTANCE_DISPLAY_CONFIG } from '@/lib/config/visualConfig';

// 单位转换常量
const AU_TO_KM = 149597870.7; // 1 AU = 149,597,870.7 公里

interface DistanceDisplayProps {
  distanceAU: number; // 距离（AU单位）
}

/**
 * 格式化距离显示
 * 根据距离大小自动选择合适的单位
 */
function formatDistance(distanceAU: number): { value: string; unit: string } {
  const distanceKM = distanceAU * AU_TO_KM;
  
  // 小于 0.001 AU（约 15 万公里）时显示公里
  if (distanceAU < 0.001) {
    if (distanceKM < 1000) {
      return { value: distanceKM.toFixed(1), unit: '公里' };
    } else if (distanceKM < 1000000) {
      return { value: (distanceKM / 1000).toFixed(2), unit: '千公里' };
    } else {
      return { value: (distanceKM / 1000000).toFixed(3), unit: '百万公里' };
    }
  }
  
  // 0.001 - 1 AU 之间显示百万公里或 AU
  if (distanceAU < 1) {
    const millionKM = distanceKM / 1000000;
    if (millionKM < 10) {
      return { value: millionKM.toFixed(2), unit: '百万公里' };
    }
    return { value: distanceAU.toFixed(4), unit: 'AU' };
  }
  
  // 1 - 10 AU 显示 AU
  if (distanceAU < 10) {
    return { value: distanceAU.toFixed(3), unit: 'AU' };
  }
  
  // 大于 10 AU 显示 AU（保留2位小数）
  return { value: distanceAU.toFixed(2), unit: 'AU' };
}

export default function DistanceDisplay({ distanceAU }: DistanceDisplayProps) {
  const { value, unit } = formatDistance(distanceAU);
  const cfg = DISTANCE_DISPLAY_CONFIG;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: `${cfg.left}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        color: cfg.textColor,
        fontSize: `${cfg.titleFontSize}px`,
        fontFamily: cfg.fontFamily,
        textShadow: cfg.textShadow,
        backgroundColor: cfg.backgroundColor,
        backdropFilter: `blur(${cfg.backdropBlur}px)`,
        WebkitBackdropFilter: `blur(${cfg.backdropBlur}px)`,
        padding: `${cfg.padding.vertical}px ${cfg.padding.horizontal}px`,
        borderRadius: `${cfg.borderRadius}px`,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: cfg.zIndex,
        display: 'flex',
        flexDirection: 'column',
        gap: `${cfg.lineGap}px`,
      }}
    >
      <div style={{ opacity: cfg.titleOpacity }}>{cfg.titleText}</div>
      <div style={{ fontSize: `${cfg.valueFontSize}px`, fontWeight: cfg.valueFontWeight }}>{value}</div>
      <div style={{ fontSize: `${cfg.unitFontSize}px`, opacity: cfg.unitOpacity }}>{unit}</div>
    </div>
  );
}
