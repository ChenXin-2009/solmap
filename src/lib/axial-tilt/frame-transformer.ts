/**
 * Frame Transformer Implementation
 * 
 * Transforms vectors between ICRF/J2000 (Z-up ecliptic) and
 * Three.js render frame (Y-up).
 * 
 * This is the ONLY module allowed to encode engine-specific axis conventions.
 * 
 * Transformation:
 *   ICRF/J2000 (Z-up):  X = vernal equinox, Y = completes RH system, Z = ecliptic normal
 *   Three.js (Y-up):    X = right, Y = up, Z = toward camera
 * 
 * Mapping:
 *   render_x = icrf_x
 *   render_y = icrf_z
 *   render_z = -icrf_y
 * 
 * @module axial-tilt/frame-transformer
 * @requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import {
  Vector3,
  FrameTransformer,
  createVector3,
  UNIT_VECTOR_TOLERANCE,
  AxialTiltErrorCodes,
} from './types';

// ============================================================================
// Vector Utilities
// ============================================================================

/**
 * Compute the magnitude (length) of a vector.
 */
function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// ============================================================================
// FrameTransformer Implementation
// ============================================================================

/**
 * Implementation of FrameTransformer interface.
 * 
 * Transforms vectors between ICRF/J2000 (Z-up ecliptic) and
 * Three.js render frame (Y-up).
 */
class FrameTransformerImpl implements FrameTransformer {
  /**
   * Transform vector from ICRF/J2000 (Z-up ecliptic) to Three.js (Y-up).
   * 
   * Transformation:
   *   render_x = icrf_x
   *   render_y = icrf_z
   *   render_z = -icrf_y
   * 
   * This transformation maps:
   *   - ICRF X-axis (vernal equinox) → Render X-axis
   *   - ICRF Z-axis (ecliptic normal, "up") → Render Y-axis ("up")
   *   - ICRF Y-axis → Render -Z-axis (to maintain right-handedness)
   * 
   * @param v - Vector in ICRF/J2000 frame
   * @returns Vector in Three.js render frame
   * 
   * @requirements 5.1, 5.2
   */
  icrfToRender(v: Vector3): Vector3 {
    return createVector3(
      v.x,      // render_x = icrf_x
      v.z,      // render_y = icrf_z
      -v.y      // render_z = -icrf_y
    );
  }

  /**
   * Transform vector from Three.js (Y-up) to ICRF/J2000 (Z-up ecliptic).
   * 
   * Inverse transformation:
   *   icrf_x = render_x
   *   icrf_y = -render_z
   *   icrf_z = render_y
   * 
   * @param v - Vector in Three.js render frame
   * @returns Vector in ICRF/J2000 frame
   * 
   * @requirements 5.1
   */
  renderToIcrf(v: Vector3): Vector3 {
    return createVector3(
      v.x,      // icrf_x = render_x
      -v.z,     // icrf_y = -render_z
      v.y       // icrf_z = render_y
    );
  }

  /**
   * Validate that a vector is a unit vector.
   * Logs warning if magnitude differs from 1 by more than tolerance.
   * 
   * @param v - Vector to validate
   * @param tolerance - Tolerance for magnitude check (default: UNIT_VECTOR_TOLERANCE)
   * @returns true if valid unit vector, false otherwise
   * 
   * @requirements 5.5
   */
  validateUnitVector(v: Vector3, tolerance: number = UNIT_VECTOR_TOLERANCE): boolean {
    const mag = magnitude(v);
    const isValid = Math.abs(mag - 1) <= tolerance;
    
    if (!isValid) {
      console.warn(
        `[${AxialTiltErrorCodes.NON_UNIT_VECTOR}] Vector is not a unit vector. ` +
        `Expected magnitude 1, got ${mag}. Vector: (${v.x}, ${v.y}, ${v.z})`
      );
    }
    
    return isValid;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FrameTransformer instance.
 * 
 * @returns FrameTransformer implementation
 */
export function createFrameTransformer(): FrameTransformer {
  return new FrameTransformerImpl();
}

// ============================================================================
// Singleton Instance (for convenience)
// ============================================================================

/**
 * Default FrameTransformer instance.
 * Use this for most cases; create new instances only if needed for testing.
 */
export const frameTransformer = createFrameTransformer();
