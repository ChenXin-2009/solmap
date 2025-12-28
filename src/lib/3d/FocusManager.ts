/**
 * FocusManager.ts - Enhanced camera focus management
 * 
 * Provides intelligent focus distance calculation based on object size and type,
 * smooth focus transitions, and penetration prevention.
 */

import * as THREE from 'three';
import { CAMERA_PENETRATION_CONFIG, FOCUS_SETTINGS } from '@/lib/config/cameraConfig';

export interface CelestialObject {
  name: string;
  radius: number;
  isSun?: boolean;
  isSatellite?: boolean;
  parent?: string;
}

export interface FocusOptions {
  distance?: number;
  transitionDuration?: number;
  allowUserInterrupt?: boolean;
  maintainOrientation?: boolean;
}

export interface PenetrationConstraint {
  minDistance: number;
  safetyMultiplier: number;
  smoothingFactor: number;
  enabled: boolean;
}

export class FocusManager {
  private currentTarget: CelestialObject | null = null;
  private isTransitioning: boolean = false;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 1000; // milliseconds
  
  /**
   * Calculate optimal focus distance based on object properties
   * @param object Target celestial object
   * @param options Optional focus parameters
   * @returns Optimal focus distance in AU
   */
  calculateFocusDistance(object: CelestialObject, options?: FocusOptions): number {
    // Base distance multiplier based on object type
    let baseMultiplier = FOCUS_SETTINGS.focusDistanceMultiplier;
    
    // Adjust multiplier based on object type
    if (object.isSun) {
      // Sun needs larger distance due to its size and glow effects
      baseMultiplier *= 2.5;
    } else if (object.isSatellite) {
      // Satellites can be viewed closer for detail
      baseMultiplier *= 0.8;
    }
    
    // Calculate base distance from object radius
    let focusDistance = object.radius * baseMultiplier;
    
    // Apply size-based scaling for very large or very small objects
    if (object.radius > 0.001) {
      // Large objects (like gas giants) need proportionally more distance
      const sizeScale = Math.log10(object.radius / 0.0001) / 4; // Logarithmic scaling
      focusDistance *= (1 + sizeScale * 0.5);
    } else {
      // Very small objects need minimum viable distance
      focusDistance = Math.max(focusDistance, 0.001);
    }
    
    // Apply user-specified distance if provided
    if (options?.distance !== undefined) {
      focusDistance = Math.max(focusDistance, options.distance);
    }
    
    // Ensure minimum safe distance
    const minSafeDistance = object.radius * CAMERA_PENETRATION_CONFIG.safetyDistanceMultiplier;
    focusDistance = Math.max(focusDistance, minSafeDistance);
    
    return focusDistance;
  }
  
  /**
   * Check if camera position would penetrate object
   * @param cameraPosition Camera position
   * @param objectCenter Object center position
   * @param objectRadius Object radius
   * @returns True if penetration would occur
   */
  checkPenetration(cameraPosition: THREE.Vector3, objectCenter: THREE.Vector3, objectRadius: number): boolean {
    const distance = cameraPosition.distanceTo(objectCenter);
    const minSafeDistance = objectRadius * CAMERA_PENETRATION_CONFIG.safetyDistanceMultiplier;
    return distance < minSafeDistance;
  }
  
  /**
   * Apply penetration constraints to camera position
   * @param cameraPosition Current camera position (will be modified)
   * @param objectCenter Object center position
   * @param objectRadius Object radius
   * @returns Modified safe camera position
   */
  applyPenetrationConstraints(
    cameraPosition: THREE.Vector3, 
    objectCenter: THREE.Vector3, 
    objectRadius: number
  ): THREE.Vector3 {
    const distance = cameraPosition.distanceTo(objectCenter);
    const minSafeDistance = objectRadius * CAMERA_PENETRATION_CONFIG.safetyDistanceMultiplier;
    
    if (distance < minSafeDistance) {
      // Calculate direction from object center to camera
      const direction = new THREE.Vector3()
        .subVectors(cameraPosition, objectCenter)
        .normalize();
      
      // If direction is invalid, use default upward direction
      if (direction.length() < 0.001) {
        direction.set(0, 1, 0);
      }
      
      // Place camera at safe distance
      const safePosition = objectCenter.clone()
        .add(direction.multiplyScalar(minSafeDistance));
      
      return safePosition;
    }
    
    return cameraPosition.clone();
  }
  
  /**
   * Start focus transition
   * @param target Target object
   * @param options Focus options
   */
  startFocusTransition(target: CelestialObject, options?: FocusOptions): void {
    this.currentTarget = target;
    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.transitionDuration = options?.transitionDuration || 1000;
  }
  
  /**
   * Update focus transition
   * @param deltaTime Time since last update (seconds)
   * @returns Transition progress (0-1), or -1 if not transitioning
   */
  updateFocusTransition(deltaTime: number): number {
    if (!this.isTransitioning) {
      return -1;
    }
    
    const elapsed = Date.now() - this.transitionStartTime;
    const progress = Math.min(1, elapsed / this.transitionDuration);
    
    if (progress >= 1) {
      this.isTransitioning = false;
      this.currentTarget = null;
    }
    
    return progress;
  }
  
  /**
   * Interrupt current transition
   */
  interruptTransition(): void {
    this.isTransitioning = false;
    this.currentTarget = null;
  }
  
  /**
   * Get current transition state
   */
  isCurrentlyTransitioning(): boolean {
    return this.isTransitioning;
  }
  
  /**
   * Get current target object
   */
  getCurrentTarget(): CelestialObject | null {
    return this.currentTarget;
  }
  
  /**
   * Calculate smooth easing function for transitions
   * @param t Progress value (0-1)
   * @returns Eased value (0-1)
   */
  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * Calculate focus distance for different object types with size scaling
   * @param objectType Type of object ('sun', 'planet', 'satellite', 'asteroid')
   * @param objectRadius Object radius in AU
   * @returns Recommended focus distance in AU
   */
  static calculateDistanceByType(objectType: string, objectRadius: number): number {
    const baseMultipliers = {
      sun: 8.0,      // Sun needs large distance due to glow
      planet: 6.0,   // Standard planets
      satellite: 4.0, // Moons can be viewed closer
      asteroid: 3.0   // Small objects need closer view
    };
    
    const multiplier = baseMultipliers[objectType as keyof typeof baseMultipliers] || 5.0;
    
    // Apply logarithmic scaling for size
    const sizeScale = Math.max(1, Math.log10(objectRadius / 0.00001) / 2);
    
    return objectRadius * multiplier * sizeScale;
  }
}