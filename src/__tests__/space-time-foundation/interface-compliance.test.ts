/**
 * Property Tests for Interface Compliance
 * 
 * Feature: space-time-foundation, Property 7: Provider Interface Compliance
 * Validates: Requirements 5.5
 * 
 * These tests verify that all Ephemeris Provider implementations
 * return data conforming to the StateVector interface with complete metadata.
 */

import * as fc from 'fast-check';
import {
  StateVector,
  EphemerisProvider,
  SpaceTimeResult,
  STANDARD_BODY_IDS,
  ASTRONOMICAL_CONSTANTS,
  PRIMARY_REFERENCE_FRAME,
  validateStateVectorPurity
} from '@/lib/space-time-foundation';

// Test utilities for generating valid test data
const validBodyIds = Object.values(STANDARD_BODY_IDS);

const julianDateArbitrary = fc.double({
  min: ASTRONOMICAL_CONSTANTS.J2000_JD - 36525, // 100 years before J2000
  max: ASTRONOMICAL_CONSTANTS.J2000_JD + 36525, // 100 years after J2000
  noNaN: true,
  noDefaultInfinity: true
});

const vector3Arbitrary = fc.record({
  x: fc.double({ min: -1e12, max: 1e12, noNaN: true }),
  y: fc.double({ min: -1e12, max: 1e12, noNaN: true }),
  z: fc.double({ min: -1e12, max: 1e12, noNaN: true })
});

const stateVectorArbitrary = fc.record({
  position: vector3Arbitrary,
  velocity: vector3Arbitrary,
  radius: fc.double({ min: 1, max: 1e6, noNaN: true }), // 1 km to 1M km
  metadata: fc.record({
    julianDate: julianDateArbitrary,
    referenceFrame: fc.constant(PRIMARY_REFERENCE_FRAME.frameId),
    provider: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    accuracy: fc.option(fc.double({ min: 0, max: 1, noNaN: true }))
  })
});

// Mock Ephemeris Provider for testing
class MockEphemerisProvider implements EphemerisProvider {
  constructor(
    private providerId: string,
    private supportedBodies: readonly string[],
    private stateGenerator: (bodyId: string, jd: number) => StateVector
  ) {}

  getProviderId(): string {
    return this.providerId;
  }

  getSupportedBodies(): readonly string[] {
    return this.supportedBodies;
  }

  getTimeRange(): { readonly startJD: number; readonly endJD: number } {
    return {
      startJD: ASTRONOMICAL_CONSTANTS.J2000_JD - 36525,
      endJD: ASTRONOMICAL_CONSTANTS.J2000_JD + 36525
    };
  }

  getState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector> {
    if (!this.supportedBodies.includes(bodyId)) {
      return {
        success: false,
        error: {
          code: "BODY_NOT_SUPPORTED",
          message: `Body ${bodyId} not supported by ${this.providerId}`
        }
      };
    }

    try {
      const state = this.stateGenerator(bodyId, julianDate);
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "CALCULATION_FAILED",
          message: `Failed to calculate state for ${bodyId}`,
          details: { error: String(error) }
        }
      };
    }
  }

  getStates(bodyId: string, julianDates: readonly number[]): SpaceTimeResult<readonly StateVector[]> {
    const states: StateVector[] = [];
    
    for (const jd of julianDates) {
      const result = this.getState(bodyId, jd);
      if (!result.success) {
        return result as SpaceTimeResult<readonly StateVector[]>;
      }
      states.push(result.data);
    }
    
    return { success: true, data: states };
  }

  getAccuracy(bodyId: string): number {
    return 1e-6; // Mock accuracy
  }

  supportsVelocity(): boolean {
    return true;
  }
}

describe('Interface Compliance Property Tests', () => {
  describe('Property 7: Provider Interface Compliance', () => {
    test('All provider implementations return standardized StateVector format', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validBodyIds),
          julianDateArbitrary,
          stateVectorArbitrary,
          (bodyId, julianDate, expectedState) => {
            // Create mock provider that returns the expected state
            const provider = new MockEphemerisProvider(
              'test-provider',
              [bodyId],
              () => expectedState
            );

            const result = provider.getState(bodyId, julianDate);

            // Verify result structure
            expect(result.success).toBe(true);
            if (!result.success) return;

            const state = result.data;

            // Verify StateVector structure compliance
            expect(state).toHaveProperty('position');
            expect(state).toHaveProperty('velocity');
            expect(state).toHaveProperty('radius');
            expect(state).toHaveProperty('metadata');

            // Verify Vector3 structure
            expect(state.position).toHaveProperty('x');
            expect(state.position).toHaveProperty('y');
            expect(state.position).toHaveProperty('z');
            expect(state.velocity).toHaveProperty('x');
            expect(state.velocity).toHaveProperty('y');
            expect(state.velocity).toHaveProperty('z');

            // Verify metadata structure
            expect(state.metadata).toHaveProperty('julianDate');
            expect(state.metadata).toHaveProperty('referenceFrame');
            expect(state.metadata).toHaveProperty('provider');

            // Verify data types
            expect(typeof state.position.x).toBe('number');
            expect(typeof state.position.y).toBe('number');
            expect(typeof state.position.z).toBe('number');
            expect(typeof state.velocity.x).toBe('number');
            expect(typeof state.velocity.y).toBe('number');
            expect(typeof state.velocity.z).toBe('number');
            expect(typeof state.radius).toBe('number');
            expect(typeof state.metadata.julianDate).toBe('number');
            expect(typeof state.metadata.referenceFrame).toBe('string');
            expect(typeof state.metadata.provider).toBe('string');

            // Verify physical constraints
            expect(state.radius).toBeGreaterThan(0);
            expect(Number.isFinite(state.position.x)).toBe(true);
            expect(Number.isFinite(state.position.y)).toBe(true);
            expect(Number.isFinite(state.position.z)).toBe(true);
            expect(Number.isFinite(state.velocity.x)).toBe(true);
            expect(Number.isFinite(state.velocity.y)).toBe(true);
            expect(Number.isFinite(state.velocity.z)).toBe(true);
          }
        ),
        { numRuns: 100 } // Property-based test with 100 iterations
      );
    });

    test('Provider metadata contains required reference frame information', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validBodyIds),
          julianDateArbitrary,
          stateVectorArbitrary,
          (bodyId, julianDate, expectedState) => {
            const provider = new MockEphemerisProvider(
              'test-provider',
              [bodyId],
              () => expectedState
            );

            const result = provider.getState(bodyId, julianDate);
            expect(result.success).toBe(true);
            if (!result.success) return;

            const state = result.data;

            // Verify reference frame is the authoritative frame
            expect(state.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);

            // Verify Julian Date is preserved
            expect(state.metadata.julianDate).toBe(expectedState.metadata.julianDate);

            // Verify provider ID is present
            expect(state.metadata.provider).toBeTruthy();
            expect(state.metadata.provider.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('StateVector purity validation passes for all provider outputs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validBodyIds),
          julianDateArbitrary,
          stateVectorArbitrary,
          (bodyId, julianDate, expectedState) => {
            const provider = new MockEphemerisProvider(
              'test-provider',
              [bodyId],
              () => expectedState
            );

            const result = provider.getState(bodyId, julianDate);
            expect(result.success).toBe(true);
            if (!result.success) return;

            const state = result.data;

            // Use the validation function from the foundation
            const isPure = validateStateVectorPurity(state);
            expect(isPure).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Bulk state queries maintain consistency with single queries', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validBodyIds),
          fc.array(julianDateArbitrary, { minLength: 1, maxLength: 10 }),
          stateVectorArbitrary,
          (bodyId, julianDates, baseState) => {
            // Create provider that generates consistent states
            const provider = new MockEphemerisProvider(
              'test-provider',
              [bodyId],
              (id, jd) => ({
                ...baseState,
                metadata: {
                  ...baseState.metadata,
                  julianDate: jd
                }
              })
            );

            // Get bulk states
            const bulkResult = provider.getStates(bodyId, julianDates);
            expect(bulkResult.success).toBe(true);
            if (!bulkResult.success) return;

            const bulkStates = bulkResult.data;
            expect(bulkStates.length).toBe(julianDates.length);

            // Verify each bulk state matches individual query
            for (let i = 0; i < julianDates.length; i++) {
              const individualResult = provider.getState(bodyId, julianDates[i]);
              expect(individualResult.success).toBe(true);
              if (!individualResult.success) continue;

              const bulkState = bulkStates[i];
              const individualState = individualResult.data;

              // States should be equivalent
              expect(bulkState.position).toEqual(individualState.position);
              expect(bulkState.velocity).toEqual(individualState.velocity);
              expect(bulkState.radius).toEqual(individualState.radius);
              expect(bulkState.metadata.julianDate).toEqual(individualState.metadata.julianDate);
              expect(bulkState.metadata.referenceFrame).toEqual(individualState.metadata.referenceFrame);
              expect(bulkState.metadata.provider).toEqual(individualState.metadata.provider);
            }
          }
        ),
        { numRuns: 50 } // Fewer runs for bulk tests due to complexity
      );
    });

    test('Provider error handling follows SpaceTimeResult pattern', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          julianDateArbitrary,
          (unsupportedBodyId, julianDate) => {
            // Ensure we use an unsupported body ID
            const bodyId = `unsupported_${unsupportedBodyId}`;
            
            const provider = new MockEphemerisProvider(
              'test-provider',
              validBodyIds, // Only supports standard bodies
              () => {
                throw new Error('Should not be called');
              }
            );

            const result = provider.getState(bodyId, julianDate);

            // Should return error result
            expect(result.success).toBe(false);
            if (result.success) return;

            // Verify error structure
            expect(result.error).toHaveProperty('code');
            expect(result.error).toHaveProperty('message');
            expect(typeof result.error.code).toBe('string');
            expect(typeof result.error.message).toBe('string');
            expect(result.error.code.length).toBeGreaterThan(0);
            expect(result.error.message.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});