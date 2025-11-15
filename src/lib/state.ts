/**
 * Zustand 全局状态管理
 * 管理太阳系模拟的所有状态和交互逻辑
 */

import { create } from 'zustand';
import { CelestialBody, getCelestialBodies } from './astronomy/orbit';
import { dateToJulianDay } from './astronomy/time';

/**
 * 视图偏移量接口
 */
export interface ViewOffset {
  x: number; // X轴偏移 (AU)
  y: number; // Y轴偏移 (AU)
}

/**
 * 支持语言类型
 */
export type Language = 'en' | 'zh';

/**
 * 状态接口
 */
export interface SolarSystemState {
  // ========== 时间状态 ==========
  currentTime: Date;
  isPlaying: boolean;
  timeSpeed: number;
  
  // ========== 天体数据 ==========
  celestialBodies: CelestialBody[];
  selectedPlanet: string | null;
  
  // ========== 视图状态 ==========
  viewOffset: ViewOffset;
  zoom: number;

  // ========== 语言 ==========
  lang: Language;               // 当前语言
  setLang: (lang: Language) => void; // 切换语言

  // ========== 操作方法 ==========
  setCurrentTime: (date: Date) => void;
  togglePlayPause: () => void;
  setTimeSpeed: (speed: number) => void;
  tick: (deltaSeconds: number) => void;
  selectPlanet: (name: string | null) => void;
  setViewOffset: (offset: ViewOffset) => void;
  setZoom: (zoom: number) => void;
  centerOnPlanet: (name: string) => void;
  resetToNow: () => void;
  resetView: () => void;
}

/**
 * 默认缩放级别
 */
const DEFAULT_ZOOM = 50;
const MIN_ZOOM = 10;
const MAX_ZOOM = 200;

/**
 * 创建 Zustand Store
 */
export const useSolarSystemStore = create<SolarSystemState>((set, get) => {
  const initialTime = new Date();
  const initialJD = dateToJulianDay(initialTime);
  
  return {
    // ========== 初始状态 ==========
    currentTime: initialTime,
    isPlaying: false,
    timeSpeed: 1,
    celestialBodies: getCelestialBodies(initialJD),
    selectedPlanet: null,
    viewOffset: { x: 0, y: 0 },
    zoom: DEFAULT_ZOOM,
    
    // ========== 语言 ==========
    lang: 'zh', // 默认中文
    setLang: (lang: Language) => set({ lang }),

    // ========== 方法 ==========
    setCurrentTime: (date: Date) => {
      const jd = dateToJulianDay(date);
      const bodies = getCelestialBodies(jd);
      set({ currentTime: date, celestialBodies: bodies });
    },
    
    togglePlayPause: () => {
      set((state) => ({ isPlaying: !state.isPlaying }));
    },
    
    setTimeSpeed: (speed: number) => {
      const clampedSpeed = Math.max(0.1, Math.min(1000, speed));
      set({ timeSpeed: clampedSpeed });
    },
    
    tick: (deltaSeconds: number) => {
      const state = get();
      if (!state.isPlaying) return;
      const deltaDays = deltaSeconds * state.timeSpeed;
      const newTime = new Date(state.currentTime.getTime() + deltaDays * 86400000);
      state.setCurrentTime(newTime);
    },
    
    selectPlanet: (name: string | null) => {
      set({ selectedPlanet: name });
    },
    
    setViewOffset: (offset: ViewOffset) => set({ viewOffset: offset }),
    
    setZoom: (zoom: number) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      set({ zoom: clampedZoom });
    },
    
    centerOnPlanet: (name: string) => {
      const state = get();
      const body = state.celestialBodies.find((b) => b.name === name);
      if (body) {
        set({ selectedPlanet: name, viewOffset: { x: -body.x, y: -body.y } });
      }
    },
    
    resetToNow: () => {
      const now = new Date();
      get().setCurrentTime(now);
      set({ isPlaying: false });
    },
    
    resetView: () => {
      set({
        viewOffset: { x: 0, y: 0 },
        zoom: DEFAULT_ZOOM,
        selectedPlanet: null
      });
    }
  };
});

// 文件末尾修改为：
export type { CelestialBody };

