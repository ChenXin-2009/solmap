'use client';

import React from 'react';
import Image from 'next/image';
import { HEADER_CONFIG } from '@/lib/config/visualConfig';

export default function Header() {
  if (!HEADER_CONFIG.enabled) {
    return null;
  }

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
          alt="CXIN Logo"
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
