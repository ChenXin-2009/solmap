/**
 * ScaleRuler.tsx - 3D 场景距离标尺
 * 显示在右上角，显示当前视图的距离比例
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ==================== 可调参数配置 ====================

// 标尺配置
const RULER_CONFIG = {
  updateInterval: 100, // 更新间隔（毫秒，值越小更新越频繁）
  targetPixels: 100, // 目标标尺长度（像素）
  minPixels: 50, // 最小标尺长度（像素）
  maxPixels: 150, // 最大标尺长度（像素）
};

interface ScaleRulerProps {
  camera: THREE.PerspectiveCamera | null;
  container: HTMLElement | null;
  controlsTarget?: THREE.Vector3 | null; // OrbitControls 的目标位置
}

export default function ScaleRuler({ camera, container, controlsTarget }: ScaleRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    // 如果 camera 或 container 还没有初始化，等待它们初始化
    if (!camera || !container) {
      setScale(''); // 清空标尺显示
      setIsVisible(false);
      return;
    }
    
    // 标记为可见
    setIsVisible(true);

    const updateScale = () => {
      if (!camera || !container || !rulerRef.current) return;

      // 计算相机到目标的距离
      const target = controlsTarget || new THREE.Vector3(0, 0, 0);
      const distance = camera.position.distanceTo(target);
      
      // 计算在屏幕上的像素距离（使用相机的视野角度）
      const fov = camera.fov * (Math.PI / 180);
      const height = container.clientHeight;
      const distanceAtScreen = 2 * Math.tan(fov / 2) * distance;
      
      // 计算 1 AU 在屏幕上的像素大小
      const pixelsPerAU = height / distanceAtScreen;
      
      // 选择一个合适的标尺长度，使其在屏幕上大约 60 像素
      let displayLength = 0.1;
      let unit = 'AU';
      
      // 根据距离动态调整标尺长度
      if (distance < 0.01) {
        displayLength = 0.001;
        unit = 'AU';
      } else if (distance < 0.1) {
        displayLength = 0.01;
        unit = 'AU';
      } else if (distance < 1) {
        displayLength = 0.1;
        unit = 'AU';
      } else if (distance < 10) {
        displayLength = 1;
        unit = 'AU';
      } else {
        displayLength = 5;
        unit = 'AU';
      }
      
      // 确保标尺在屏幕上大约 60 像素
      const rulerPixels = pixelsPerAU * displayLength;
      if (rulerPixels < 20) {
        // 标尺太小，增加长度
        if (displayLength < 0.001) {
          displayLength = 0.001;
        } else if (displayLength < 0.01) {
          displayLength = 0.01;
        } else if (displayLength < 0.1) {
          displayLength = 0.1;
        } else {
          displayLength = 1;
        }
      } else if (rulerPixels > 200) {
        // 标尺太大，减小长度
        if (displayLength > 1) {
          displayLength = 1;
        } else if (displayLength > 0.1) {
          displayLength = 0.1;
        } else if (displayLength > 0.01) {
          displayLength = 0.01;
        } else {
          displayLength = 0.001;
        }
      }
      
      // 格式化显示
      if (displayLength >= 1) {
        setScale(`${displayLength.toFixed(0)} ${unit}`);
      } else if (displayLength >= 0.1) {
        setScale(`${displayLength.toFixed(1)} ${unit}`);
      } else if (displayLength >= 0.01) {
        setScale(`${displayLength.toFixed(2)} ${unit}`);
      } else {
        setScale(`${displayLength.toFixed(3)} ${unit}`);
      }
    };

    // 初始更新
    updateScale();

    // 定期更新（使用配置的更新间隔）
    const interval = setInterval(updateScale, RULER_CONFIG.updateInterval);

    return () => clearInterval(interval);
  }, [camera, container, controlsTarget]);

  // 如果不可见或没有 scale 值，不显示标尺
  if (!isVisible || !scale) return null;

  return (
    <div
      ref={rulerRef}
      className="absolute top-4 right-4 z-20 pointer-events-none"
      style={{
        color: '#ffffff',
        // 与全局保持一致，使用思源宋体 CN，可变字重用 body 字重
        fontFamily: '"SourceHanSerifCN", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '14px',
        textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '8px 12px',
        borderRadius: '4px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div
            style={{
              width: '60px',
              height: '2px',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 2px rgba(255,255,255,0.8)',
            }}
          />
          <span>{scale}</span>
        </div>
      </div>
    </div>
  );
}

