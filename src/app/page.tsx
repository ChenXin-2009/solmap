// src/app/page.tsx 或 src/app/solar-system/page.tsx
import React from "react";
import SolarSystemCanvas from "@/components/canvas/SolarSystemCanvas";
import TimeControl from "@/components/TimeControl";

export default function SolarSystemPage() {
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden touch-none">
      <TimeControl />
      <div className="flex-1 relative min-h-0">
        <SolarSystemCanvas />
      </div>
    </div>
  );
}
