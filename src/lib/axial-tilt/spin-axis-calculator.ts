/**
 * Spin Axis Calculator Implementation
 * 
 * Computes spin axis vector from obliquity and orbital normal,
 * and vice versa.
 * 
 * Algorithm: Uses Rodrigues' rotation formula to rotate the orbital
 * normal around the ascending node direction by the obliquity angle.
 * 
 * @module axial-tilt/spin-axis-calculator
 * @requirements 2.3, 2.4, 2.5, 3.1, 3.2
 */

import {
  Vector3,
  SpinAxisCalculator,
  createVector3,
  CROSS_PRODUCT_TOLERANCE,
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
 * Compute the dot product of two vectors.
 */
function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Compute the cross product of two vectors.
 */
function cross(a: Vector3, b: Vector3): Vector3 {
  return createVector3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

/**
 * Scale a vector by a scalar.
 */
function scale(v: Vector3, s: number): Vector3 {
  return createVector3(v.x * s, v.y * s, v.z * s);
}

/**
 * Add two vectors.
 */
function add(a: Vector3, b: Vector3): Vector3 {
  return createVector3(a.x + b.x, a.y + b.y, a.z + b.z);
}

/**
 * Clamp a value to a range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
 * Validate obliquity is in valid range [0, π].
 * @throws Error if obliquity is out of range
 */
function validateObliquity(obliquityRadians: number): void {
  if (obliquityRadians < 0 || obliquityRadians > Math.PI) {
    throw new Error(
      `[${AxialTiltErrorCodes.INVALID_OBLIQUITY}] Obliquity must be in range [0, π], got ${obliquityRadians}`
    );
  }
}

// ============================================================================
// SpinAxisCalculator Implementation
// ============================================================================

/**
 * Implementation of SpinAxisCalculator interface.
 * 
 * Uses Rodrigues' rotation formula to compute spin axis from
 * orbital normal and obliquity.
 */
class SpinAxisCalculatorImpl implements SpinAxisCalculator {
  /**
   * Compute spin axis vector from obliquity and orbital normal.
   * 
   * Algorithm (Rodrigues' rotation formula):
   *   1. Start from orbital normal N
   *   2. Get ascending node direction A
   *   3. Rotate N around A by obliquity ε
   *   4. S = N*cos(ε) + (A×N)*sin(ε) + A*(A·N)*(1-cos(ε))
   * 
   * DEGENERATE CASES (CRITICAL):
   *   - If obliquity = 0: return orbitalNormal directly (no rotation needed)
   *   - If |ascendingNodeDirection × orbitalNormal| < CROSS_PRODUCT_TOLERANCE:
   *     choose a deterministic orthogonal axis
   * 
   * @param orbitalNormal - Orbital plane normal (unit vector)
   * @param ascendingNodeDirection - Ascending node direction (unit vector)
   * @param obliquityRadians - Obliquity in radians (0 to π)
   * @returns Spin axis unit vector in ICRF/J2000 frame
   * 
   * @requirements 2.3, 2.4, 2.5
   */
  computeSpinAxis(
    orbitalNormal: Vector3,
    ascendingNodeDirection: Vector3,
    obliquityRadians: number
  ): Vector3 {
    // Validate obliquity
    validateObliquity(obliquityRadians);

    // Degenerate case 1: obliquity ≈ 0
    // No rotation needed, spin axis equals orbital normal
    // Use a threshold that ensures numerical stability
    // Note: 1e-9 radians ≈ 0.00006° which is far smaller than any real planet's obliquity
    if (Math.abs(obliquityRadians) < 1e-9) {
      return orbitalNormal;
    }

    // Compute cross product A × N to check for degenerate case
    let rotationAxis = cross(ascendingNodeDirection, orbitalNormal);
    const crossMag = magnitude(rotationAxis);

    // Degenerate case 2: A and N are nearly parallel
    // This happens when the orbital plane is the ecliptic (i ≈ 0)
    // In this case, we need a deterministic fallback axis
    if (crossMag < CROSS_PRODUCT_TOLERANCE) {
      // Try cross with X-axis first
      const xAxis = createVector3(1, 0, 0);
      rotationAxis = cross(orbitalNormal, xAxis);
      
      if (magnitude(rotationAxis) < CROSS_PRODUCT_TOLERANCE) {
        // If that fails (N is parallel to X), use Y-axis
        const yAxis = createVector3(0, 1, 0);
        rotationAxis = cross(orbitalNormal, yAxis);
      }
    }

    // Normalize the rotation axis
    rotationAxis = normalize(rotationAxis);

    // Apply Rodrigues' rotation formula
    // S = N*cos(ε) + (K×N)*sin(ε) + K*(K·N)*(1-cos(ε))
    // where K is the rotation axis (normalized A×N or fallback)
    const cosE = Math.cos(obliquityRadians);
    const sinE = Math.sin(obliquityRadians);
    const oneMinusCosE = 1 - cosE;

    // Term 1: N * cos(ε)
    const term1 = scale(orbitalNormal, cosE);

    // Term 2: (K × N) * sin(ε)
    const kCrossN = cross(rotationAxis, orbitalNormal);
    const term2 = scale(kCrossN, sinE);

    // Term 3: K * (K · N) * (1 - cos(ε))
    const kDotN = dot(rotationAxis, orbitalNormal);
    const term3 = scale(rotationAxis, kDotN * oneMinusCosE);

    // Combine terms
    const spinAxis = add(add(term1, term2), term3);

    // Ensure result is a unit vector (should be by construction, but verify)
    if (!isUnitVector(spinAxis, UNIT_VECTOR_TOLERANCE)) {
      return normalize(spinAxis);
    }

    return spinAxis;
  }

  /**
   * Compute obliquity from spin axis and orbital normal.
   * 
   * Formula: ε = acos(clamp(S·N, -1, 1))
   * 
   * @param spinAxis - Spin axis unit vector
   * @param orbitalNormal - Orbital normal unit vector
   * @returns Obliquity in radians [0, π]
   * 
   * @requirements 3.1, 3.2
   */
  computeObliquity(spinAxis: Vector3, orbitalNormal: Vector3): number {
    // Compute dot product
    const dotProduct = dot(spinAxis, orbitalNormal);

    // Handle edge cases for numerical stability
    // When dot product is very close to 1, return 0 (vectors are parallel)
    if (dotProduct >= 1 - 1e-15) {
      return 0;
    }
    // When dot product is very close to -1, return π (vectors are anti-parallel)
    if (dotProduct <= -1 + 1e-15) {
      return Math.PI;
    }

    // Clamp to [-1, 1] to handle floating-point errors
    const clampedDot = clamp(dotProduct, -1, 1);

    // Compute angle using acos
    return Math.acos(clampedDot);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SpinAxisCalculator instance.
 * 
 * @returns SpinAxisCalculator implementation
 */
export function createSpinAxisCalculator(): SpinAxisCalculator {
  return new SpinAxisCalculatorImpl();
}

// ============================================================================
// Singleton Instance (for convenience)
// ============================================================================

/**
 * Default SpinAxisCalculator instance.
 * Use this for most cases; create new instances only if needed for testing.
 */
export const spinAxisCalculator = createSpinAxisCalculator();
