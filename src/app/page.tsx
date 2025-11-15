// src/app/page.tsx 或 src/app/solar-system/page.tsx
import React from "react";
import SolarSystemCanvas from "@/components/canvas/SolarSystemCanvas";

export default function SolarSystemPage() {
  return (
    <div className="w-screen h-screen">
      <SolarSystemCanvas />
    </div>
  );
}
