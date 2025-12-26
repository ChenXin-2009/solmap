'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { HEADER_CONFIG } from '@/lib/config/visualConfig';

export default function Header() {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    // use addEventListener when available
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // 柔性访问：某些可选字段（如浮动模式相关）可能不存在于配置中
  const cfg: any = HEADER_CONFIG;

  if (!HEADER_CONFIG.enabled) {
    return null;
  }

  // 漂浮模式（如果配置存在）
  if (cfg.floatingMode) {
    return (
      <div
        style={{
          position: 'fixed',
          top: `${cfg.floatingPosition?.top ?? 0}px`,
          left: `${cfg.floatingPosition?.left ?? 0}px`,
          // 在移动端避免遮挡交互控件：当屏幕较小时让 header 不拦截指针事件
          pointerEvents: isMobile ? 'none' : 'auto',
          zIndex: 1000,
          cursor: 'pointer',
          transition: `all ${cfg.floatingStyle?.transitionDuration ?? 150}ms ease`,
          backgroundColor: isHovered 
            ? (cfg.floatingStyle?.hoverBackgroundColor ?? cfg.backgroundColor) 
            : (cfg.floatingStyle?.backgroundColor ?? cfg.backgroundColor),
          border: `${cfg.floatingStyle?.borderWidth ?? 0}px solid ${cfg.floatingStyle?.borderColor ?? cfg.borderColor}`,
          borderRadius: `${cfg.floatingStyle?.borderRadius ?? 0}px`,
          padding: `${cfg.floatingStyle?.padding ?? 8}px`,
          boxShadow: cfg.floatingStyle?.boxShadow ?? 'none',
          backdropFilter: cfg.floatingStyle?.backdropFilter ?? 'none',
          WebkitBackdropFilter: cfg.floatingStyle?.backdropFilter ?? 'none', // Safari支持
          display: 'flex',
          alignItems: 'center',
          gap: `${cfg.contentGap ?? HEADER_CONFIG.contentGap}px`,
          opacity: cfg.logoOpacity ?? 1, // 整体透明度
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          // 可以在这里添加点击事件，比如跳转到首页或显示信息
          console.log('Logo clicked');
        }}
      >
        {/* LOGO图标 */}
        <Image
          src={HEADER_CONFIG.logoPath}
          alt="SOLMAP Logo"
          width={isMobile ? Math.max(28, Math.floor(cfg.logoSize * 0.6)) : cfg.logoSize}
          height={isMobile ? Math.max(28, Math.floor(cfg.logoSize * 0.6)) : cfg.logoSize}
          priority
          style={{
            width: isMobile ? `${Math.max(28, Math.floor(cfg.logoSize * 0.6))}px` : `${cfg.logoSize}px`,
            height: isMobile ? `${Math.max(28, Math.floor(cfg.logoSize * 0.6))}px` : `${cfg.logoSize}px`,
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />

        {/* 文字信息 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: `${cfg.textSpacing ?? HEADER_CONFIG.textSpacing}px`,
          }}
        >
          {/* 标题 */}
          <div
            style={{
              fontSize: `${cfg.titleFontSize ?? HEADER_CONFIG.titleFontSize}px`,
              fontWeight: cfg.titleFontWeight ?? HEADER_CONFIG.titleFontWeight,
              color: cfg.textColor ?? HEADER_CONFIG.textColor,
              lineHeight: 1,
              letterSpacing: '0.5px',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)', // 添加文字阴影增强可见性
            }}
          >
            {cfg.titleText ?? HEADER_CONFIG.titleText}
          </div>

          {/* 副标题 */}
          <div
              style={{
              fontSize: `${cfg.subtitleFontSize ?? HEADER_CONFIG.subtitleFontSize}px`,
              fontWeight: cfg.subtitleFontWeight ?? HEADER_CONFIG.subtitleFontWeight,
              color: cfg.subtitleColor ?? HEADER_CONFIG.subtitleColor,
              lineHeight: 1,
              letterSpacing: '0.3px',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)', // 添加文字阴影增强可见性
            }}
          >
            {cfg.subtitleText ?? HEADER_CONFIG.subtitleText}
          </div>
        </div>
      </div>
    );
  }

  // 传统顶栏模式
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${HEADER_CONFIG.height}px`,
        backgroundColor: HEADER_CONFIG.backgroundColor,
        borderBottom: `1px solid ${HEADER_CONFIG.borderColor}`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: `${HEADER_CONFIG.paddingLeft}px`,
        paddingRight: `${HEADER_CONFIG.paddingLeft}px`,
        zIndex: 1000,
        // 在移动端避免遮挡交互控件：当屏幕较小时让 header 不拦截指针事件
        pointerEvents: isMobile ? 'none' : 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* LOGO */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${HEADER_CONFIG.logoSize}px`,
          height: `${HEADER_CONFIG.logoSize}px`,
          flexShrink: 0,
        }}
      >
        <Image
          src={HEADER_CONFIG.logoPath}
          alt="SOLMAP Logo"
          width={HEADER_CONFIG.logoSize}
          height={HEADER_CONFIG.logoSize}
          priority
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* 文字信息 */}
      <div
        style={{
          marginLeft: `${HEADER_CONFIG.contentGap}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: `${HEADER_CONFIG.textSpacing}px`,
        }}
      >
        {/* 标题 */}
        <div
          style={{
            fontSize: `${HEADER_CONFIG.titleFontSize}px`,
            fontWeight: HEADER_CONFIG.titleFontWeight,
            color: HEADER_CONFIG.textColor,
            lineHeight: 1,
            letterSpacing: '0.5px',
          }}
        >
          {HEADER_CONFIG.titleText}
        </div>

        {/* 副标题 */}
        <div
          style={{
            fontSize: `${HEADER_CONFIG.subtitleFontSize}px`,
            fontWeight: HEADER_CONFIG.subtitleFontWeight,
            color: HEADER_CONFIG.subtitleColor,
            lineHeight: 1,
            letterSpacing: '0.3px',
          }}
        >
          {HEADER_CONFIG.subtitleText}
        </div>
      </div>
    </header>
  );
}
