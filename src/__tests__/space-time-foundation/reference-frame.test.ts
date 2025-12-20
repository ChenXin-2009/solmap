/**
 * Property Tests for Reference Frame Management
 * 
 * Feature: space-time-foundation, Property 1: Single Authoritative Reference Frame
 * Validates: Requirements 1.1, 1.3
 * 
 * Feature: space-time-foundation, Property 2: Reference Frame Consistency
 * Validates: Requirements 1.2, 2.1
 * 
 * These tests verify that the reference frame system maintains exactly one
 * authoritative frame and enforces proper frame type separation.
 */

import * as fc from 'fast-check';
import { ReferenceFrameManager } from '@/lib/space-time-foundation/reference-frame-manager';
import {
  ReferenceFrameInfo,
  PRIMARY_REFERENCE_FRAME,
  validateSingleAuthoritativeFrame
} from '@/lib/space-time-foundation';

// Test utilities for generating reference frames
const frameIdArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const frameNameArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const originArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const axesArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const unitArbitrary = fc.constantFrom('km', 'km/s', 'JD', 'AU', 'm', 'm/s');

const derivedFrameArbitrary = fc.record({
  frameId: frameIdArbitrary,
  name: frameNameArbitrary,
  origin: originArbitrary,
  axes: axesArbitrary,
  type: fc.constant("DERIVED_DISPLAY" as const),
  positionUnit: unitArbitrary,
  velocityUnit: unitArbitrary,
  timeUnit: unitArbitrary
});

const authoritativeFrameArbitrary = fc.record({
  frameId: frameIdArbitrary,
  name: frameNameArbitrary,
  origin: originArbitrary,
  axes: axesArbitrary,
  type: fc.constant("AUTHORITATIVE" as const),
  positionUnit: unitArbitrary,
  velocityUnit: unitArbitrary,
  timeUnit: unitArbitrary
});

describe('Reference Frame Property Tests', () => {
  describe('Property 1: Single Authoritative Reference Frame', () => {
    test('System maintains exactly one authoritative reference frame', () => {
      fc.assert(
        fc.property(
          fc.array(derivedFrameArbitrary, { minLength: 0, maxLength: 10 }),
          (derivedFrames) => {
            const manager = new ReferenceFrameManager();
            
            // Initially should have exactly 1 authoritative frame
            expect(manager.getAuthoritativeFrameCount()).toBe(1);
            expect(manager.getAuthoritativeFrame().frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            
            // Add derived frames
            for (const frame of derivedFrames) {
              // Skip if frame ID conflicts with primary frame
              if (frame.frameId === PRIMARY_REFERENCE_FRAME.frameId) continue;
              
              const result = manager.addDerivedFrame(frame);
              // Should succeed for valid derived frames
              expect(result.success).toBe(true);
            }
            
            // Should still have exactly 1 authoritative frame
            expect(manager.getAuthoritativeFrameCount()).toBe(1);
            
            // Validate Phase 1 constraints
            const validation = manager.validatePhase1Constraints();
            expect(validation.success).toBe(true);
            
            // Use validation function from foundation
            const allFrames = manager.getAllFrames();
            expect(validateSingleAuthoritativeFrame(allFrames)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('System rejects attempts to add multiple authoritative frames', () => {
      fc.assert(
        fc.property(
          authoritativeFrameArbitrary,
          (authFrame) => {
            const manager = new ReferenceFrameManager();
            
            // Attempt to add another authoritative frame
            const result = manager.addDerivedFrame(authFrame);
            
            // Should fail
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('MULTIPLE_AUTHORITATIVE_FRAMES');
            
            // Should still have exactly 1 authoritative frame
            expect(manager.getAuthoritativeFrameCount()).toBe(1);
            expect(manager.getAuthoritativeFrame().frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('System prevents removal of authoritative frame', () => {
      fc.assert(
        fc.property(
          fc.array(derivedFrameArbitrary, { minLength: 1, maxLength: 5 }),
          (derivedFrames) => {
            const manager = new ReferenceFrameManager();
            
            // Add some derived frames
            const addedFrames: string[] = [];
            for (const frame of derivedFrames) {
              if (frame.frameId === PRIMARY_REFERENCE_FRAME.frameId) continue;
              
              const result = manager.addDerivedFrame(frame);
              if (result.success) {
                addedFrames.push(frame.frameId);
              }
            }
            
            // Attempt to remove authoritative frame
            const result = manager.removeDerivedFrame(PRIMARY_REFERENCE_FRAME.frameId);
            
            // Should fail
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('UNAUTHORIZED_ACCESS');
            
            // Authoritative frame should still exist
            expect(manager.getAuthoritativeFrameCount()).toBe(1);
            expect(manager.hasFrame(PRIMARY_REFERENCE_FRAME.frameId)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Authoritative frame validation works correctly', () => {
      fc.assert(
        fc.property(
          frameIdArbitrary,
          (frameId) => {
            const manager = new ReferenceFrameManager();
            
            const result = manager.validateAuthoritativeFrame(frameId);
            
            if (frameId === PRIMARY_REFERENCE_FRAME.frameId) {
              expect(result.success).toBe(true);
            } else {
              expect(result.success).toBe(false);
              expect(result.error?.code).toBe('UNAUTHORIZED_ACCESS');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Reference Frame Consistency', () => {
    test('All frame queries return consistent reference frame information', () => {
      fc.assert(
        fc.property(
          fc.array(derivedFrameArbitrary, { minLength: 0, maxLength: 10 }),
          (derivedFrames) => {
            const manager = new ReferenceFrameManager();
            const addedFrames: ReferenceFrameInfo[] = [];
            
            // Add derived frames
            for (const frame of derivedFrames) {
              if (frame.frameId === PRIMARY_REFERENCE_FRAME.frameId) continue;
              
              const result = manager.addDerivedFrame(frame);
              if (result.success) {
                addedFrames.push(frame);
              }
            }
            
            // Test authoritative frame consistency
            const authFrame = manager.getAuthoritativeFrame();
            expect(authFrame.frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            expect(authFrame.type).toBe("AUTHORITATIVE");
            
            const authFrameById = manager.getFrameById(PRIMARY_REFERENCE_FRAME.frameId);
            expect(authFrameById.success).toBe(true);
            if (authFrameById.success) {
              expect(authFrameById.data).toEqual(authFrame);
            }
            
            // Test derived frame consistency
            for (const frame of addedFrames) {
              const frameById = manager.getFrameById(frame.frameId);
              expect(frameById.success).toBe(true);
              if (frameById.success) {
                expect(frameById.data.frameId).toBe(frame.frameId);
                expect(frameById.data.type).toBe("DERIVED_DISPLAY");
              }
              
              const frameType = manager.getFrameType(frame.frameId);
              expect(frameType.success).toBe(true);
              if (frameType.success) {
                expect(frameType.data).toBe("DERIVED_DISPLAY");
              }
              
              expect(manager.hasFrame(frame.frameId)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Frame type distinction is maintained correctly', () => {
      fc.assert(
        fc.property(
          fc.array(derivedFrameArbitrary, { minLength: 1, maxLength: 5 }),
          (derivedFrames) => {
            const manager = new ReferenceFrameManager();
            
            // Add derived frames
            for (const frame of derivedFrames) {
              if (frame.frameId === PRIMARY_REFERENCE_FRAME.frameId) continue;
              manager.addDerivedFrame(frame);
            }
            
            const allFrames = manager.getAllFrames();
            
            // Exactly one frame should be authoritative
            const authFrames = allFrames.filter(f => f.type === "AUTHORITATIVE");
            const derivedFrames_actual = allFrames.filter(f => f.type === "DERIVED_DISPLAY");
            
            expect(authFrames.length).toBe(1);
            expect(authFrames[0].frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            expect(derivedFrames_actual.length).toBe(manager.getDerivedFrameCount());
            
            // All derived frames should be DERIVED_DISPLAY type
            for (const frame of derivedFrames_actual) {
              expect(frame.type).toBe("DERIVED_DISPLAY");
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Frame structure validation works correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            frameId: fc.oneof(frameIdArbitrary, fc.constant(''), fc.constant(null as any)),
            name: fc.oneof(frameNameArbitrary, fc.constant(''), fc.constant(null as any)),
            origin: fc.oneof(originArbitrary, fc.constant(''), fc.constant(null as any)),
            axes: fc.oneof(axesArbitrary, fc.constant(''), fc.constant(null as any)),
            type: fc.oneof(fc.constant("DERIVED_DISPLAY" as const), fc.constant("INVALID" as any)),
            positionUnit: fc.oneof(unitArbitrary, fc.constant(''), fc.constant(null as any)),
            velocityUnit: fc.oneof(unitArbitrary, fc.constant(''), fc.constant(null as any)),
            timeUnit: fc.oneof(unitArbitrary, fc.constant(''), fc.constant(null as any))
          }),
          (frame) => {
            const manager = new ReferenceFrameManager();
            
            const result = manager.addDerivedFrame(frame);
            
            // Check if frame should be valid
            const isValid = frame.frameId && typeof frame.frameId === 'string' && frame.frameId.trim().length > 0 &&
                           frame.name && typeof frame.name === 'string' && frame.name.trim().length > 0 &&
                           frame.origin && typeof frame.origin === 'string' && frame.origin.trim().length > 0 &&
                           frame.axes && typeof frame.axes === 'string' && frame.axes.trim().length > 0 &&
                           frame.type === "DERIVED_DISPLAY" &&
                           frame.positionUnit && typeof frame.positionUnit === 'string' && frame.positionUnit.trim().length > 0 &&
                           frame.velocityUnit && typeof frame.velocityUnit === 'string' && frame.velocityUnit.trim().length > 0 &&
                           frame.timeUnit && typeof frame.timeUnit === 'string' && frame.timeUnit.trim().length > 0 &&
                           frame.frameId !== PRIMARY_REFERENCE_FRAME.frameId;
            
            if (isValid) {
              expect(result.success).toBe(true);
            } else {
              expect(result.success).toBe(false);
              expect(result.error?.code).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Duplicate frame IDs are rejected', () => {
      fc.assert(
        fc.property(
          derivedFrameArbitrary,
          (frame) => {
            const manager = new ReferenceFrameManager();
            
            // Skip if conflicts with primary frame
            if (frame.frameId === PRIMARY_REFERENCE_FRAME.frameId) return;
            
            // Add frame first time
            const result1 = manager.addDerivedFrame(frame);
            expect(result1.success).toBe(true);
            
            // Attempt to add same frame ID again
            const result2 = manager.addDerivedFrame(frame);
            expect(result2.success).toBe(false);
            expect(result2.error?.code).toBe('INVALID_CONFIGURATION');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('System Information and Management', () => {
    test('System info reflects actual state', () => {
      fc.assert(
        fc.property(
          fc.array(derivedFrameArbitrary, { minLength: 0, maxLength: 5 }),
          (derivedFrames) => {
            const manager = new ReferenceFrameManager();
            let addedCount = 0;
            
            // Add derived frames
            for (const frame of derivedFrames) {
              if (frame.frameId === PRIMARY_REFERENCE_FRAME.frameId) continue;
              
              const result = manager.addDerivedFrame(frame);
              if (result.success) {
                addedCount++;
              }
            }
            
            const info = manager.getSystemInfo();
            
            expect(info.authoritativeFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            expect(info.derivedFrameCount).toBe(addedCount);
            expect(info.totalFrameCount).toBe(addedCount + 1); // +1 for authoritative
            expect(info.phase1Compliant).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Reset functionality works correctly', () => {
      const manager = new ReferenceFrameManager();
      
      // Add some derived frames
      const testFrame: ReferenceFrameInfo = {
        frameId: 'test-frame',
        name: 'Test Frame',
        origin: 'Test Origin',
        axes: 'Test Axes',
        type: 'DERIVED_DISPLAY',
        positionUnit: 'km',
        velocityUnit: 'km/s',
        timeUnit: 'JD'
      };
      
      manager.addDerivedFrame(testFrame);
      expect(manager.getDerivedFrameCount()).toBe(1);
      
      // Reset
      manager.reset();
      
      // Should be back to initial state
      expect(manager.getAuthoritativeFrameCount()).toBe(1);
      expect(manager.getDerivedFrameCount()).toBe(0);
      expect(manager.getAuthoritativeFrame().frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);
      
      const validation = manager.validatePhase1Constraints();
      expect(validation.success).toBe(true);
    });
  });
});