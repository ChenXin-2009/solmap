/**
 * names.ts
 * 新增内容：
 * 1. 行星名字多语言映射（中文/英文）
 * 2. 可通过 Zustand lang 变量控制 Canvas 渲染语言
 */

export const planetNames: Record<string, Record<string, string>> = {
  en: {
    Mercury: 'Mercury',
    Venus: 'Venus',
    Earth: 'Earth',
    Mars: 'Mars',
    Jupiter: 'Jupiter',
    Saturn: 'Saturn',
    Uranus: 'Uranus',
    Neptune: 'Neptune',
    Moon: 'Moon',
  },
  zh: {
    Mercury: '水星',
    Venus: '金星',
    Earth: '地球',
    Mars: '火星',
    Jupiter: '木星',
    Saturn: '土星',
    Uranus: '天王星',
    Neptune: '海王星',
    Moon: '月球',
  },
};
