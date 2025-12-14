// src/app/page.tsx 或 src/app/solar-system/page.tsx
'use client';

import React from "react";
import SolarSystemCanvas from "@/components/canvas/SolarSystemCanvas";
import SolarSystemCanvas3D from "@/components/canvas/3d/SolarSystemCanvas3D";
import TimeControl from "@/components/TimeControl";
import ViewModeToggle from "@/components/ViewModeToggle";
import { useSolarSystemStore } from "@/lib/state";
import { HEADER_CONFIG } from "@/lib/config/visualConfig";

export default function SolarSystemPage() {
  const { viewMode } = useSolarSystemStore();
  
  // 计算顶部偏移（Header高度）
  const headerHeight = HEADER_CONFIG.enabled ? HEADER_CONFIG.height : 0;

  return (
    <div 
      className="w-screen flex flex-col overflow-hidden touch-none relative"
      style={{ height: '100vh' }}
    >
      {/* 主容器，留出Header高度空间 */}
      <div 
        className="flex-1 relative min-h-0 flex flex-col"
        style={{ 
          marginTop: `${headerHeight}px`,
          isolation: 'isolate',
        }}
      >
        <div className="flex-1 relative min-h-0" style={{ isolation: 'isolate' }}>
          {viewMode === '2d' ? <SolarSystemCanvas /> : <SolarSystemCanvas3D />}
        </div>
        <TimeControl />
        <ViewModeToggle />
      </div>
    </div>
  );
}
