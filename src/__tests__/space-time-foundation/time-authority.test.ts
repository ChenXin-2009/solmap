/**
 * Property Tests for Time Authority
 * 
 * Feature: space-time-foundation, Property 5: Time Authority Exclusivity
 * Validates: Requirements 3.1, 3.2
 * 
 * Feature: space-time-foundation, Property 9: Time Continuity Preservation  
 * Validates: Requirements 9.1, 9.4
 * 
 * These tests verify that the Time Authority is the single source of truth
 * for time progression and maintains continuity constraints.
 */

import * as fc from 'fast-check';
import { TimeAuthorityImpl } from '@/lib/space-time-foundation/time-authority';
import {
  ASTRONOMICAL_CONSTANTS,
  TIME_CONTINUITY_CONSTRAINTS
} from '@/lib/space-time-foundation';

// Test utilities
const validJulianDateArbitrary = fc.double({
  min: TIME_CONTINUITY_CONSTRAINTS.minJulianDate,
  max: TIME_CONTINUITY_CONSTRAINTS.maxJulianDate,
  noNaN: true
});

const validSpeedMultiplierArbitrary = fc.double({
  min: 0,
  max: TIME_CONTINUITY_CONSTRAINTS.maxSpeedMultiplier,
  noNaN: true
});

const smallTimeJumpArbitrary = fc.double({
  min: -TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays,
  max: TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays,
  noNaN: true
});

describe('Time Authority Property Tests', () => {
  describe('Property 5: Time Authority Exclusivity', () => {
    test('Only Time Authority can modify system time', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          validJulianDateArbitrary,
          (initialTime, newTime) => {
            const timeAuthority = new TimeAuthorityImpl(initialTime);
            
            // Record initial time
            const startTime = timeAuthority.getCurrentJulianDate();
            expect(startTime).toBe(initialTime);
            
            // Only Time Authority should be able to change time
            const result = timeAuthority.setTime(newTime);
            
            if (Math.abs(newTime - initialTime) <= TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays) {
              // Should succeed for valid time jumps
              expect(result.success).toBe(true);
              expect(timeAuthority.getCurrentJulianDate()).toBe(newTime);
            } else {
              // Should fail for invalid time jumps
              expect(result.success).toBe(false);
              expect(timeAuthority.getCurrentJulianDate()).toBe(initialTime);
            }
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('All components receive time through subscriptions only', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          fc.array(validJulianDateArbitrary, { minLength: 1, maxLength: 10 }),
          (initialTime, timeUpdates) => {
            const timeAuthority = new TimeAuthorityImpl(initialTime);
            const receivedTimes: number[] = [];
            
            // Subscribe to time updates
            const unsubscribe = timeAuthority.subscribe((jd) => {
              receivedTimes.push(jd);
            });
            
            // Initial subscription should receive current time
            expect(receivedTimes.length).toBe(1);
            expect(receivedTimes[0]).toBe(initialTime);
            
            // Apply time updates through Time Authority
            let validUpdates = 0;
            let currentTime = initialTime;
            
            for (const newTime of timeUpdates) {
              if (Math.abs(newTime - currentTime) <= TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays) {
                const result = timeAuthority.setTime(newTime);
                if (result.success) {
                  validUpdates++;
                  currentTime = newTime;
                }
              }
            }
            
            // Should have received all valid updates plus initial
            expect(receivedTimes.length).toBe(validUpdates + 1);
            
            // Last received time should match current time
            expect(receivedTimes[receivedTimes.length - 1]).toBe(timeAuthority.getCurrentJulianDate());
            
            unsubscribe();
            timeAuthority.dispose();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Multiple subscribers receive consistent time updates', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          fc.integer({ min: 2, max: 10 }),
          validJulianDateArbitrary,
          (initialTime, subscriberCount, newTime) => {
            const timeAuthority = new TimeAuthorityImpl(initialTime);
            const subscriberTimes: number[][] = [];
            const unsubscribers: (() => void)[] = [];
            
            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const times: number[] = [];
              subscriberTimes.push(times);
              
              const unsubscribe = timeAuthority.subscribe((jd) => {
                times.push(jd);
              });
              unsubscribers.push(unsubscribe);
            }
            
            // All subscribers should receive initial time
            for (const times of subscriberTimes) {
              expect(times.length).toBe(1);
              expect(times[0]).toBe(initialTime);
            }
            
            // Update time
            if (Math.abs(newTime - initialTime) <= TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays) {
              const result = timeAuthority.setTime(newTime);
              if (result.success) {
                // All subscribers should receive the same update
                for (const times of subscriberTimes) {
                  expect(times.length).toBe(2);
                  expect(times[1]).toBe(newTime);
                }
              }
            }
            
            // Cleanup
            unsubscribers.forEach(unsub => unsub());
            timeAuthority.dispose();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Speed multiplier affects time progression consistently', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          validSpeedMultiplierArbitrary,
          (initialTime, speed) => {
            const timeAuthority = new TimeAuthorityImpl(initialTime);
            
            // Set speed multiplier
            const result = timeAuthority.setTimeSpeed(speed);
            expect(result.success).toBe(true);
            expect(timeAuthority.getSpeedMultiplier()).toBe(speed);
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Time Continuity Preservation', () => {
    test('Time progression maintains continuous Julian Date precision', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          fc.array(smallTimeJumpArbitrary, { minLength: 1, maxLength: 20 }),
          (initialTime, timeDeltas) => {
            const timeAuthority = new TimeAuthorityImpl(initialTime);
            let currentTime = initialTime;
            let previousTime = initialTime;
            
            for (const delta of timeDeltas) {
              const newTime = currentTime + delta;
              
              // Skip if outside valid range
              if (newTime < TIME_CONTINUITY_CONSTRAINTS.minJulianDate || 
                  newTime > TIME_CONTINUITY_CONSTRAINTS.maxJulianDate) {
                continue;
              }
              
              const result = timeAuthority.setTime(newTime);
              
              if (result.success) {
                const actualTime = timeAuthority.getCurrentJulianDate();
                
                // Time should be exactly what we set (precision preservation)
                expect(actualTime).toBe(newTime);
                
                // Time should progress continuously (no unexpected jumps)
                const actualDelta = actualTime - previousTime;
                expect(Math.abs(actualDelta)).toBeLessThanOrEqual(TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays);
                
                previousTime = actualTime;
                currentTime = newTime;
              }
            }
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('System prevents time discontinuities that break calculations', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          fc.double({ min: TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays + 1, max: 1000, noNaN: true }),
          (initialTime, largeJump) => {
            const timeAuthority = new TimeAuthorityImpl(initialTime);
            
            // Attempt large time jump (should be rejected)
            const newTime = initialTime + largeJump;
            const result = timeAuthority.setTime(newTime);
            
            // Should fail (either due to discontinuity or range check)
            expect(result.success).toBe(false);
            expect(['TIME_DISCONTINUITY', 'INVALID_TIME_RANGE']).toContain(result.error?.code);
            
            // Time should remain unchanged
            expect(timeAuthority.getCurrentJulianDate()).toBe(initialTime);
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Time validation prevents invalid progressions', () => {
      fc.assert(
        fc.property(
          validJulianDateArbitrary,
          validJulianDateArbitrary,
          validSpeedMultiplierArbitrary,
          (fromJD, toJD, speed) => {
            const timeAuthority = new TimeAuthorityImpl();
            
            const result = timeAuthority.validateTimeProgression(fromJD, toJD, speed);
            
            const timeDelta = Math.abs(toJD - fromJD);
            const isValidRange = fromJD >= TIME_CONTINUITY_CONSTRAINTS.minJulianDate &&
                               fromJD <= TIME_CONTINUITY_CONSTRAINTS.maxJulianDate &&
                               toJD >= TIME_CONTINUITY_CONSTRAINTS.minJulianDate &&
                               toJD <= TIME_CONTINUITY_CONSTRAINTS.maxJulianDate;
            const isValidJump = timeDelta <= TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays;
            const isValidSpeed = speed <= TIME_CONTINUITY_CONSTRAINTS.maxSpeedMultiplier;
            
            if (isValidRange && isValidJump && isValidSpeed) {
              expect(result.success).toBe(true);
            } else {
              expect(result.success).toBe(false);
              expect(result.error?.code).toBeDefined();
            }
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Time constraints are consistently enforced', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: -1e10, max: TIME_CONTINUITY_CONSTRAINTS.minJulianDate - 1 }),
            fc.double({ min: TIME_CONTINUITY_CONSTRAINTS.maxJulianDate + 1, max: 1e10 })
          ),
          (invalidTime) => {
            const timeAuthority = new TimeAuthorityImpl();
            
            // Attempt to set invalid time
            const result = timeAuthority.setTime(invalidTime);
            
            // Should fail
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_TIME_RANGE');
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Speed multiplier constraints are enforced', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: -1e6, max: -1 }),
            fc.double({ min: TIME_CONTINUITY_CONSTRAINTS.maxSpeedMultiplier + 1, max: 1e10 }),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity)
          ),
          (invalidSpeed) => {
            const timeAuthority = new TimeAuthorityImpl();
            
            // Attempt to set invalid speed
            const result = timeAuthority.setTimeSpeed(invalidSpeed);
            
            // Should fail
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INVALID_SPEED_MULTIPLIER');
            
            timeAuthority.dispose();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Subscription Management', () => {
    test('Unsubscribe function works correctly', () => {
      const timeAuthority = new TimeAuthorityImpl();
      let callCount = 0;
      
      const unsubscribe = timeAuthority.subscribe(() => {
        callCount++;
      });
      
      expect(callCount).toBe(1); // Initial call
      
      // Update time
      timeAuthority.setTime(timeAuthority.getCurrentJulianDate() + 0.1);
      expect(callCount).toBe(2);
      
      // Unsubscribe
      unsubscribe();
      
      // Update time again
      timeAuthority.setTime(timeAuthority.getCurrentJulianDate() + 0.1);
      expect(callCount).toBe(2); // Should not increase
      
      timeAuthority.dispose();
    });

    test('Error in callback does not affect other subscribers', () => {
      const timeAuthority = new TimeAuthorityImpl();
      const goodCallbacks: number[] = [];
      
      // Subscribe with error-throwing callback
      timeAuthority.subscribe(() => {
        throw new Error('Test error');
      });
      
      // Subscribe with good callback
      timeAuthority.subscribe((jd) => {
        goodCallbacks.push(jd);
      });
      
      expect(goodCallbacks.length).toBe(1); // Initial call
      
      // Update time - should not crash
      const result = timeAuthority.setTime(timeAuthority.getCurrentJulianDate() + 0.1);
      expect(result.success).toBe(true);
      expect(goodCallbacks.length).toBe(2); // Should still receive update
      
      timeAuthority.dispose();
    });
  });
});