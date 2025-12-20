/**
 * Property Tests: Scale Strategy (Render Layer Only)
 * 
 * Feature: space-time-foundation
 * 
 * These tests validate that the scale strategy maintains strict separation
 * between physical coordinates (immutable) and display coordinates (mutable).
 * 
 * CRITICAL: Physical positions must NEVER be modified by render layer operations.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { Vector3, Matrix4 } from 'three';
import { 
  RenderScaleManager, 
  ScaleStrategy, 
  ScaleConfig, 
  DEFAULT_SCALE_CONFIG,
  ScaleUtils 
} from '../../lib/space-time-foundation/scale-strategy';
import { StateVector } from '../../lib/space-time-foundation/interfaces';
import { ERROR_CODES } from '../../lib/space-time-foundation/constants';

describe('Scale Strategy - Property Tests', () => {
  let scaleManager: RenderScaleManager;
  
  beforeEach(() => {
    scaleManager = new RenderScaleManager();
  });
  
  afterEach(() => {
    scaleManager.dispose();
  });
  
  /**
   * Property 8: Physical-Render Separation
   * 
   * For any camera or zoom operation, the underlying physical positions 
   * in StateVectors should remain unchanged while only display transforms are modified.
   * 
   * Validates: Requirements 6.3
   */
  test('Property 8: Physical-Render Separation', () => {
    fc.assert(
      fc.property(
        // Generate random body ID
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        
        // Generate random physical position (km) - filter out NaN and invalid values
        fc.record({
          x: fc.float({ min: -1e9, max: 1e9 }).filter(x => Number.isFinite(x)),
          y: fc.float({ min: -1e9, max: 1e9 }).filter(y => Number.isFinite(y)),
          z: fc.float({ min: -1e9, max: 1e9 }).filter(z => Number.isFinite(z))
        }),
        
        // Generate random velocity (km/s) - filter out NaN and invalid values
        fc.record({
          x: fc.float({ min: -100, max: 100 }).filter(x => Number.isFinite(x)),
          y: fc.float({ min: -100, max: 100 }).filter(y => Number.isFinite(y)),
          z: fc.float({ min: -100, max: 100 }).filter(z => Number.isFinite(z))
        }),
        
        // Generate random radius (km)
        fc.float({ min: 1, max: 1e6 }),
        
        // Generate random Julian Date
        fc.float({ min: 2400000, max: 2500000 }),
        
        // Generate random camera transforms - filter out NaN values
        fc.array(
          fc.record({
            m11: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m12: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m13: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m14: fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }).filter(x => Number.isFinite(x)),
            m21: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m22: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m23: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m24: fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }).filter(x => Number.isFinite(x)),
            m31: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m32: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m33: fc.float({ min: Math.fround(-10), max: Math.fround(10) }).filter(x => Number.isFinite(x)),
            m34: fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }).filter(x => Number.isFinite(x)),
            m41: fc.float({ min: Math.fround(-1), max: Math.fround(1) }).filter(x => Number.isFinite(x)),
            m42: fc.float({ min: Math.fround(-1), max: Math.fround(1) }).filter(x => Number.isFinite(x)),
            m43: fc.float({ min: Math.fround(-1), max: Math.fround(1) }).filter(x => Number.isFinite(x)),
            m44: fc.float({ min: Math.fround(0.1), max: Math.fround(2) }).filter(x => Number.isFinite(x) && x > 0)
          }),
          { minLength: 1, maxLength: 5 } // Reduce array size for performance
        ),
        
        (bodyId, position, velocity, radius, julianDate, transforms) => {
          // Skip invalid inputs
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
            return;
          }
          if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y) || !Number.isFinite(velocity.z)) {
            return;
          }
          if (!Number.isFinite(radius) || !Number.isFinite(julianDate)) {
            return;
          }
          // Create state vector
          const stateVector: StateVector = {
            position: new Vector3(position.x, position.y, position.z),
            velocity: new Vector3(velocity.x, velocity.y, velocity.z),
            radius,
            metadata: {
              julianDate,
              referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
              provider: 'test-provider'
            }
          };
          
          // Store original physical position for comparison
          const originalPosition = new Vector3(position.x, position.y, position.z);
          
          // Create scale strategy
          const strategyResult = scaleManager.createScaleStrategy(bodyId, stateVector);
          expect(strategyResult.success).toBe(true);
          
          if (!strategyResult.success) return;
          const strategy = strategyResult.data;
          
          // CRITICAL TEST: Physical position should be immutable reference
          expect(strategy.physicalPosition.x).toBeCloseTo(originalPosition.x, 10);
          expect(strategy.physicalPosition.y).toBeCloseTo(originalPosition.y, 10);
          expect(strategy.physicalPosition.z).toBeCloseTo(originalPosition.z, 10);
          
          // Apply multiple camera transforms
          for (const transform of transforms) {
            // Skip transforms with invalid values
            const values = [
              transform.m11, transform.m12, transform.m13, transform.m14,
              transform.m21, transform.m22, transform.m23, transform.m24,
              transform.m31, transform.m32, transform.m33, transform.m34,
              transform.m41, transform.m42, transform.m43, transform.m44
            ];
            
            if (values.some(v => !Number.isFinite(v))) {
              continue; // Skip invalid transforms
            }
            
            const matrix = new Matrix4().set(
              transform.m11, transform.m12, transform.m13, transform.m14,
              transform.m21, transform.m22, transform.m23, transform.m24,
              transform.m31, transform.m32, transform.m33, transform.m34,
              transform.m41, transform.m42, transform.m43, transform.m44
            );
            
            // Update camera transform
            const updateResult = scaleManager.updateCameraTransform(bodyId, matrix);
            expect(updateResult.success).toBe(true);
            
            // Get updated strategy
            const updatedStrategy = scaleManager.getScaleStrategy(bodyId);
            expect(updatedStrategy).toBeDefined();
            
            if (updatedStrategy) {
              // CRITICAL: Physical position must remain unchanged
              expect(updatedStrategy.physicalPosition.x).toBeCloseTo(originalPosition.x, 10);
              expect(updatedStrategy.physicalPosition.y).toBeCloseTo(originalPosition.y, 10);
              expect(updatedStrategy.physicalPosition.z).toBeCloseTo(originalPosition.z, 10);
              
              // Camera transform should be updated (check individual elements for better debugging)
              const elements = updatedStrategy.cameraTransform.elements;
              const expectedElements = matrix.elements;
              for (let i = 0; i < 16; i++) {
                expect(elements[i]).toBeCloseTo(expectedElements[i], 5);
              }
            }
          }
          
          // Final verification: Original state vector should be unchanged
          expect(stateVector.position.x).toBeCloseTo(originalPosition.x, 10);
          expect(stateVector.position.y).toBeCloseTo(originalPosition.y, 10);
          expect(stateVector.position.z).toBeCloseTo(originalPosition.z, 10);
          
          // Physical position in strategy should still match original
          const finalStrategy = scaleManager.getScaleStrategy(bodyId);
          expect(finalStrategy).toBeDefined();
          
          if (finalStrategy) {
            expect(finalStrategy.physicalPosition.x).toBeCloseTo(originalPosition.x, 10);
            expect(finalStrategy.physicalPosition.y).toBeCloseTo(originalPosition.y, 10);
            expect(finalStrategy.physicalPosition.z).toBeCloseTo(originalPosition.z, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Scale Strategy Immutability
   * 
   * Physical positions should be frozen and immutable
   */
  test('Property: Scale Strategy Physical Position Immutability', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.record({
          x: fc.float({ min: -1e6, max: 1e6 }).filter(x => Number.isFinite(x)),
          y: fc.float({ min: -1e6, max: 1e6 }).filter(y => Number.isFinite(y)),
          z: fc.float({ min: -1e6, max: 1e6 }).filter(z => Number.isFinite(z))
        }),
        fc.float({ min: 1, max: 1e6 }).filter(x => Number.isFinite(x)),
        fc.float({ min: 2400000, max: 2500000 }).filter(x => Number.isFinite(x)),
        
        (bodyId, position, radius, julianDate) => {
          // Skip invalid inputs
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
            return;
          }
          if (!Number.isFinite(radius) || !Number.isFinite(julianDate)) {
            return;
          }
          const stateVector: StateVector = {
            position: new Vector3(position.x, position.y, position.z),
            velocity: new Vector3(0, 0, 0),
            radius,
            metadata: {
              julianDate,
              referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
              provider: 'test-provider'
            }
          };
          
          const strategyResult = scaleManager.createScaleStrategy(bodyId, stateVector);
          expect(strategyResult.success).toBe(true);
          
          if (!strategyResult.success) return;
          const strategy = strategyResult.data;
          
          // Physical position should be frozen
          expect(Object.isFrozen(strategy.physicalPosition)).toBe(true);
          
          // Attempting to modify should fail silently or throw in strict mode
          const originalX = strategy.physicalPosition.x;
          
          // Skip if originalX is NaN or invalid
          if (!Number.isFinite(originalX)) {
            return;
          }
          
          try {
            (strategy.physicalPosition as any).x = originalX + 1000;
            // If no error thrown, value should remain unchanged
            expect(strategy.physicalPosition.x).toBeCloseTo(originalX, 10);
          } catch (error) {
            // Error is expected in strict mode - this is good
            expect(strategy.physicalPosition.x).toBeCloseTo(originalX, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Display Position Independence
   * 
   * Display positions should be independent of physical positions
   * and can be modified without affecting physical coordinates
   */
  test('Property: Display Position Independence', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.record({
          x: fc.float({ min: -1e6, max: 1e6 }).filter(x => Number.isFinite(x)),
          y: fc.float({ min: -1e6, max: 1e6 }).filter(y => Number.isFinite(y)),
          z: fc.float({ min: -1e6, max: 1e6 }).filter(z => Number.isFinite(z))
        }),
        fc.float({ min: 1, max: 1e6 }).filter(x => Number.isFinite(x)),
        fc.float({ min: 2400000, max: 2500000 }).filter(x => Number.isFinite(x)),
        fc.record({
          x: fc.float({ min: -1e9, max: 1e9 }).filter(x => Number.isFinite(x)),
          y: fc.float({ min: -1e9, max: 1e9 }).filter(y => Number.isFinite(y)),
          z: fc.float({ min: -1e9, max: 1e9 }).filter(z => Number.isFinite(z))
        }),
        
        (bodyId, position, radius, julianDate, newDisplayPos) => {
          // Skip invalid inputs
          if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
            return;
          }
          if (!Number.isFinite(radius) || !Number.isFinite(julianDate)) {
            return;
          }
          if (!Number.isFinite(newDisplayPos.x) || !Number.isFinite(newDisplayPos.y) || !Number.isFinite(newDisplayPos.z)) {
            return;
          }
          const stateVector: StateVector = {
            position: new Vector3(position.x, position.y, position.z),
            velocity: new Vector3(0, 0, 0),
            radius,
            metadata: {
              julianDate,
              referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
              provider: 'test-provider'
            }
          };
          
          const strategyResult = scaleManager.createScaleStrategy(bodyId, stateVector);
          expect(strategyResult.success).toBe(true);
          
          if (!strategyResult.success) return;
          const strategy = strategyResult.data;
          
          // Store original physical position
          const originalPhysical = new Vector3(
            strategy.physicalPosition.x,
            strategy.physicalPosition.y,
            strategy.physicalPosition.z
          );
          
          // Modify display position (this should be allowed)
          strategy.displayPosition.set(newDisplayPos.x, newDisplayPos.y, newDisplayPos.z);
          
          // Physical position should remain unchanged
          expect(strategy.physicalPosition.x).toBeCloseTo(originalPhysical.x, 10);
          expect(strategy.physicalPosition.y).toBeCloseTo(originalPhysical.y, 10);
          expect(strategy.physicalPosition.z).toBeCloseTo(originalPhysical.z, 10);
          
          // Display position should be updated
          expect(strategy.displayPosition.x).toBeCloseTo(newDisplayPos.x, 5);
          expect(strategy.displayPosition.y).toBeCloseTo(newDisplayPos.y, 5);
          expect(strategy.displayPosition.z).toBeCloseTo(newDisplayPos.z, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Scale Configuration Consistency
   * 
   * Scale calculations should be consistent with configuration parameters
   */
  test('Property: Scale Configuration Consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          minScale: fc.float({ min: Math.fround(1e-12), max: Math.fround(1e-6) }).filter(x => Number.isFinite(x) && x > 0),
          maxScale: fc.float({ min: Math.fround(1e6), max: Math.fround(1e12) }).filter(x => Number.isFinite(x) && x > 0),
          baseScale: fc.float({ min: Math.fround(0.1), max: Math.fround(10) }).filter(x => Number.isFinite(x) && x > 0),
          logScaleFactor: fc.float({ min: Math.fround(2), max: Math.fround(100) }).filter(x => Number.isFinite(x) && x > 1),
          useLogarithmicScaling: fc.boolean()
        }),
        fc.array(
          fc.record({
            x: fc.float({ min: -1e9, max: 1e9 }).filter(x => Number.isFinite(x)),
            y: fc.float({ min: -1e9, max: 1e9 }).filter(y => Number.isFinite(y)),
            z: fc.float({ min: -1e9, max: 1e9 }).filter(z => Number.isFinite(z))
          }),
          { minLength: 1, maxLength: 5 } // Reduce for performance
        ),
        
        (configData, positions) => {
          // Skip invalid inputs
          if (!Number.isFinite(configData.minScale) || !Number.isFinite(configData.maxScale) || 
              !Number.isFinite(configData.baseScale) || !Number.isFinite(configData.logScaleFactor)) {
            return;
          }
          
          // Skip positions with NaN values
          const validPositions = positions.filter(pos => 
            Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)
          );
          
          if (validPositions.length === 0) {
            return;
          }
          // Ensure valid configuration
          const config: ScaleConfig = {
            ...configData,
            maxScale: Math.max(configData.maxScale, configData.minScale * 2)
          };
          
          // Validate configuration
          const errors = ScaleUtils.validateScaleConfig(config);
          if (errors.length > 0) return; // Skip invalid configurations
          
          const manager = new RenderScaleManager(config);
          
          try {
            for (let i = 0; i < validPositions.length; i++) {
              const bodyId = `body_${i}`;
              const position = validPositions[i];
              
              const stateVector: StateVector = {
                position: new Vector3(position.x, position.y, position.z),
                velocity: new Vector3(0, 0, 0),
                radius: 1000,
                metadata: {
                  julianDate: 2451545.0,
                  referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
                  provider: 'test-provider'
                }
              };
              
              const strategyResult = manager.createScaleStrategy(bodyId, stateVector);
              expect(strategyResult.success).toBe(true);
              
              if (!strategyResult.success) continue;
              const strategy = strategyResult.data;
              
              // Scale factors should be within configured bounds and finite
              expect(Number.isFinite(strategy.visualScale)).toBe(true);
              expect(Number.isFinite(strategy.realScale)).toBe(true);
              
              if (Number.isFinite(strategy.visualScale)) {
                expect(strategy.visualScale).toBeGreaterThanOrEqual(config.minScale);
                expect(strategy.visualScale).toBeLessThanOrEqual(config.maxScale);
              }
              
              if (Number.isFinite(strategy.realScale)) {
                expect(strategy.realScale).toBeGreaterThanOrEqual(config.minScale);
                expect(strategy.realScale).toBeLessThanOrEqual(config.maxScale);
              }
              
              // Display position should be scaled version of physical position
              const distance = strategy.physicalPosition.length();
              if (distance > 0 && Number.isFinite(distance) && Number.isFinite(strategy.visualScale)) {
                const expectedScale = strategy.visualScale;
                const expectedDisplay = new Vector3(
                  strategy.physicalPosition.x * expectedScale,
                  strategy.physicalPosition.y * expectedScale,
                  strategy.physicalPosition.z * expectedScale
                );
                
                if (Number.isFinite(expectedDisplay.x) && Number.isFinite(expectedDisplay.y) && Number.isFinite(expectedDisplay.z)) {
                  expect(strategy.displayPosition.x).toBeCloseTo(expectedDisplay.x, 5);
                  expect(strategy.displayPosition.y).toBeCloseTo(expectedDisplay.y, 5);
                  expect(strategy.displayPosition.z).toBeCloseTo(expectedDisplay.z, 5);
                }
              }
            }
          } finally {
            manager.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Scale Strategy - Unit Tests', () => {
  let scaleManager: RenderScaleManager;
  
  beforeEach(() => {
    scaleManager = new RenderScaleManager();
  });
  
  afterEach(() => {
    scaleManager.dispose();
  });
  
  test('should create scale strategy with valid inputs', () => {
    const stateVector: StateVector = {
      position: new Vector3(1000, 2000, 3000),
      velocity: new Vector3(10, 20, 30),
      radius: 500,
      metadata: {
        julianDate: 2451545.0,
        referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
        provider: 'test-provider'
      }
    };
    
    const result = scaleManager.createScaleStrategy('earth', stateVector);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.physicalPosition.x).toBe(1000);
      expect(result.data.physicalPosition.y).toBe(2000);
      expect(result.data.physicalPosition.z).toBe(3000);
      expect(Object.isFrozen(result.data.physicalPosition)).toBe(true);
    }
  });
  
  test('should reject invalid body ID', () => {
    const stateVector: StateVector = {
      position: new Vector3(1000, 2000, 3000),
      velocity: new Vector3(10, 20, 30),
      radius: 500,
      metadata: {
        julianDate: 2451545.0,
        referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
        provider: 'test-provider'
      }
    };
    
    const result = scaleManager.createScaleStrategy('', stateVector);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_BODY_ID);
    }
  });
  
  test('should reject invalid state vector', () => {
    const invalidStateVector = {
      position: null,
      velocity: new Vector3(10, 20, 30),
      radius: 500,
      metadata: {
        julianDate: 2451545.0,
        referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
        provider: 'test-provider'
      }
    } as any;
    
    const result = scaleManager.createScaleStrategy('earth', invalidStateVector);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.INVALID_STATE_VECTOR);
    }
  });
  
  test('should update camera transform without affecting physical position', () => {
    const stateVector: StateVector = {
      position: new Vector3(1000, 2000, 3000),
      velocity: new Vector3(10, 20, 30),
      radius: 500,
      metadata: {
        julianDate: 2451545.0,
        referenceFrame: 'ICRF_J2000_HELIOCENTRIC',
        provider: 'test-provider'
      }
    };
    
    const createResult = scaleManager.createScaleStrategy('earth', stateVector);
    expect(createResult.success).toBe(true);
    
    const newTransform = new Matrix4().makeTranslation(100, 200, 300);
    const updateResult = scaleManager.updateCameraTransform('earth', newTransform);
    expect(updateResult.success).toBe(true);
    
    const strategy = scaleManager.getScaleStrategy('earth');
    expect(strategy).toBeDefined();
    
    if (strategy) {
      // Physical position should be unchanged
      expect(strategy.physicalPosition.x).toBe(1000);
      expect(strategy.physicalPosition.y).toBe(2000);
      expect(strategy.physicalPosition.z).toBe(3000);
      
      // Camera transform should be updated
      expect(strategy.cameraTransform.equals(newTransform)).toBe(true);
    }
  });
  
  test('should validate scale configuration', () => {
    const validConfig: ScaleConfig = {
      minScale: 1e-10,
      maxScale: 1e10,
      baseScale: 1.0,
      logScaleFactor: 10.0,
      useLogarithmicScaling: true
    };
    
    const errors = ScaleUtils.validateScaleConfig(validConfig);
    expect(errors).toHaveLength(0);
    
    const invalidConfig: ScaleConfig = {
      minScale: -1,
      maxScale: 0.5,
      baseScale: -1,
      logScaleFactor: 0.5,
      useLogarithmicScaling: true
    };
    
    const invalidErrors = ScaleUtils.validateScaleConfig(invalidConfig);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});