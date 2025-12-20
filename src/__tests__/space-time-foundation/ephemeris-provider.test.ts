/**
 * Ephemeris Provider Property Tests
 * 
 * Property-based tests for EphemerisProvider interface compliance.
 * Validates universal correctness properties across all providers.
 * 
 * CRITICAL: These tests validate CORE_RULES.md constraints.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';

import {
  EphemerisProvider,
  StateVector,
  SpaceTimeResult
} from '../../lib/space-time-foundation/interfaces';
import {
  STANDARD_BODY_IDS,
  ERROR_CODES,
  ASTRONOMICAL_CONSTANTS,
  PRIMARY_REFERENCE_FRAME
} from '../../lib/space-time-foundation/constants';
import { VSOP87Provider } from '../../lib/space-time-foundation/vsop87-provider';
import { EphemerisStrategyImpl } from '../../lib/space-time-foundation/ephemeris-router';

describe('Ephemeris Provider Property Tests', () => {
  let provider: EphemerisProvider;
  let strategy: EphemerisStrategyImpl;

  beforeEach(() => {
    provider = new VSOP87Provider();
    strategy = new EphemerisStrategyImpl();
  });

  afterEach(() => {
    strategy.clear();
  });

  /**
   * Property 7: Provider Interface Compliance
   * 
   * VALIDATES: Requirements 5.5
   * CONSTRAINT: All providers must implement interface correctly
   */
  describe('Property 7: Provider Interface Compliance', () => {
    test('provider ID must be non-empty string', () => {
      fc.assert(fc.property(
        fc.constant(provider),
        (testProvider) => {
          const providerId = testProvider.getProviderId();
          
          expect(typeof providerId).toBe('string');
          expect(providerId.length).toBeGreaterThan(0);
          expect(providerId.trim()).toBe(providerId); // No leading/trailing whitespace
        }
      ), { numRuns: 100 });
    });

    test('supported bodies must be non-empty array of strings', () => {
      fc.assert(fc.property(
        fc.constant(provider),
        (testProvider) => {
          const supportedBodies = testProvider.getSupportedBodies();
          
          expect(Array.isArray(supportedBodies)).toBe(true);
          expect(supportedBodies.length).toBeGreaterThan(0);
          
          for (const bodyId of supportedBodies) {
            expect(typeof bodyId).toBe('string');
            expect(bodyId.length).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 100 });
    });

    test('time range must be valid with startJD < endJD', () => {
      fc.assert(fc.property(
        fc.constant(provider),
        (testProvider) => {
          const timeRange = testProvider.getTimeRange();
          
          expect(typeof timeRange.startJD).toBe('number');
          expect(typeof timeRange.endJD).toBe('number');
          expect(Number.isFinite(timeRange.startJD)).toBe(true);
          expect(Number.isFinite(timeRange.endJD)).toBe(true);
          expect(timeRange.startJD).toBeLessThan(timeRange.endJD);
        }
      ), { numRuns: 100 });
    });

    test('getState must return valid SpaceTimeResult for supported bodies and times', () => {
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyId, julianDate) => {
          const result = provider.getState(bodyId, julianDate);
          
          // Must return SpaceTimeResult
          expect(typeof result).toBe('object');
          expect(typeof result.success).toBe('boolean');
          
          if (result.success) {
            const state = result.data;
            
            // Validate StateVector structure
            expect(typeof state).toBe('object');
            expect(typeof state.position).toBe('object');
            expect(typeof state.velocity).toBe('object');
            expect(typeof state.radius).toBe('number');
            expect(typeof state.metadata).toBe('object');
            
            // Validate Vector3 structure
            expect(typeof state.position.x).toBe('number');
            expect(typeof state.position.y).toBe('number');
            expect(typeof state.position.z).toBe('number');
            expect(typeof state.velocity.x).toBe('number');
            expect(typeof state.velocity.y).toBe('number');
            expect(typeof state.velocity.z).toBe('number');
            
            // All values must be finite
            expect(Number.isFinite(state.position.x)).toBe(true);
            expect(Number.isFinite(state.position.y)).toBe(true);
            expect(Number.isFinite(state.position.z)).toBe(true);
            expect(Number.isFinite(state.velocity.x)).toBe(true);
            expect(Number.isFinite(state.velocity.y)).toBe(true);
            expect(Number.isFinite(state.velocity.z)).toBe(true);
            expect(Number.isFinite(state.radius)).toBe(true);
            
            // Radius must be positive
            expect(state.radius).toBeGreaterThan(0);
            
            // Validate metadata
            expect(typeof state.metadata.julianDate).toBe('number');
            expect(typeof state.metadata.referenceFrame).toBe('string');
            expect(typeof state.metadata.provider).toBe('string');
            expect(state.metadata.julianDate).toBe(julianDate);
            expect(state.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            expect(state.metadata.provider).toBe(provider.getProviderId());
          } else {
            // Must have error with code and message
            expect(typeof result.error).toBe('object');
            expect(typeof result.error.code).toBe('string');
            expect(typeof result.error.message).toBe('string');
            expect(result.error.code.length).toBeGreaterThan(0);
            expect(result.error.message.length).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 100 });
    });

    test('getState must reject invalid inputs consistently', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant(''), // Empty string
          fc.constant(null as any), // Null
          fc.constant(undefined as any), // Undefined
          fc.string().filter(s => !provider.getSupportedBodies().includes(s)) // Unsupported body
        ),
        fc.oneof(
          fc.constant(NaN), // NaN
          fc.constant(Infinity), // Infinity
          fc.constant(-Infinity), // -Infinity
          fc.double({ min: -1e10, max: provider.getTimeRange().startJD - 1 }), // Before range
          fc.double({ min: provider.getTimeRange().endJD + 1, max: 1e10 }) // After range
        ),
        (invalidBodyId, invalidJulianDate) => {
          const result = provider.getState(invalidBodyId, invalidJulianDate);
          
          expect(result.success).toBe(false);
          expect(typeof result.error.code).toBe('string');
          expect(typeof result.error.message).toBe('string');
          
          // Error codes must be from our defined set
          const validErrorCodes = Object.values(ERROR_CODES);
          expect(validErrorCodes).toContain(result.error.code);
        }
      ), { numRuns: 100 });
    });

    test('getAccuracy must return positive number for supported bodies', () => {
      const supportedBodies = provider.getSupportedBodies();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        (bodyId) => {
          const accuracy = provider.getAccuracy(bodyId);
          
          expect(typeof accuracy).toBe('number');
          expect(Number.isFinite(accuracy)).toBe(true);
          expect(accuracy).toBeGreaterThan(0);
        }
      ), { numRuns: 100 });
    });

    test('supportsVelocity must return boolean', () => {
      fc.assert(fc.property(
        fc.constant(provider),
        (testProvider) => {
          const supportsVel = testProvider.supportsVelocity();
          expect(typeof supportsVel).toBe('boolean');
        }
      ), { numRuns: 100 });
    });

    test('getStates bulk operation must be consistent with individual getState calls', () => {
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.array(
          fc.double({ 
            min: timeRange.startJD, 
            max: timeRange.endJD,
            noNaN: true,
            noDefaultInfinity: true
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (bodyId, julianDates) => {
          const bulkResult = provider.getStates(bodyId, julianDates);
          
          if (bulkResult.success) {
            const bulkStates = bulkResult.data;
            expect(bulkStates.length).toBe(julianDates.length);
            
            // Compare with individual calls
            for (let i = 0; i < julianDates.length; i++) {
              const individualResult = provider.getState(bodyId, julianDates[i]);
              
              if (individualResult.success) {
                const bulkState = bulkStates[i];
                const individualState = individualResult.data;
                
                // Positions should be very close (within numerical precision)
                expect(Math.abs(bulkState.position.x - individualState.position.x)).toBeLessThan(1e-6);
                expect(Math.abs(bulkState.position.y - individualState.position.y)).toBeLessThan(1e-6);
                expect(Math.abs(bulkState.position.z - individualState.position.z)).toBeLessThan(1e-6);
                
                // Velocities should be very close
                expect(Math.abs(bulkState.velocity.x - individualState.velocity.x)).toBeLessThan(1e-9);
                expect(Math.abs(bulkState.velocity.y - individualState.velocity.y)).toBeLessThan(1e-9);
                expect(Math.abs(bulkState.velocity.z - individualState.velocity.z)).toBeLessThan(1e-9);
                
                // Radius and metadata should be identical
                expect(bulkState.radius).toBe(individualState.radius);
                expect(bulkState.metadata.julianDate).toBe(individualState.metadata.julianDate);
                expect(bulkState.metadata.referenceFrame).toBe(individualState.metadata.referenceFrame);
                expect(bulkState.metadata.provider).toBe(individualState.metadata.provider);
              }
            }
          }
        }
      ), { numRuns: 50 }); // Reduced runs for bulk operations
    });
  });

  /**
   * Property Tests for Ephemeris Strategy
   * 
   * VALIDATES: Provider registration and selection logic
   */
  describe('Ephemeris Strategy Property Tests', () => {
    test('provider registration must be idempotent for same provider', () => {
      fc.assert(fc.property(
        fc.constant(provider),
        (testProvider) => {
          // Create fresh strategy for each test
          const testStrategy = new EphemerisStrategyImpl();
          
          // First registration should succeed
          const result1 = testStrategy.registerProvider(testProvider);
          expect(result1.success).toBe(true);
          
          // Second registration should fail (already registered)
          const result2 = testStrategy.registerProvider(testProvider);
          expect(result2.success).toBe(false);
          expect(result2.error.code).toBe(ERROR_CODES.INVALID_CONFIGURATION);
        }
      ), { numRuns: 100 });
    });

    test('provider selection must respect body support and time range', () => {
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      // Register provider
      const regResult = strategy.registerProvider(provider);
      expect(regResult.success).toBe(true);
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyId, julianDate) => {
          const selectionResult = strategy.selectProvider(bodyId, julianDate);
          
          expect(selectionResult.success).toBe(true);
          if (selectionResult.success) {
            const selectedProvider = selectionResult.data;
            expect(selectedProvider.getProviderId()).toBe(provider.getProviderId());
            expect(selectedProvider.getSupportedBodies()).toContain(bodyId);
            
            const selectedTimeRange = selectedProvider.getTimeRange();
            expect(julianDate).toBeGreaterThanOrEqual(selectedTimeRange.startJD);
            expect(julianDate).toBeLessThanOrEqual(selectedTimeRange.endJD);
          }
        }
      ), { numRuns: 100 });
    });

    test('provider selection must fail for unsupported bodies or times', () => {
      // Register provider
      const regResult = strategy.registerProvider(provider);
      expect(regResult.success).toBe(true);
      
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.oneof(
          // Unsupported body with valid time
          fc.record({
            bodyId: fc.string().filter(s => !supportedBodies.includes(s) && s.length > 0),
            julianDate: fc.double({ 
              min: timeRange.startJD, 
              max: timeRange.endJD,
              noNaN: true,
              noDefaultInfinity: true
            })
          }),
          // Supported body with invalid time
          fc.record({
            bodyId: fc.constantFrom(...supportedBodies),
            julianDate: fc.oneof(
              fc.double({ min: -1e10, max: timeRange.startJD - 1, noNaN: true, noDefaultInfinity: true }),
              fc.double({ min: timeRange.endJD + 1, max: 1e10, noNaN: true, noDefaultInfinity: true })
            )
          })
        ),
        (testCase) => {
          const selectionResult = strategy.selectProvider(testCase.bodyId, testCase.julianDate);
          expect(selectionResult.success).toBe(false);
          expect(selectionResult.error.code).toBe(ERROR_CODES.PROVIDER_UNAVAILABLE);
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Integration Property Tests
   * 
   * VALIDATES: End-to-end provider behavior
   */
  describe('Integration Property Tests', () => {
    test('state vectors must maintain physical consistency', () => {
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD - 1, // Leave room for t+dt
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyId, julianDate) => {
          const dt = 1.0 / 24.0; // 1 hour
          
          const state1Result = provider.getState(bodyId, julianDate);
          const state2Result = provider.getState(bodyId, julianDate + dt);
          
          if (state1Result.success && state2Result.success) {
            const state1 = state1Result.data;
            const state2 = state2Result.data;
            
            // Position change should be consistent with velocity
            const expectedDx = state1.velocity.x * dt * 24 * 3600; // Convert days to seconds
            const expectedDy = state1.velocity.y * dt * 24 * 3600;
            const expectedDz = state1.velocity.z * dt * 24 * 3600;
            
            const actualDx = state2.position.x - state1.position.x;
            const actualDy = state2.position.y - state1.position.y;
            const actualDz = state2.position.z - state1.position.z;
            
            // Allow for reasonable numerical error (1% of expected change or 1000 km, whichever is larger)
            const tolerance = Math.max(Math.abs(expectedDx) * 0.01, 1000);
            
            expect(Math.abs(actualDx - expectedDx)).toBeLessThan(tolerance);
            expect(Math.abs(actualDy - expectedDy)).toBeLessThan(tolerance);
            expect(Math.abs(actualDz - expectedDz)).toBeLessThan(tolerance);
          }
        }
      ), { numRuns: 50 }); // Reduced runs for expensive calculations
    });
  });
});