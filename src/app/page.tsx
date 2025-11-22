// src/app/page.tsx 或 src/app/solar-system/page.tsx
'use client';

import React from "react";
import SolarSystemCanvas from "@/components/canvas/SolarSystemCanvas";
import SolarSystemCanvas3D from "@/components/canvas/3d/SolarSystemCanvas3D";
import TimeControl from "@/components/TimeControl";
import ViewModeToggle from "@/components/ViewModeToggle";
import { useSolarSystemStore } from "@/lib/state";

export default function SolarSystemPage() {
  const { viewMode } = useSolarSystemStore();

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden touch-none relative">
      <TimeControl />
      <div className="flex-1 relative min-h-0" style={{ isolation: 'isolate' }}>
        {viewMode === '2d' ? <SolarSystemCanvas /> : <SolarSystemCanvas3D />}
      </div>
      <ViewModeToggle />
    </div>
  );
}
