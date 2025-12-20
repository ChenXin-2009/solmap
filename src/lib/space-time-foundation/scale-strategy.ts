/**
 * Scale Strategy for Render Layer Only
 * 
 * CRITICAL: This component exists ONLY in the Render Layer.
 * It NEVER modifies physical positions from the Physical Layer.
 * All scaling operations are for display purposes only.
 * 
 * Physical positions remain immutable and authoritative.
 * Display positions are derived through transforms for visualization.
 */

import { Vector3 } from 'three';
import { Matrix4 } from 'three';
import { StateVector } from './interfaces';
import { SpaceTimeResult } from './types';
import { ERROR_CODES } from './constants';

/**
 * Scale strategy interface for render layer transformations
 */
export interface ScaleStrategy {
  /**
   * Physical coordinates (READ-ONLY reference from Physical Layer)
   * These coordinates are NEVER modified by the render layer
   */
  readonly physicalPosition: Vector3; // km - immutable reference
  
  /**
   * Display coordinates (Render Layer calculations only)
   * These are derived from physical coordinates for visualization
   */
  displayPosition: Vector3; // scaled for visualization
  
  /**
   * Scale factors (Render Layer only)
   */
  visualScale: number; // logarithmic/non-linear scaling
  realScale: number; // linear scaling
  
  /**
   * Camera transforms (Render Layer only - separate from physical position)
   */
  cameraTransform: Matrix4;
}

/**
 * Scale configuration for different visualization modes
 */
export interface ScaleConfig {
  /** Minimum scale factor to prevent invisible objects */
  minScale: number;
  
  /** Maximum scale factor to prevent overflow */
  maxScale: number;
  
  /** Base scale for 1:1 physical to display mapping */
  baseScale: number;
  
  /** Logarithmic scaling factor for large distance ranges */
  logScaleFactor: number;
  
  /** Whether to use logarithmic scaling for extreme distances */
  useLogarithmicScaling: boolean;
}

/**
 * Default scale configuration for solar system visualization
 */
export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  minScale: 1e-12,
  maxScale: 1e12,
  baseScale: 1.0,
  logScaleFactor: 10.0,
  useLogarithmicScaling: true
};

/**
 * Scale manager for render layer transformations
 * 
 * CRITICAL CONSTRAINTS:
 * - NEVER modifies physical positions from StateVector
 * - Only creates display transforms for visualization
 * - Maintains separation between physical and display coordinates
 * - All operations are render layer only
 */
export class RenderScaleManager {
  private config: ScaleConfig;
  private activeStrategies: Map<string, ScaleStrategy>;
  
  constructor(config: ScaleConfig = DEFAULT_SCALE_CONFIG) {
    this.config = { ...config };
    this.activeStrategies = new Map();
  }
  
  /**
   * Create scale strategy for a celestial body
   * 
   * @param bodyId - Celestial body identifier
   * @param stateVector - Physical state from Physical Layer (READ-ONLY)
   * @returns Scale strategy for render layer use
   */
  createScaleStrategy(
    bodyId: string, 
    stateVector: Readonly<StateVector>
  ): SpaceTimeResult<ScaleStrategy> {
    try {
      // Validate input
      if (!bodyId || bodyId.trim().length === 0) {
        return { 
          success: false, 
          error: { 
            code: ERROR_CODES.INVALID_BODY_ID, 
            message: 'Body ID cannot be empty' 
          } 
        };
      }
      
      if (!stateVector || !stateVector.position) {
        return { 
          success: false, 
          error: { 
            code: ERROR_CODES.INVALID_STATE_VECTOR, 
            message: 'Invalid state vector provided' 
          } 
        };
      }
      
      // Create immutable reference to physical position
      // CRITICAL: This is READ-ONLY, never modified
      const physicalPosition = new Vector3(
        stateVector.position.x,
        stateVector.position.y,
        stateVector.position.z
      );
      Object.freeze(physicalPosition); // Ensure immutability
      
      // Calculate display position through scaling transforms
      const displayPosition = this.calculateDisplayPosition(physicalPosition);
      
      // Calculate scale factors
      const distance = physicalPosition.length();
      const visualScale = this.calculateVisualScale(distance);
      const realScale = this.calculateRealScale(distance);
      
      // Create identity camera transform (can be modified by camera controller)
      const cameraTransform = new Matrix4().identity();
      
      // Create scale strategy
      const strategy: ScaleStrategy = {
        physicalPosition, // READ-ONLY reference
        displayPosition,
        visualScale,
        realScale,
        cameraTransform
      };
      
      // Store strategy for updates
      this.activeStrategies.set(bodyId, strategy);
      
      return { success: true, data: strategy };
      
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: ERROR_CODES.CALCULATION_FAILED, 
          message: `Failed to create scale strategy for ${bodyId}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        } 
      };
    }
  }
  
  /**
   * Update scale strategy with new physical state
   * 
   * @param bodyId - Celestial body identifier
   * @param stateVector - Updated physical state (READ-ONLY)
   * @returns Updated scale strategy
   */
  updateScaleStrategy(
    bodyId: string,
    stateVector: Readonly<StateVector>
  ): SpaceTimeResult<ScaleStrategy> {
    const existingStrategy = this.activeStrategies.get(bodyId);
    if (!existingStrategy) {
      // Create new strategy if none exists
      return this.createScaleStrategy(bodyId, stateVector);
    }
    
    try {
      // Update physical position reference (READ-ONLY)
      const newPhysicalPosition = new Vector3(
        stateVector.position.x,
        stateVector.position.y,
        stateVector.position.z
      );
      Object.freeze(newPhysicalPosition);
      
      // Recalculate display transforms
      const displayPosition = this.calculateDisplayPosition(newPhysicalPosition);
      const distance = newPhysicalPosition.length();
      const visualScale = this.calculateVisualScale(distance);
      const realScale = this.calculateRealScale(distance);
      
      // Update strategy (preserve camera transform)
      const updatedStrategy: ScaleStrategy = {
        physicalPosition: newPhysicalPosition,
        displayPosition,
        visualScale,
        realScale,
        cameraTransform: existingStrategy.cameraTransform // Preserve camera state
      };
      
      this.activeStrategies.set(bodyId, updatedStrategy);
      
      return { success: true, data: updatedStrategy };
      
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: ERROR_CODES.CALCULATION_FAILED, 
          message: `Failed to update scale strategy for ${bodyId}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        } 
      };
    }
  }
  
  /**
   * Get current scale strategy for a body
   */
  getScaleStrategy(bodyId: string): ScaleStrategy | undefined {
    return this.activeStrategies.get(bodyId);
  }
  
  /**
   * Update camera transform for a body's scale strategy
   * 
   * @param bodyId - Celestial body identifier
   * @param transform - New camera transform matrix
   */
  updateCameraTransform(bodyId: string, transform: Matrix4): SpaceTimeResult<void> {
    const strategy = this.activeStrategies.get(bodyId);
    if (!strategy) {
      return { 
        success: false, 
        error: { 
          code: ERROR_CODES.INVALID_BODY_ID, 
          message: `No scale strategy found for body: ${bodyId}` 
        } 
      };
    }
    
    try {
      // Update camera transform (this is render layer only)
      strategy.cameraTransform.copy(transform);
      return { success: true, data: undefined };
      
    } catch (error) {
      return { 
        success: false, 
        error: { 
          code: ERROR_CODES.CALCULATION_FAILED, 
          message: `Failed to update camera transform for ${bodyId}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        } 
      };
    }
  }
  
  /**
   * Remove scale strategy for a body
   */
  removeScaleStrategy(bodyId: string): void {
    this.activeStrategies.delete(bodyId);
  }
  
  /**
   * Clear all scale strategies
   */
  clearAllStrategies(): void {
    this.activeStrategies.clear();
  }
  
  /**
   * Get current scale configuration
   */
  getConfig(): Readonly<ScaleConfig> {
    return { ...this.config };
  }
  
  /**
   * Update scale configuration
   */
  updateConfig(newConfig: Partial<ScaleConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recalculate all existing strategies with new config
    for (const [bodyId, strategy] of this.activeStrategies.entries()) {
      const distance = strategy.physicalPosition.length();
      strategy.displayPosition = this.calculateDisplayPosition(strategy.physicalPosition);
      strategy.visualScale = this.calculateVisualScale(distance);
      strategy.realScale = this.calculateRealScale(distance);
    }
  }
  
  /**
   * Calculate display position from physical position
   * 
   * CRITICAL: Physical position is never modified
   */
  private calculateDisplayPosition(physicalPosition: Readonly<Vector3>): Vector3 {
    const distance = physicalPosition.length();
    const scale = this.calculateVisualScale(distance);
    
    // Create new vector for display (never modify physical)
    return new Vector3(
      physicalPosition.x * scale,
      physicalPosition.y * scale,
      physicalPosition.z * scale
    );
  }
  
  /**
   * Calculate visual scale factor based on distance
   */
  private calculateVisualScale(distance: number): number {
    if (distance === 0) return this.config.baseScale;
    
    let scale: number;
    
    if (this.config.useLogarithmicScaling && distance > 1e6) {
      // Logarithmic scaling for very large distances
      const logDistance = Math.log10(distance);
      const logBase = Math.log10(1e6); // Start log scaling at 1M km
      scale = this.config.baseScale * Math.pow(this.config.logScaleFactor, -(logDistance - logBase));
    } else {
      // Linear scaling for smaller distances
      scale = this.config.baseScale / Math.max(1, distance / 1e6);
    }
    
    // Clamp to configured limits
    return Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));
  }
  
  /**
   * Calculate real (linear) scale factor
   */
  private calculateRealScale(distance: number): number {
    if (distance === 0) return this.config.baseScale;
    
    const scale = this.config.baseScale / Math.max(1, distance / 1e6);
    return Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    this.activeStrategies.clear();
  }
}

/**
 * Utility functions for scale calculations
 */
export class ScaleUtils {
  /**
   * Convert physical distance to display scale
   */
  static physicalToDisplayScale(physicalDistance: number, config: ScaleConfig): number {
    if (physicalDistance === 0) return config.baseScale;
    
    if (config.useLogarithmicScaling && physicalDistance > 1e6) {
      const logDistance = Math.log10(physicalDistance);
      const logBase = Math.log10(1e6);
      return config.baseScale * Math.pow(config.logScaleFactor, -(logDistance - logBase));
    } else {
      return config.baseScale / Math.max(1, physicalDistance / 1e6);
    }
  }
  
  /**
   * Calculate optimal scale for a set of positions
   */
  static calculateOptimalScale(positions: Vector3[], config: ScaleConfig): number {
    if (positions.length === 0) return config.baseScale;
    
    // Find the range of distances
    const distances = positions.map(pos => pos.length());
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    
    // Use geometric mean for optimal scale
    const geometricMean = Math.sqrt(minDistance * maxDistance);
    return ScaleUtils.physicalToDisplayScale(geometricMean, config);
  }
  
  /**
   * Validate scale configuration
   */
  static validateScaleConfig(config: ScaleConfig): string[] {
    const errors: string[] = [];
    
    if (config.minScale <= 0) {
      errors.push('minScale must be positive');
    }
    
    if (config.maxScale <= config.minScale) {
      errors.push('maxScale must be greater than minScale');
    }
    
    if (config.baseScale <= 0) {
      errors.push('baseScale must be positive');
    }
    
    if (config.logScaleFactor <= 1) {
      errors.push('logScaleFactor must be greater than 1');
    }
    
    return errors;
  }
}