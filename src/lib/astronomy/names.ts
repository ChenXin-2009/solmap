/**
 * names.ts
 * 新增内容：
 * 1. 行星名字多语言映射（中文/英文）
 * 2. 可通过 Zustand lang 变量控制 Canvas 渲染语言
 */

export const planetNames: Record<string, Record<string, string>> = {
  en: {
    Sun: 'Sun',
    Mercury: 'Mercury',
    Venus: 'Venus',
    Earth: 'Earth',
    Mars: 'Mars',
    Jupiter: 'Jupiter',
    Saturn: 'Saturn',
    Uranus: 'Uranus',
    Neptune: 'Neptune',
    Moon: 'Moon',
    Io: 'Io',
    Europa: 'Europa',
    Ganymede: 'Ganymede',
    Callisto: 'Callisto',
    Titan: 'Titan',
    Enceladus: 'Enceladus',
    Miranda: 'Miranda',
    Ariel: 'Ariel',
    Umbriel: 'Umbriel',
    Titania: 'Titania',
    Triton: 'Triton',
  },
  zh: {
    Sun: '太阳',
    Mercury: '水星',
    Venus: '金星',
    Earth: '地球',
    Mars: '火星',
    Jupiter: '木星',
    Saturn: '土星',
    Uranus: '天王星',
    Neptune: '海王星',
    Moon: '月球',
    Io: '木卫一',
    Europa: '木卫二',
    Ganymede: '木卫三',
    Callisto: '木卫四',
    Titan: '土卫六',
    Enceladus: '土卫二',
    Miranda: '天卫一',
    Ariel: '天卫二',
    Umbriel: '天卫三',
    Titania: '天卫四',
    Triton: '海卫一',
  },
};
