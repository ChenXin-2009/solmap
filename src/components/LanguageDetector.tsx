'use client';

import { useEffect } from 'react';
import { useSolarSystemStore } from '@/lib/state';

type Language = 'zh' | 'en';

/**
 * 从浏览器语言设置检测用户语言
 */
function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'zh'; // 服务端默认返回中文
  }

  const browserLang = navigator.language || (navigator as any).userLanguage || '';
  const langCode = browserLang.toLowerCase().split('-')[0];
  
  // 检查是否是中文（包括 zh-CN, zh-TW, zh-HK 等）
  if (langCode === 'zh') {
    return 'zh';
  }
  
  // 默认返回英文
  return 'en';
}

interface LanguageDetectorProps {
  initialLang: Language;
}

/**
 * 语言检测组件
 * 在客户端检测浏览器语言并同步到 Zustand store
 */
export default function LanguageDetector({ initialLang }: LanguageDetectorProps) {
  const { setLang } = useSolarSystemStore();

  useEffect(() => {
    // 优先使用浏览器检测的语言（更准确）
    const browserLang = detectBrowserLanguage();
    
    // 如果浏览器语言与服务端检测的不同，使用浏览器语言
    // 这样可以确保客户端和服务端语言一致
    setLang(browserLang);
  }, [setLang]);

  // 这个组件不渲染任何内容
  return null;
}


