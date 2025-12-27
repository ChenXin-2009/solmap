/**
 * Mesh Orientation Manager Implementation
 * 
 * Applies spin axis orientation to Three.js meshes.
 * This is a Render Layer component.
 * 
 * CRITICAL CONSTRAINTS:
 * - This module is the ONLY place where Three.js quaternion operations are performed
 * - Physical Layer vectors (ICRF/J2000) are transformed via FrameTransformer before use
 * - Orientation is REPLACED, not accumulated (idempotency guarantee)
 * 
 * @module axial-tilt/mesh-orientation-manager
 * @requirements 4.2, 4.3, 4.4, 4.5, 4.7
 */

import * as THREE from 'three';
import {
  Vector3,
  MeshOrientationManager,
  ModelConfig,
  DEFAULT_MODEL_CONFIG,
  createVector3,
} from './types';
import { frameTransformer } from './frame-transformer';

// ============================================================================
// Vector Utilities
// ============================================================================

/**
 * Convert our Vector3 interface to Three.js Vector3.
 */
function toThreeVector3(v: Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

/**
 * Convert Three.js Vector3 to our Vector3 interface.
 */
function fromThreeVector3(v: THREE.Vector3): Vector3 {
  return createVector3(v.x, v.y, v.z);
}

/**
 * Compute the magnitude of a vector.
 */
function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize a vector to unit length.
 */
function normalize(v: Vector3): Vector3 {
  const mag = magnitude(v);
  if (mag < 1e-15) {
    // Return default for zero vector
    return createVector3(0, 1, 0);
  }
  return createVector3(v.x / mag, v.y / mag, v.z / mag);
}

// ============================================================================
// MeshOrientationManager Implementation
// ============================================================================

/**
 * Implementation of MeshOrientationManager interface.
 * 
 * Applies spin axis orientation to Three.js meshes using quaternions.
 * Ensures idempotency: applying the same orientation multiple times
 * results in the same final mesh orientation.
 */
class MeshOrientationManagerImpl implements MeshOrientationManager {
  /**
   * Apply spin axis orientation to mesh.
   * 
   * Process:
   *   1. Transform spinAxis from ICRF to Render frame
   *   2. Create quaternion: setFromUnitVectors(modelNorthAxis, spinAxis)
   *   3. Apply to mesh.quaternion (REPLACE, not accumulate)
   * 
   * IDEMPOTENCY GUARANTEE:
   *   This operation is idempotent: applying it multiple times
   *   with the same inputs results in the same mesh orientation.
   *   The mesh's previous orientation is REPLACED, not accumulated.
   * 
   * @param mesh - Three.js mesh to orient (must have quaternion property)
   * @param spinAxis - Spin axis in ICRF/J2000 frame (unit vector)
   * @param modelConfig - Model-specific configuration
   * 
   * @requirements 4.2, 4.3, 4.4, 4.7
   */
  applySpinAxisOrientation(
    mesh: unknown,
    spinAxis: Vector3,
    modelConfig: ModelConfig
  ): void {
    // Type guard: ensure mesh has quaternion property
    const threeMesh = mesh as THREE.Object3D;
    if (!threeMesh || !threeMesh.quaternion) {
      console.warn('[MeshOrientationManager] Invalid mesh: missing quaternion property');
      return;
    }

    // Validate input vectors
    frameTransformer.validateUnitVector(spinAxis);
    frameTransformer.validateUnitVector(modelConfig.northAxis);

    // Step 1: Transform spinAxis from ICRF/J2000 to Render frame
    const spinAxisRender = frameTransformer.icrfToRender(spinAxis);

    // Normalize to ensure unit vector (defensive)
    const normalizedSpinAxis = normalize(spinAxisRender);
    const normalizedNorthAxis = normalize(modelConfig.northAxis);

    // Convert to Three.js vectors
    const spinAxisThree = toThreeVector3(normalizedSpinAxis);
    const northAxisThree = toThreeVector3(normalizedNorthAxis);

    // Step 2: Create quaternion that rotates modelNorthAxis to spinAxis
    // setFromUnitVectors(from, to) creates a quaternion that rotates 'from' to 'to'
    const orientationQuaternion = new THREE.Quaternion();
    orientationQuaternion.setFromUnitVectors(northAxisThree, spinAxisThree);

    // Step 3: Apply to mesh (REPLACE, not accumulate)
    // This ensures idempotency: same inputs always produce same output
    threeMesh.quaternion.copy(orientationQuaternion);
  }

  /**
   * Apply daily rotation around spin axis.
   * 
   * This rotation is COMPOSED with the base orientation, not replacing it.
   * The rotation occurs around the spin axis direction.
   * 
   * @param mesh - Three.js mesh to rotate
   * @param spinAxis - Spin axis in Render frame (unit vector)
   * @param rotationAngle - Rotation angle in radians
   * 
   * @requirements 4.5
   */
  applyDailyRotation(
    mesh: unknown,
    spinAxis: Vector3,
    rotationAngle: number
  ): void {
    // Type guard: ensure mesh has quaternion property
    const threeMesh = mesh as THREE.Object3D;
    if (!threeMesh || !threeMesh.quaternion) {
      console.warn('[MeshOrientationManager] Invalid mesh: missing quaternion property');
      return;
    }

    // Validate spin axis is a unit vector
    frameTransformer.validateUnitVector(spinAxis);

    // Normalize to ensure unit vector (defensive)
    const normalizedSpinAxis = normalize(spinAxis);

    // Convert to Three.js vector
    const spinAxisThree = toThreeVector3(normalizedSpinAxis);

    // Create rotation quaternion around spin axis
    const rotationQuaternion = new THREE.Quaternion();
    rotationQuaternion.setFromAxisAngle(spinAxisThree, rotationAngle);

    // Compose with existing orientation: rotation * current
    // This applies the daily rotation on top of the base orientation
    // Order matters: we want to rotate around the spin axis in world space
    threeMesh.quaternion.premultiply(rotationQuaternion);
  }

  /**
   * Get the transformed spin axis in render frame.
   * Utility method for testing and debugging.
   * 
   * @param spinAxis - Spin axis in ICRF/J2000 frame
   * @returns Spin axis in Render frame
   */
  getSpinAxisInRenderFrame(spinAxis: Vector3): Vector3 {
    return frameTransformer.icrfToRender(spinAxis);
  }

  /**
   * Extract the effective spin axis from a mesh's current orientation.
   * Utility method for testing and debugging.
   * 
   * @param mesh - Three.js mesh
   * @param modelConfig - Model-specific configuration
   * @returns The direction the model's north axis is currently pointing
   */
  getEffectiveSpinAxis(
    mesh: unknown,
    modelConfig: ModelConfig
  ): Vector3 {
    const threeMesh = mesh as THREE.Object3D;
    if (!threeMesh || !threeMesh.quaternion) {
      return modelConfig.northAxis;
    }

    // Apply the mesh's quaternion to the model's north axis
    const northAxisThree = toThreeVector3(modelConfig.northAxis);
    northAxisThree.applyQuaternion(threeMesh.quaternion);

    return fromThreeVector3(northAxisThree);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MeshOrientationManager instance.
 * 
 * @returns MeshOrientationManager implementation
 */
export function createMeshOrientationManager(): MeshOrientationManager {
  return new MeshOrientationManagerImpl();
}

// ============================================================================
// Singleton Instance (for convenience)
// ============================================================================

/**
 * Default MeshOrientationManager instance.
 * Use this for most cases; create new instances only if needed for testing.
 */
export const meshOrientationManager = createMeshOrientationManager();

// ============================================================================
// Extended Interface for Testing
// ============================================================================

/**
 * Extended interface with utility methods for testing.
 */
export interface MeshOrientationManagerExtended extends MeshOrientationManager {
  getSpinAxisInRenderFrame(spinAxis: Vector3): Vector3;
  getEffectiveSpinAxis(mesh: unknown, modelConfig: ModelConfig): Vector3;
}

/**
 * Create an extended MeshOrientationManager with utility methods.
 */
export function createMeshOrientationManagerExtended(): MeshOrientationManagerExtended {
  return new MeshOrientationManagerImpl();
}
