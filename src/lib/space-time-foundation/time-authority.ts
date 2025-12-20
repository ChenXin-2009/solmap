/**
 * Time Authority Implementation
 * 
 * Single source of truth for time progression in the space-time foundation.
 * This component is the ONLY one allowed to modify system time.
 * 
 * CRITICAL: Protected by CORE_RULES.md - modifications require approval.
 */

import {
  TimeAuthority,
  TimeContinuityConstraints,
  SpaceTimeResult,
  UnsubscribeFunction,
  TimeUpdateCallback
} from './interfaces';
import {
  TIME_CONTINUITY_CONSTRAINTS,
  ERROR_CODES,
  ASTRONOMICAL_CONSTANTS
} from './constants';

/**
 * Time Authority Implementation
 * 
 * Manages time progression with quantified continuity constraints.
 * Ensures all system components receive time updates through subscriptions.
 */
export class TimeAuthorityImpl implements TimeAuthority {
  private currentJD: number;
  private speedMultiplier: number;
  private isRunningFlag: boolean;
  private subscribers: Set<TimeUpdateCallback>;
  private lastUpdateTime: number;
  private animationFrameId: number | null;

  constructor(initialJulianDate?: number) {
    this.currentJD = initialJulianDate ?? this.getCurrentJulianDateFromSystem();
    this.speedMultiplier = 1.0; // Real-time by default
    this.isRunningFlag = false;
    this.subscribers = new Set();
    this.lastUpdateTime = performance.now();
    this.animationFrameId = null;
  }

  /**
   * Get current system Julian Date from JavaScript Date
   */
  private getCurrentJulianDateFromSystem(): number {
    const now = new Date();
    return this.dateToJulianDay(now);
  }

  /**
   * Convert JavaScript Date to Julian Day
   * Based on Jean Meeus algorithm from existing time.ts
   */
  private dateToJulianDay(date: Date): number {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();
    const millisecond = date.getUTCMilliseconds();
    
    let y = year;
    let m = month;
    if (month <= 2) {
      y -= 1;
      m += 12;
    }
    
    const isGregorian = (year > 1582) || 
                        (year === 1582 && month > 10) ||
                        (year === 1582 && month === 10 && day >= 15);
    
    let A = 0;
    let B = 0;
    
    if (isGregorian) {
      A = Math.floor(y / 100);
      B = 2 - A + Math.floor(A / 4);
    }
    
    const JD = Math.floor(365.25 * (y + 4716)) +
               Math.floor(30.6001 * (m + 1)) +
               day + B - 1524.5;
    
    const dayFraction = (hour + minute / 60 + second / 3600 + millisecond / 3600000) / 24;
    
    return JD + dayFraction;
  }

  getCurrentJulianDate(): number {
    return this.currentJD;
  }

  setTimeSpeed(speedMultiplier: number): SpaceTimeResult<void> {
    // Validate speed multiplier against constraints
    const constraints = this.getConstraints();
    
    if (!Number.isFinite(speedMultiplier)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_SPEED_MULTIPLIER,
          message: `Speed multiplier must be finite, got: ${speedMultiplier}`
        }
      };
    }

    if (speedMultiplier < 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_SPEED_MULTIPLIER,
          message: `Speed multiplier must be non-negative, got: ${speedMultiplier}`
        }
      };
    }

    if (Math.abs(speedMultiplier) > constraints.maxSpeedMultiplier) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_SPEED_MULTIPLIER,
          message: `Speed multiplier ${speedMultiplier} exceeds maximum ${constraints.maxSpeedMultiplier}`
        }
      };
    }

    this.speedMultiplier = speedMultiplier;
    return { success: true, data: undefined };
  }

  setTime(julianDate: number): SpaceTimeResult<void> {
    // Validate Julian Date against constraints
    const constraints = this.getConstraints();
    
    if (!Number.isFinite(julianDate)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_TIME_RANGE,
          message: `Julian Date must be finite, got: ${julianDate}`
        }
      };
    }

    if (julianDate < constraints.minJulianDate || julianDate > constraints.maxJulianDate) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_TIME_RANGE,
          message: `Julian Date ${julianDate} outside valid range [${constraints.minJulianDate}, ${constraints.maxJulianDate}]`
        }
      };
    }

    // Check for discontinuity
    const timeDelta = Math.abs(julianDate - this.currentJD);
    if (timeDelta > constraints.maxTimeJumpDays) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.TIME_DISCONTINUITY,
          message: `Time jump of ${timeDelta} days exceeds maximum allowed ${constraints.maxTimeJumpDays} days`
        }
      };
    }

    this.currentJD = julianDate;
    this.notifySubscribers();
    
    return { success: true, data: undefined };
  }

  subscribe(callback: TimeUpdateCallback): UnsubscribeFunction {
    this.subscribers.add(callback);
    
    // Immediately notify new subscriber of current time (with error handling)
    try {
      callback(this.currentJD);
    } catch (error) {
      console.error('Error in time update callback during subscription:', error);
    }
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  validateTimeProgression(fromJD: number, toJD: number, speed: number): SpaceTimeResult<void> {
    const constraints = this.getConstraints();
    
    // Validate Julian Dates
    if (!Number.isFinite(fromJD) || !Number.isFinite(toJD)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_TIME_RANGE,
          message: `Julian Dates must be finite: from=${fromJD}, to=${toJD}`
        }
      };
    }

    // Validate range
    if (fromJD < constraints.minJulianDate || fromJD > constraints.maxJulianDate ||
        toJD < constraints.minJulianDate || toJD > constraints.maxJulianDate) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_TIME_RANGE,
          message: `Julian Dates outside valid range [${constraints.minJulianDate}, ${constraints.maxJulianDate}]`
        }
      };
    }

    // Validate speed
    if (!Number.isFinite(speed) || Math.abs(speed) > constraints.maxSpeedMultiplier) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_SPEED_MULTIPLIER,
          message: `Invalid speed multiplier: ${speed}`
        }
      };
    }

    // Validate time jump
    const timeDelta = Math.abs(toJD - fromJD);
    if (timeDelta > constraints.maxTimeJumpDays) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.TIME_DISCONTINUITY,
          message: `Time progression of ${timeDelta} days exceeds maximum ${constraints.maxTimeJumpDays} days`
        }
      };
    }

    return { success: true, data: undefined };
  }

  getConstraints(): TimeContinuityConstraints {
    return TIME_CONTINUITY_CONSTRAINTS;
  }

  start(): void {
    if (this.isRunningFlag) return;
    
    this.isRunningFlag = true;
    this.lastUpdateTime = performance.now();
    this.scheduleNextUpdate();
  }

  stop(): void {
    this.isRunningFlag = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  isRunning(): boolean {
    return this.isRunningFlag;
  }

  /**
   * Schedule next time update using requestAnimationFrame
   */
  private scheduleNextUpdate(): void {
    if (!this.isRunningFlag) return;

    this.animationFrameId = requestAnimationFrame((currentTime) => {
      this.updateTime(currentTime);
      this.scheduleNextUpdate();
    });
  }

  /**
   * Update time based on elapsed real time and speed multiplier
   */
  private updateTime(currentTime: number): void {
    const deltaMs = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    // Convert to days and apply speed multiplier
    const deltaDays = (deltaMs / ASTRONOMICAL_CONSTANTS.MS_PER_DAY) * this.speedMultiplier;
    
    // Apply constraints
    const constraints = this.getConstraints();
    const clampedDelta = Math.max(-constraints.maxTimeJumpDays, 
                                  Math.min(constraints.maxTimeJumpDays, deltaDays));
    
    const newJD = this.currentJD + clampedDelta;
    
    // Validate new time is within bounds
    if (newJD >= constraints.minJulianDate && newJD <= constraints.maxJulianDate) {
      this.currentJD = newJD;
      this.notifySubscribers();
    }
  }

  /**
   * Notify all subscribers of time change
   */
  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      try {
        callback(this.currentJD);
      } catch (error) {
        console.error('Error in time update callback:', error);
        // Continue notifying other subscribers
      }
    }
  }

  /**
   * Get current speed multiplier
   */
  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  /**
   * Get number of active subscribers
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Dispose of the time authority (cleanup)
   */
  dispose(): void {
    this.stop();
    this.subscribers.clear();
  }
}