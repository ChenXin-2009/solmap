/**
 * 时间转换模块
 * 提供日期与儒略日之间的转换
 * 参考：Jean Meeus - Astronomical Algorithms
 */

/**
 * J2000.0 历元的儒略日
 * 2000年1月1日 12:00:00 TT
 */
export const J2000 = 2451545.0;

/**
 * 将 JavaScript Date 对象转换为儒略日 (JD)
 * 
 * 儒略日是从公元前4713年1月1日12:00:00 UT开始计算的天数
 * 用于天文学中统一的时间表示
 * 
 * @param date - JavaScript Date 对象
 * @returns 儒略日 (JD)
 * 
 * @example
 * ```typescript
 * const jd = dateToJulianDay(new Date('2000-01-01T12:00:00Z'));
 * console.log(jd); // 2451545.0 (J2000.0)
 * ```
 */
export function dateToJulianDay(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // JavaScript月份从0开始
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const millisecond = date.getUTCMilliseconds();
  
  // Jean Meeus 算法
  // 处理1月和2月（视为前一年的13月和14月）
  let y = year;
  let m = month;
  if (month <= 2) {
    y -= 1;
    m += 12;
  }
  
  // 判断是否为格里高利历（1582年10月15日之后）
  const isGregorian = (year > 1582) || 
                      (year === 1582 && month > 10) ||
                      (year === 1582 && month === 10 && day >= 15);
  
  let A = 0;
  let B = 0;
  
  if (isGregorian) {
    A = Math.floor(y / 100);
    B = 2 - A + Math.floor(A / 4);
  }
  
  // 计算儒略日数（日期部分）
  const JD = Math.floor(365.25 * (y + 4716)) +
             Math.floor(30.6001 * (m + 1)) +
             day + B - 1524.5;
  
  // 加上时间部分（转换为天的小数）
  const dayFraction = (hour + minute / 60 + second / 3600 + millisecond / 3600000) / 24;
  
  return JD + dayFraction;
}

/**
 * 将儒略日 (JD) 转换为 JavaScript Date 对象
 * 
 * @param julianDay - 儒略日
 * @returns JavaScript Date 对象 (UTC)
 * 
 * @example
 * ```typescript
 * const date = julianDayToDate(2451545.0);
 * console.log(date.toISOString()); // '2000-01-01T12:00:00.000Z'
 * ```
 */
export function julianDayToDate(julianDay: number): Date {
  // 整数部分和小数部分
  const jd = julianDay + 0.5;
  const Z = Math.floor(jd);
  const F = jd - Z;
  
  let A = Z;
  
  if (Z >= 2299161) { // 格里高利历
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  
  // 日期
  const day = B - D - Math.floor(30.6001 * E) + F;
  const dayInt = Math.floor(day);
  const dayFrac = day - dayInt;
  
  // 月份
  let month = E < 14 ? E - 1 : E - 13;
  
  // 年份
  let year = month > 2 ? C - 4716 : C - 4715;
  
  // 时间部分
  const hours = dayFrac * 24;
  const hour = Math.floor(hours);
  const minutes = (hours - hour) * 60;
  const minute = Math.floor(minutes);
  const seconds = (minutes - minute) * 60;
  const second = Math.floor(seconds);
  const millisecond = Math.floor((seconds - second) * 1000);
  
  return new Date(Date.UTC(year, month - 1, dayInt, hour, minute, second, millisecond));
}

/**
 * 计算从J2000.0起的儒略世纪数
 * 
 * @param julianDay - 儒略日
 * @returns 儒略世纪数
 * 
 * @example
 * ```typescript
 * const T = julianCenturies(2451545.0);
 * console.log(T); // 0.0 (J2000.0)
 * ```
 */
export function julianCenturies(julianDay: number): number {
  return (julianDay - J2000) / 36525.0;
}

/**
 * 获取当前时刻的儒略日
 * 
 * @returns 当前的儒略日
 */
export function nowJulianDay(): number {
  return dateToJulianDay(new Date());
}

/**
 * 格式化儒略日为可读字符串
 * 
 * @param julianDay - 儒略日
 * @returns 格式化的字符串
 */
export function formatJulianDay(julianDay: number): string {
  const date = julianDayToDate(julianDay);
  return date.toISOString();
}