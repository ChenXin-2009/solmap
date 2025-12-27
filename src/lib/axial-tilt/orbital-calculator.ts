/**
 * Orbital Calculator Implementation
 * 
 * Computes orbital normal vector and ascending node direction
 * from orbital elements (i, Ω).
 * 
 * CRITICAL: This calculator is ONLY valid for ecliptic reference plane.
 * Satellite orientation systems require a separate calculator.
 * 
 * @module axial-tilt/orbital-calculator
 * @requirements 1.1, 1.3, 1.4, 1.6
 */

import {
  Vector3,
  OrbitalElements,
  OrbitalCalculator,
  createVector3,
  ECLIPTIC_NORMAL,
  UNIT_VECTOR_TOLERANCE,
  AxialTiltErrorCodes,
} from './types';

// ============================================================================
// Vector Utilities (Physical Layer - no Three.js dependency)
// ============================================================================

/**
 * Compute the magnitude (length) of a vector.
 */
function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize a vector to unit length.
 * @throws Error if vector has zero magnitude
 */
function normalize(v: Vector3): Vector3 {
  const mag = magnitude(v);
  if (mag < 1e-15) {
    throw new Error(`[${AxialTiltErrorCodes.ZERO_VECTOR}] Cannot normalize zero vector`);
  }
  return createVector3(v.x / mag, v.y / mag, v.z / mag);
}

/**
 * Check if a vector is a unit vector within tolerance.
 */
function isUnitVector(v: Vector3, tolerance: number = UNIT_VECTOR_TOLERANCE): boolean {
  const mag = magnitude(v);
  return Math.abs(mag - 1) <= tolerance;
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate inclination is in valid range [0, π].
 * @throws Error if inclination is out of range
 */
function validateInclination(inclination: number): void {
  if (inclination < 0 || inclination > Math.PI) {
    throw new Error(
      `[${AxialTiltErrorCodes.INVALID_INCLINATION}] Inclination must be in range [0, π], got ${inclination}`
    );
  }
}

/**
 * Normalize longitude of ascending node to [0, 2π).
 * Does not throw - normalizes out-of-range values.
 */
function normalizeLOAN(loan: number): number {
  const TWO_PI = 2 * Math.PI;
  let normalized = loan % TWO_PI;
  if (normalized < 0) {
    normalized += TWO_PI;
  }
  return normalized;
}

// ============================================================================
// OrbitalCalculator Implementation
// ============================================================================

/**
 * Implementation of OrbitalCalculator interface.
 * 
 * Computes orbital normal vector and ascending node direction
 * from orbital elements using the standard formulas.
 */
class OrbitalCalculatorImpl implements OrbitalCalculator {
  /**
   * Compute orbital normal vector from orbital elements.
   * 
   * Formula (ICRF/J2000 ecliptic frame, Z-up):
   *   N_x = sin(i) * sin(Ω)
   *   N_y = -sin(i) * cos(Ω)
   *   N_z = cos(i)
   * 
   * Special case: For the Sun (i=0, Ω=0), returns ecliptic normal (0, 0, 1).
   * 
   * @param elements - Orbital elements (i, Ω) in radians
   * @returns Unit vector in ICRF/J2000 ecliptic frame
   * @throws Error if inclination is out of valid range
   * 
   * @requirements 1.1, 1.3, 1.4, 1.6
   */
  computeOrbitalNormal(elements: OrbitalElements): Vector3 {
    const { inclination, longitudeOfAscendingNode } = elements;
    
    // Validate inclination
    validateInclination(inclination);
    
    // Normalize LOAN to [0, 2π)
    const omega = normalizeLOAN(longitudeOfAscendingNode);
    
    // Special case: Sun (or any body with i=0)
    // When inclination is 0, the orbital plane IS the ecliptic plane
    // So the orbital normal is the ecliptic normal (0, 0, 1)
    if (Math.abs(inclination) < 1e-15) {
      return ECLIPTIC_NORMAL;
    }
    
    // Compute orbital normal using the standard formula
    const sinI = Math.sin(inclination);
    const cosI = Math.cos(inclination);
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    
    const normal = createVector3(
      sinI * sinOmega,      // N_x = sin(i) * sin(Ω)
      -sinI * cosOmega,     // N_y = -sin(i) * cos(Ω)
      cosI                   // N_z = cos(i)
    );
    
    // Verify output is a unit vector (should be by construction, but verify)
    if (!isUnitVector(normal, UNIT_VECTOR_TOLERANCE)) {
      // This should never happen with the formula above, but normalize just in case
      return normalize(normal);
    }
    
    return normal;
  }

  /**
   * Get ascending node direction vector.
   * 
   * Formula:
   *   A_x = cos(Ω)
   *   A_y = sin(Ω)
   *   A_z = 0
   * 
   * The ascending node direction lies in the ecliptic plane (Z=0)
   * and points toward the ascending node.
   * 
   * @param longitudeOfAscendingNode - Ω in radians
   * @returns Unit vector in ICRF/J2000 ecliptic frame
   * 
   * @requirements 1.1
   */
  computeAscendingNodeDirection(longitudeOfAscendingNode: number): Vector3 {
    // Normalize LOAN to [0, 2π)
    const omega = normalizeLOAN(longitudeOfAscendingNode);
    
    // Compute ascending node direction
    // This vector lies in the ecliptic plane (Z=0)
    return createVector3(
      Math.cos(omega),  // A_x = cos(Ω)
      Math.sin(omega),  // A_y = sin(Ω)
      0                 // A_z = 0 (in ecliptic plane)
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new OrbitalCalculator instance.
 * 
 * @returns OrbitalCalculator implementation
 */
export function createOrbitalCalculator(): OrbitalCalculator {
  return new OrbitalCalculatorImpl();
}

// ============================================================================
// Singleton Instance (for convenience)
// ============================================================================

/**
 * Default OrbitalCalculator instance.
 * Use this for most cases; create new instances only if needed for testing.
 */
export const orbitalCalculator = createOrbitalCalculator();
