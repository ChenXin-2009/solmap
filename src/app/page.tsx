// src/app/page.tsx 或 src/app/solar-system/page.tsx
'use client';

import React from "react";
import SolarSystemCanvas3D from "@/components/canvas/3d/SolarSystemCanvas3D";
import TimeControl from "@/components/TimeControl";
import { HEADER_CONFIG } from "@/lib/config/visualConfig";

export default function SolarSystemPage() {
  // 计算顶部偏移（Header高度）- 漂浮模式下不需要预留空间
  const headerHeight = (HEADER_CONFIG.enabled && !HEADER_CONFIG.floatingMode) ? HEADER_CONFIG.height : 0;

  return (
    <div 
      className="w-screen flex flex-col overflow-hidden relative"
      style={{ height: '100vh' }}
    >
      {/* 主容器，漂浮模式下不需要留出Header高度空间 */}
      <div 
        className="flex-1 relative min-h-0 flex flex-col"
        style={{ 
          marginTop: `${headerHeight}px`,
          isolation: 'isolate',
        }}
      >
        <div className="flex-1 relative min-h-0" style={{ isolation: 'isolate' }}>
          <SolarSystemCanvas3D />
        </div>
        <TimeControl />
      </div>
    </div>
  );
}
