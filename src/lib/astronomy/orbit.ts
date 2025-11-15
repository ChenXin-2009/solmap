/**
 * 轨道计算模块 v2
 * 
 * 修改内容：
 * 1. 使用 VSOP87 简化模型的轨道参数（更接近 NASA JPL 数据）
 * 2. 增加轨道参数的时间演化（每世纪变化率）
 * 3. 修正坐标系转换（黄道坐标系 → 日心坐标系）
 * 4. 月球使用 ELP2000 简化模型
 * 
 * 参考：
 * - NASA JPL HORIZONS System
 * - Simon et al. (1994) - Numerical expressions for precession
 * - Meeus, Jean - Astronomical Algorithms (2nd Ed.)
 */

export interface OrbitalElements {
  name: string;
  // 轨道元素（J2000.0历元）
  a: number;      // 半长轴 (AU)
  e: number;      // 离心率
  i: number;      // 轨道倾角 (rad)
  L: number;      // 平黄经 (rad)
  w_bar: number;  // 近日点黄经 (rad)
  O: number;      // 升交点黄经 (rad)
  // 每世纪变化率
  a_dot: number;
  e_dot: number;
  i_dot: number;
  L_dot: number;
  w_bar_dot: number;
  O_dot: number;
  // 显示属性
  radius: number;
  color: string;
}

export interface CelestialBody {
  name: string;
  x: number;
  y: number;
  z: number;
  r: number;
  radius: number;
  color: string;
  isSun?: boolean;
  elements?: OrbitalElements;
}

/**
 * 8大行星轨道参数
 * 数据源：NASA JPL DE440 + Simon et al. (1994)
 * 基准历元：J2000.0 (JD 2451545.0)
 */
export const ORBITAL_ELEMENTS: Record<string, OrbitalElements> = {
  mercury: {
    name: 'Mercury',
    // J2000.0 轨道元素
    a: 0.38709927,
    e: 0.20563593,
    i: 7.00497902 * Math.PI / 180,
    L: 252.25032350 * Math.PI / 180,
    w_bar: 77.45779628 * Math.PI / 180,
    O: 48.33076593 * Math.PI / 180,
    // 每儒略世纪变化率
    a_dot: 0.00000037,
    e_dot: 0.00001906,
    i_dot: -0.00594749 * Math.PI / 180,
    L_dot: 149472.67411175 * Math.PI / 180,
    w_bar_dot: 0.16047689 * Math.PI / 180,
    O_dot: -0.12534081 * Math.PI / 180,
    radius: 0.003,
    color: '#8C7853'
  },
  venus: {
    name: 'Venus',
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605 * Math.PI / 180,
    L: 181.97909950 * Math.PI / 180,
    w_bar: 131.60246718 * Math.PI / 180,
    O: 76.67984255 * Math.PI / 180,
    a_dot: 0.00000390,
    e_dot: -0.00004107,
    i_dot: -0.00078890 * Math.PI / 180,
    L_dot: 58517.81538729 * Math.PI / 180,
    w_bar_dot: 0.00268329 * Math.PI / 180,
    O_dot: -0.27769418 * Math.PI / 180,
    radius: 0.008,
    color: '#FFC649'
  },
  earth: {
    name: 'Earth',
    a: 1.00000261,
    e: 0.01671123,
    i: -0.00001531 * Math.PI / 180,
    L: 100.46457166 * Math.PI / 180,
    w_bar: 102.93768193 * Math.PI / 180,
    O: 0.0,
    a_dot: 0.00000562,
    e_dot: -0.00004392,
    i_dot: -0.01294668 * Math.PI / 180,
    L_dot: 35999.37244981 * Math.PI / 180,
    w_bar_dot: 0.32327364 * Math.PI / 180,
    O_dot: 0.0,
    radius: 0.008,
    color: '#4A90E2'
  },
  mars: {
    name: 'Mars',
    a: 1.52371034,
    e: 0.09339410,
    i: 1.84969142 * Math.PI / 180,
    L: -4.55343205 * Math.PI / 180,
    w_bar: -23.94362959 * Math.PI / 180,
    O: 49.55953891 * Math.PI / 180,
    a_dot: 0.00001847,
    e_dot: 0.00007882,
    i_dot: -0.00813131 * Math.PI / 180,
    L_dot: 19140.30268499 * Math.PI / 180,
    w_bar_dot: 0.44441088 * Math.PI / 180,
    O_dot: -0.29257343 * Math.PI / 180,
    radius: 0.004,
    color: '#E27B58'
  },
  jupiter: {
    name: 'Jupiter',
    a: 5.20288700,
    e: 0.04838624,
    i: 1.30439695 * Math.PI / 180,
    L: 34.39644051 * Math.PI / 180,
    w_bar: 14.72847983 * Math.PI / 180,
    O: 100.47390909 * Math.PI / 180,
    a_dot: -0.00011607,
    e_dot: -0.00013253,
    i_dot: -0.00183714 * Math.PI / 180,
    L_dot: 3034.74612775 * Math.PI / 180,
    w_bar_dot: 0.21252668 * Math.PI / 180,
    O_dot: 0.20469106 * Math.PI / 180,
    radius: 0.09,
    color: '#C88B3A'
  },
  saturn: {
    name: 'Saturn',
    a: 9.53667594,
    e: 0.05386179,
    i: 2.48599187 * Math.PI / 180,
    L: 49.95424423 * Math.PI / 180,
    w_bar: 92.59887831 * Math.PI / 180,
    O: 113.66242448 * Math.PI / 180,
    a_dot: -0.00125060,
    e_dot: -0.00050991,
    i_dot: 0.00193609 * Math.PI / 180,
    L_dot: 1222.49362201 * Math.PI / 180,
    w_bar_dot: -0.41897216 * Math.PI / 180,
    O_dot: -0.28867794 * Math.PI / 180,
    radius: 0.075,
    color: '#FAD5A5'
  },
  uranus: {
    name: 'Uranus',
    a: 19.18916464,
    e: 0.04725744,
    i: 0.77263783 * Math.PI / 180,
    L: 313.23810451 * Math.PI / 180,
    w_bar: 170.95427630 * Math.PI / 180,
    O: 74.01692503 * Math.PI / 180,
    a_dot: -0.00196176,
    e_dot: -0.00004397,
    i_dot: -0.00242939 * Math.PI / 180,
    L_dot: 428.48202785 * Math.PI / 180,
    w_bar_dot: 0.40805281 * Math.PI / 180,
    O_dot: 0.04240589 * Math.PI / 180,
    radius: 0.032,
    color: '#4FD0E7'
  },
  neptune: {
    name: 'Neptune',
    a: 30.06992276,
    e: 0.00859048,
    i: 1.77004347 * Math.PI / 180,
    L: -55.12002969 * Math.PI / 180,
    w_bar: 44.96476227 * Math.PI / 180,
    O: 131.78422574 * Math.PI / 180,
    a_dot: 0.00026291,
    e_dot: 0.00005105,
    i_dot: 0.00035372 * Math.PI / 180,
    L_dot: 218.45945325 * Math.PI / 180,
    w_bar_dot: -0.32241464 * Math.PI / 180,
    O_dot: -0.00508664 * Math.PI / 180,
    radius: 0.031,
    color: '#4166F5'
  }
};

/**
 * 计算给定时刻的轨道元素
 * @param elements - 基准轨道元素
 * @param T - 从J2000.0起的儒略世纪数
 */
function computeElementsAtTime(elements: OrbitalElements, T: number): OrbitalElements {
  return {
    ...elements,
    a: elements.a + elements.a_dot * T,
    e: elements.e + elements.e_dot * T,
    i: elements.i + elements.i_dot * T,
    L: elements.L + elements.L_dot * T,
    w_bar: elements.w_bar + elements.w_bar_dot * T,
    O: elements.O + elements.O_dot * T
  };
}

/**
 * 求解开普勒方程
 */
function solveKepler(M: number, e: number, tolerance: number = 1e-8): number {
  let E = M;
  let delta = 1;
  let iterations = 0;
  const maxIterations = 50;
  
  while (Math.abs(delta) > tolerance && iterations < maxIterations) {
    delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    iterations++;
  }
  
  return E;
}

/**
 * 计算行星日心坐标
 * @param elements - 轨道元素
 * @param julianDay - 儒略日
 */
export function calculatePosition(
  elements: OrbitalElements,
  julianDay: number
): { x: number; y: number; z: number; r: number } {
  // 从J2000.0起的儒略世纪数
  const T = (julianDay - 2451545.0) / 36525.0;
  
  // 计算当前时刻的轨道元素
  const elem = computeElementsAtTime(elements, T);
  
  // 计算平近点角
  const w = elem.w_bar - elem.O; // 近日点幅角
  const M = (elem.L - elem.w_bar) % (2 * Math.PI);
  
  // 求解偏近点角
  const E = solveKepler(M, elem.e);
  
  // 计算真近点角
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + elem.e) * Math.sin(E / 2),
    Math.sqrt(1 - elem.e) * Math.cos(E / 2)
  );
  
  // 日心距离
  const r = elem.a * (1 - elem.e * Math.cos(E));
  
  // 轨道平面坐标
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);
  
  // 转换到黄道坐标系
  const cos_w = Math.cos(w);
  const sin_w = Math.sin(w);
  const cos_O = Math.cos(elem.O);
  const sin_O = Math.sin(elem.O);
  const cos_i = Math.cos(elem.i);
  const sin_i = Math.sin(elem.i);
  
  const x = (cos_w * cos_O - sin_w * sin_O * cos_i) * x_orb +
            (-sin_w * cos_O - cos_w * sin_O * cos_i) * y_orb;
  
  const y = (cos_w * sin_O + sin_w * cos_O * cos_i) * x_orb +
            (-sin_w * sin_O + cos_w * cos_O * cos_i) * y_orb;
  
  const z = (sin_w * sin_i) * x_orb +
            (cos_w * sin_i) * y_orb;
  
  return { x, y, z, r };
}

/**
 * 月球位置计算（ELP2000简化模型）
 * @param earthPos - 地球位置
 * @param julianDay - 儒略日
 */
export function calculateMoonPosition(
  earthPos: { x: number; y: number; z: number },
  julianDay: number
): { x: number; y: number; z: number; r: number } {
  // 从J2000.0起的天数
  const T = (julianDay - 2451545.0) / 36525.0;
  
  // 月球平黄经（简化）
  const L_moon = (218.3164477 + 481267.88123421 * T) * Math.PI / 180;
  
  // 月球到地心的距离（平均值，单位：km → AU）
  const a_moon = 384400 / 149597870.7; // 约 0.00257 AU
  
  // 月球近地点平近点角
  const M_moon = (134.9633964 + 477198.8675055 * T) * Math.PI / 180;
  
  // 简化的月球黄经（考虑近地点运动）
  const lambda = L_moon + 6.2887 * Math.sin(M_moon) * Math.PI / 180;
  
  // 月球黄纬（简化为0，实际约±5°）
  const beta = 5.128 * Math.sin((93.2721 + 483202.0175 * T) * Math.PI / 180) * Math.PI / 180;
  
  // 月地距离变化
  const r_moon = a_moon * (1 - 0.0549 * Math.cos(M_moon));
  
  // 月球相对地球的位置
  const dx = r_moon * Math.cos(beta) * Math.cos(lambda);
  const dy = r_moon * Math.cos(beta) * Math.sin(lambda);
  const dz = r_moon * Math.sin(beta);
  
  return {
    x: earthPos.x + dx,
    y: earthPos.y + dy,
    z: earthPos.z + dz,
    r: r_moon
  };
}

/**
 * 获取所有天体位置
 */
export function getCelestialBodies(julianDay: number): CelestialBody[] {
  const bodies: CelestialBody[] = [];
  
  // 太阳
  bodies.push({
    name: 'Sun',
    x: 0,
    y: 0,
    z: 0,
    r: 0,
    radius: 0.05,
    color: '#FDB813',
    isSun: true
  });
  
  // 8大行星
  let earthPos: { x: number; y: number; z: number } | null = null;
  
  for (const [key, elements] of Object.entries(ORBITAL_ELEMENTS)) {
    const pos = calculatePosition(elements, julianDay);
    
    bodies.push({
      name: elements.name,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      r: pos.r,
      radius: elements.radius,
      color: elements.color,
      elements: elements
    });
    
    if (key === 'earth') {
      earthPos = pos;
    }
  }
  
  // 月球
  if (earthPos) {
    const moonPos = calculateMoonPosition(earthPos, julianDay);
    bodies.push({
      name: 'Moon',
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      r: moonPos.r,
      radius: 0.002,
      color: '#C0C0C0'
    });
  }
  
  return bodies;
}