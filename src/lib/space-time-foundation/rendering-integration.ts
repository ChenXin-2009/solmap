/**
 * Rendering Integration Adapter
 * 
 * Connects the existing rendering system to the Space-Time Foundation.
 * Provides a bridge between the old direct VSOP87 access and the new
 * Space-Time Core architecture while maintaining backward compatibility.
 * 
 * This adapter ensures that:
 * 1. Render layer only accesses allowed interfaces
 * 2. No direct astronomical computation access from render components
 * 3. Time controls use Time Authority exclusively
 * 4. All celestial body data comes through Space-Time Core
 */

import { SpaceTimeCoreImpl } from './space-time-core';
import { TimeAuthorityImpl } from './time-authority';
import { RenderLayerInterfaceImpl } from './render-layer-interface';
import { StateVector, SpaceTimeResult, CelestialBodyId } from './types';
import { ERROR_CODES } from './constants';

/**
 * Legacy CelestialBody interface for backward compatibility
 */
export interface LegacyCelestialBody {
  name: string;
  x: number;      // Position in AU
  y: number;      // Position in AU  
  z: number;      // Position in AU
  r: number;      // Distance from Sun in AU
  radius: number; // Physical radius in AU
  color: string;
  isSun?: boolean;
  parent?: string;
  isSatellite?: boolean;
  elements?: any; // Legacy orbital elements (deprecated)
}

/**
 * Legacy ViewOffset interface for backward compatibility
 */
export interface LegacyViewOffset {
  x: number; // X-axis offset in AU
  y: number; // Y-axis offset in AU
}

/**
 * Time subscription callback type
 */
export type TimeSubscriptionCallback = (julianDate: number) => void;

/**
 * Rendering Integration Adapter
 * 
 * Provides a clean interface for the rendering system to access
 * Space-Time Foundation data while enforcing layer separation.
 */
export class RenderingIntegrationAdapter {
  private renderInterface: RenderLayerInterfaceImpl;
  private timeSubscriptions: Set<TimeSubscriptionCallback> = new Set();
  private isInitialized = false;

  constructor() {
    this.renderInterface = new RenderLayerInterfaceImpl();
  }

  /**
   * Initialize the adapter with Space-Time Core and Time Authority
   */
  initialize(
    spaceTimeCore: SpaceTimeCoreImpl, 
    timeAuthority: TimeAuthorityImpl
  ): SpaceTimeResult<void> {
    if (this.isInitialized) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.ALREADY_INITIALIZED,
          message: 'RenderingIntegrationAdapter already initialized'
        }
      };
    }

    const result = this.renderInterface.initialize(spaceTimeCore, timeAuthority);
    if (!result.success) {
      return result;
    }

    // Subscribe to time updates to notify legacy components
    this.renderInterface.subscribeToTime((julianDate) => {
      this.notifyTimeSubscribers(julianDate);
    });

    this.isInitialized = true;
    return { success: true, data: undefined };
  }

  /**
   * Get celestial bodies in legacy format for backward compatibility
   */
  getCelestialBodies(): LegacyCelestialBody[] {
    if (!this.isInitialized) {
      console.warn('RenderingIntegrationAdapter not initialized');
      return [];
    }

    try {
      const spaceTimeCore = this.renderInterface.getSpaceTimeCore();
      const availableBodies = spaceTimeCore.getAvailableBodies();
      
      const bodies: LegacyCelestialBody[] = [];
      
      for (const bodyId of availableBodies) {
        // Use current time from Time Authority
        const currentTime = this.renderInterface.getCurrentTime();
        const bodyResult = spaceTimeCore.getBodyState(bodyId, currentTime);
        if (bodyResult.success) {
          bodies.push(this.convertToLegacyFormat(bodyId as CelestialBodyId, bodyResult.data));
        }
      }
      
      return bodies;
    } catch (error) {
      console.error('Failed to get celestial bodies:', error);
      return [];
    }
  }

  /**
   * Get a specific celestial body by name
   */
  getCelestialBody(name: string): LegacyCelestialBody | null {
    if (!this.isInitialized) {
      console.warn('RenderingIntegrationAdapter not initialized');
      return null;
    }

    try {
      const spaceTimeCore = this.renderInterface.getSpaceTimeCore();
      const bodyId = name.toLowerCase() as CelestialBodyId;
      // Use current time from Time Authority
      const currentTime = this.renderInterface.getCurrentTime();
      const bodyResult = spaceTimeCore.getBodyState(bodyId, currentTime);
      
      if (!bodyResult.success) {
        return null;
      }

      return this.convertToLegacyFormat(bodyId, bodyResult.data);
    } catch (error) {
      console.error('Failed to get celestial body:', error);
      return null;
    }
  }

  /**
   * Get current time as JavaScript Date for legacy components
   */
  getCurrentTime(): Date {
    if (!this.isInitialized) {
      return new Date();
    }

    const julianDate = this.renderInterface.getCurrentTime();
    return this.julianDateToJSDate(julianDate);
  }

  /**
   * Subscribe to time updates (for legacy TimeControl component)
   */
  subscribeToTime(callback: TimeSubscriptionCallback): () => void {
    this.timeSubscriptions.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.timeSubscriptions.delete(callback);
    };
  }

  /**
   * Check if the adapter is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get render layer interface for advanced usage
   */
  getRenderInterface(): RenderLayerInterfaceImpl {
    return this.renderInterface;
  }

  /**
   * Convert StateVector to legacy CelestialBody format
   */
  private convertToLegacyFormat(bodyId: CelestialBodyId, stateVector: StateVector): LegacyCelestialBody {
    // Map body IDs to display properties
    const bodyProperties = this.getBodyDisplayProperties(bodyId);
    
    // Convert from km to AU for legacy compatibility
    const auConversion = 1.0 / 149597870.7; // km to AU
    
    return {
      name: this.formatBodyName(bodyId),
      x: stateVector.position.x * auConversion,
      y: stateVector.position.y * auConversion,
      z: stateVector.position.z * auConversion,
      r: Math.sqrt(
        (stateVector.position.x * auConversion) ** 2 + 
        (stateVector.position.y * auConversion) ** 2 + 
        (stateVector.position.z * auConversion) ** 2
      ),
      radius: stateVector.radius * auConversion,
      color: bodyProperties.color,
      isSun: bodyId === 'sun',
      parent: bodyProperties.parent,
      isSatellite: bodyProperties.isSatellite
    };
  }

  /**
   * Get display properties for a celestial body
   */
  private getBodyDisplayProperties(bodyId: CelestialBodyId): {
    color: string;
    parent?: string;
    isSatellite?: boolean;
  } {
    const properties: Record<CelestialBodyId, { color: string; parent?: string; isSatellite?: boolean }> = {
      sun: { color: '#FDB813' },
      mercury: { color: '#8C7853' },
      venus: { color: '#FFC649' },
      earth: { color: '#6B93D6' },
      mars: { color: '#C1440E' },
      jupiter: { color: '#D8CA9D' },
      saturn: { color: '#FAD5A5' },
      uranus: { color: '#4FD0E7' },
      neptune: { color: '#4B70DD' },
      moon: { color: '#C0C0C0', parent: 'earth', isSatellite: true },
      io: { color: '#FFFF99', parent: 'jupiter', isSatellite: true },
      europa: { color: '#87CEEB', parent: 'jupiter', isSatellite: true },
      ganymede: { color: '#8B7355', parent: 'jupiter', isSatellite: true },
      callisto: { color: '#4A4A4A', parent: 'jupiter', isSatellite: true },
      titan: { color: '#FFA500', parent: 'saturn', isSatellite: true },
      enceladus: { color: '#F0F8FF', parent: 'saturn', isSatellite: true },
      miranda: { color: '#D3D3D3', parent: 'uranus', isSatellite: true },
      ariel: { color: '#E6E6FA', parent: 'uranus', isSatellite: true },
      umbriel: { color: '#696969', parent: 'uranus', isSatellite: true },
      titania: { color: '#B0C4DE', parent: 'uranus', isSatellite: true },
      triton: { color: '#FFB6C1', parent: 'neptune', isSatellite: true }
    };

    return properties[bodyId] || { color: '#FFFFFF' };
  }

  /**
   * Format body ID to display name
   */
  private formatBodyName(bodyId: CelestialBodyId): string {
    const names: Record<CelestialBodyId, string> = {
      sun: 'Sun',
      mercury: 'Mercury',
      venus: 'Venus',
      earth: 'Earth',
      mars: 'Mars',
      jupiter: 'Jupiter',
      saturn: 'Saturn',
      uranus: 'Uranus',
      neptune: 'Neptune',
      moon: 'Moon',
      io: 'Io',
      europa: 'Europa',
      ganymede: 'Ganymede',
      callisto: 'Callisto',
      titan: 'Titan',
      enceladus: 'Enceladus',
      miranda: 'Miranda',
      ariel: 'Ariel',
      umbriel: 'Umbriel',
      titania: 'Titania',
      triton: 'Triton'
    };

    return names[bodyId] || bodyId;
  }

  /**
   * Convert Julian Date to JavaScript Date
   */
  private julianDateToJSDate(julianDate: number): Date {
    // Julian Date to JavaScript Date conversion
    // JD 2440587.5 = January 1, 1970 00:00:00 UTC (Unix epoch)
    const unixEpochJD = 2440587.5;
    const millisecondsPerDay = 86400000;
    
    const daysSinceEpoch = julianDate - unixEpochJD;
    const millisecondsSinceEpoch = daysSinceEpoch * millisecondsPerDay;
    
    return new Date(millisecondsSinceEpoch);
  }

  /**
   * Notify all time subscribers of time changes
   */
  private notifyTimeSubscribers(julianDate: number): void {
    this.timeSubscriptions.forEach(callback => {
      try {
        callback(julianDate);
      } catch (error) {
        console.error('Error in time subscription callback:', error);
      }
    });
  }

  /**
   * Dispose of the adapter and clean up resources
   */
  dispose(): void {
    this.timeSubscriptions.clear();
    if (this.renderInterface && typeof this.renderInterface.reset === 'function') {
      this.renderInterface.reset();
    }
    this.isInitialized = false;
  }
}

/**
 * Global singleton instance for easy access from legacy components
 */
let globalAdapter: RenderingIntegrationAdapter | null = null;

/**
 * Get the global rendering integration adapter instance
 */
export function getRenderingAdapter(): RenderingIntegrationAdapter {
  if (!globalAdapter) {
    globalAdapter = new RenderingIntegrationAdapter();
  }
  return globalAdapter;
}

/**
 * Initialize the global rendering adapter
 */
export function initializeRenderingAdapter(
  spaceTimeCore: SpaceTimeCoreImpl,
  timeAuthority: TimeAuthorityImpl
): SpaceTimeResult<void> {
  const adapter = getRenderingAdapter();
  return adapter.initialize(spaceTimeCore, timeAuthority);
}