/**
 * Space-Time Core Implementation
 * 
 * Central component managing coordinate systems and state queries.
 * Enforces strict layer separation between Physical Layer (authoritative) 
 * and Render Layer (read-only access only).
 * 
 * CRITICAL: Protected by CORE_RULES.md - modifications require approval.
 */

import {
  SpaceTimeCore,
  EphemerisProvider,
  EphemerisRouter,
  TimeAuthority,
  StateVector,
  ReferenceFrameInfo,
  BodyHierarchy,
  SpaceTimeResult
} from './interfaces';
import {
  STANDARD_BODY_IDS,
  ERROR_CODES,
  BODY_HIERARCHY_DEFINITIONS,
  PRIMARY_REFERENCE_FRAME
} from './constants';
import { EphemerisRouterImpl, EphemerisStrategyImpl } from './ephemeris-router';

/**
 * Space-Time Core Implementation
 * 
 * Manages the authoritative space-time coordinate system and provides
 * controlled access to celestial body states.
 */
export class SpaceTimeCoreImpl implements SpaceTimeCore {
  private timeAuthority: TimeAuthority | null = null;
  private referenceFrame: ReferenceFrameInfo | null = null;
  private ephemerisRouter: EphemerisRouter | null = null;
  private ephemerisStrategy: EphemerisStrategyImpl | null = null;
  private isInitialized = false;
  private bodyHierarchyCache: Map<string, BodyHierarchy> = new Map();

  constructor() {
    // Initialize empty - must call initialize() before use
  }

  // ========== INITIALIZATION (Physical Layer only) ==========

  initialize(timeAuthority: TimeAuthority, referenceFrame: ReferenceFrameInfo): SpaceTimeResult<void> {
    if (this.isInitialized) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Space-Time Core is already initialized'
        }
      };
    }

    // Validate inputs
    if (!timeAuthority) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Time Authority is required for initialization'
        }
      };
    }

    if (!referenceFrame) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference Frame is required for initialization'
        }
      };
    }

    // Validate reference frame is authoritative
    if (referenceFrame.type !== 'AUTHORITATIVE') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference Frame must be AUTHORITATIVE type for Space-Time Core'
        }
      };
    }

    // Validate reference frame matches primary frame
    if (referenceFrame.frameId !== PRIMARY_REFERENCE_FRAME.frameId) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: `Reference Frame must be primary frame '${PRIMARY_REFERENCE_FRAME.frameId}', got '${referenceFrame.frameId}'`
        }
      };
    }

    // Initialize components
    this.timeAuthority = timeAuthority;
    this.referenceFrame = referenceFrame;
    this.ephemerisStrategy = new EphemerisStrategyImpl();
    this.ephemerisRouter = new EphemerisRouterImpl(this.ephemerisStrategy);
    
    // Build body hierarchy cache
    this.buildBodyHierarchyCache();
    
    this.isInitialized = true;

    return { success: true, data: undefined };
  }

  // ========== READ-ONLY QUERIES (Render Layer allowed) ==========

  getBodyState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector> {
    if (!this.isInitialized || !this.ephemerisRouter) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.NOT_INITIALIZED,
          message: 'Space-Time Core is not initialized'
        }
      };
    }

    // Validate inputs
    if (!bodyId || typeof bodyId !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_BODY_ID,
          message: 'Body ID must be a valid string'
        }
      };
    }

    if (!Number.isFinite(julianDate)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_JULIAN_DATE,
          message: 'Julian Date must be a finite number'
        }
      };
    }

    // Route query to appropriate provider
    return this.ephemerisRouter.getState(bodyId, julianDate);
  }

  getBodiesState(bodyIds: readonly string[], julianDate: number): SpaceTimeResult<ReadonlyMap<string, StateVector>> {
    if (!this.isInitialized || !this.ephemerisRouter) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.NOT_INITIALIZED,
          message: 'Space-Time Core is not initialized'
        }
      };
    }

    // Validate inputs
    if (!Array.isArray(bodyIds) || bodyIds.length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_BODY_ID,
          message: 'Body IDs must be a non-empty array'
        }
      };
    }

    if (!Number.isFinite(julianDate)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_JULIAN_DATE,
          message: 'Julian Date must be a finite number'
        }
      };
    }

    // Get states for all bodies
    const stateMap = new Map<string, StateVector>();
    
    for (const bodyId of bodyIds) {
      const stateResult = this.ephemerisRouter.getState(bodyId, julianDate);
      
      if (!stateResult.success) {
        // Return first error encountered
        return stateResult as SpaceTimeResult<ReadonlyMap<string, StateVector>>;
      }
      
      stateMap.set(bodyId, stateResult.data);
    }

    return { success: true, data: stateMap };
  }

  getBodyHierarchy(bodyId: string): SpaceTimeResult<BodyHierarchy> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.NOT_INITIALIZED,
          message: 'Space-Time Core is not initialized'
        }
      };
    }

    if (!bodyId || typeof bodyId !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_BODY_ID,
          message: 'Body ID must be a valid string'
        }
      };
    }

    const hierarchy = this.bodyHierarchyCache.get(bodyId);
    if (!hierarchy) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.BODY_NOT_SUPPORTED,
          message: `Body '${bodyId}' not found in hierarchy`
        }
      };
    }

    return { success: true, data: hierarchy };
  }

  getReferenceFrameInfo(): ReferenceFrameInfo {
    if (!this.isInitialized || !this.referenceFrame) {
      throw new Error('Space-Time Core is not initialized');
    }
    
    return this.referenceFrame;
  }

  getAvailableBodies(): readonly string[] {
    if (!this.isInitialized || !this.ephemerisStrategy) {
      return [];
    }

    // Get all bodies supported by registered providers
    const allBodies = new Set<string>();
    
    for (const providerId of this.ephemerisStrategy.getRegisteredProviders()) {
      const provider = this.ephemerisStrategy.getProvider(providerId);
      if (provider) {
        for (const bodyId of provider.getSupportedBodies()) {
          allBodies.add(bodyId);
        }
      }
    }

    return Array.from(allBodies).sort();
  }

  // ========== WRITE OPERATIONS (Physical Layer only - Render Layer FORBIDDEN) ==========

  registerEphemerisProvider(provider: EphemerisProvider): SpaceTimeResult<void> {
    if (!this.isInitialized || !this.ephemerisStrategy) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.NOT_INITIALIZED,
          message: 'Space-Time Core is not initialized'
        }
      };
    }

    if (!provider) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Provider is required'
        }
      };
    }

    const result = this.ephemerisStrategy.registerProvider(provider);
    
    if (result.success) {
      // Update body hierarchy cache when new provider is added
      this.buildBodyHierarchyCache();
    }
    
    return result;
  }

  setProviderPriority(bodyId: string, providerIds: readonly string[]): SpaceTimeResult<void> {
    if (!this.isInitialized || !this.ephemerisStrategy) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.NOT_INITIALIZED,
          message: 'Space-Time Core is not initialized'
        }
      };
    }

    return this.ephemerisStrategy.setProviderPriority(bodyId, providerIds);
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Build body hierarchy cache from available providers and definitions
   */
  private buildBodyHierarchyCache(): void {
    this.bodyHierarchyCache.clear();

    // Add hierarchies from definitions
    for (const [bodyId, hierarchyDef] of Object.entries(BODY_HIERARCHY_DEFINITIONS)) {
      const hierarchy: BodyHierarchy = {
        bodyId,
        parentId: hierarchyDef.parentId,
        children: [...hierarchyDef.children], // Create copy
        hierarchyLevel: hierarchyDef.hierarchyLevel
      };
      
      this.bodyHierarchyCache.set(bodyId, hierarchy);
    }

    // Add any additional bodies from providers that aren't in definitions
    if (this.ephemerisStrategy) {
      for (const providerId of this.ephemerisStrategy.getRegisteredProviders()) {
        const provider = this.ephemerisStrategy.getProvider(providerId);
        if (provider) {
          for (const bodyId of provider.getSupportedBodies()) {
            if (!this.bodyHierarchyCache.has(bodyId)) {
              // Create default hierarchy for unknown bodies
              const hierarchy: BodyHierarchy = {
                bodyId,
                parentId: undefined, // Unknown parent
                children: [],
                hierarchyLevel: 0 // Default to root level
              };
              
              this.bodyHierarchyCache.set(bodyId, hierarchy);
            }
          }
        }
      }
    }
  }

  /**
   * Get current time from Time Authority (for internal use)
   */
  getCurrentTime(): number {
    if (!this.isInitialized || !this.timeAuthority) {
      throw new Error('Space-Time Core is not initialized');
    }
    
    return this.timeAuthority.getCurrentJulianDate();
  }

  /**
   * Check if the core is initialized (for testing/debugging)
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get provider count (for testing/debugging)
   */
  getProviderCount(): number {
    if (!this.ephemerisStrategy) {
      return 0;
    }
    
    return this.ephemerisStrategy.getRegisteredProviders().length;
  }

  /**
   * Get body hierarchy cache size (for testing/debugging)
   */
  getHierarchyCacheSize(): number {
    return this.bodyHierarchyCache.size;
  }

  /**
   * Clear all data (for testing only)
   */
  reset(): void {
    this.timeAuthority = null;
    this.referenceFrame = null;
    this.ephemerisRouter = null;
    this.ephemerisStrategy = null;
    this.isInitialized = false;
    this.bodyHierarchyCache.clear();
  }
}