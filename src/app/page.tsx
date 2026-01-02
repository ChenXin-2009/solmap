// src/app/page.tsx 或 src/app/solar-system/page.tsx
'use client';

import React from "react";
import SolarSystemCanvas3D from "@/components/canvas/3d/SolarSystemCanvas3D";
import TimeControl from "@/components/TimeControl";
import StarBrightnessSlider from "@/components/StarBrightnessSlider";
import { HEADER_CONFIG } from "@/lib/config/visualConfig";

export default function SolarSystemPage() {
  // 计算顶部偏移（Header高度）- 漂浮模式下不需要预留空间
  const headerHeight = (HEADER_CONFIG.enabled && !HEADER_CONFIG.floatingMode) ? HEADER_CONFIG.height : 0;

  return (
    <div 
      className="w-screen flex flex-col overflow-hidden relative"
      style={{ 
        height: '100vh',
        // 使用 dvh 适配移动端动态视口
        // @ts-ignore - dvh 是较新的 CSS 单位
        height: '100dvh',
      }}
    >
      {/* 主容器，漂浮模式下不需要留出Header高度空间 */}
      <div 
        className="flex-1 relative min-h-0 flex flex-col"
        style={{ 
          marginTop: `${headerHeight}px`,
          isolation: 'isolate',
          // 确保不超出父容器
          maxHeight: '100%',
        }}
      >
        <div className="flex-1 relative min-h-0" style={{ isolation: 'isolate', maxHeight: '100%' }}>
          <SolarSystemCanvas3D />
        </div>
        <TimeControl />
        <StarBrightnessSlider />
      </div>
    </div>
  );
}
