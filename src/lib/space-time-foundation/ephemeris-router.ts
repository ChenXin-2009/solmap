/**
 * Ephemeris Router and Strategy Implementation
 * 
 * Lightweight routing of state queries to appropriate providers.
 * Separated into Router + Strategy for clean responsibility separation.
 * 
 * CRITICAL: Protected by CORE_RULES.md - modifications require approval.
 */

import {
  EphemerisProvider,
  EphemerisRouter,
  EphemerisStrategy,
  StateVector,
  SpaceTimeResult
} from './interfaces';
import {
  ERROR_CODES,
  DEFAULT_PROVIDER_PRIORITIES
} from './constants';

/**
 * Ephemeris Strategy Implementation
 * 
 * Manages provider registration and selection strategy.
 * Separated from router for clean responsibility separation.
 */
export class EphemerisStrategyImpl implements EphemerisStrategy {
  private providers: Map<string, EphemerisProvider>;
  private priorities: Map<string, readonly string[]>;

  constructor() {
    this.providers = new Map();
    this.priorities = new Map();
    
    // Initialize with default priorities
    for (const [bodyId, providerIds] of Object.entries(DEFAULT_PROVIDER_PRIORITIES)) {
      this.priorities.set(bodyId, providerIds);
    }
  }

  registerProvider(provider: EphemerisProvider): SpaceTimeResult<void> {
    const providerId = provider.getProviderId();
    
    if (!providerId || typeof providerId !== 'string' || providerId.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Provider must have a valid non-empty ID'
        }
      };
    }

    if (this.providers.has(providerId)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: `Provider with ID '${providerId}' is already registered`
        }
      };
    }

    // Validate provider interface
    try {
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      if (!Array.isArray(supportedBodies)) {
        throw new Error('getSupportedBodies() must return an array');
      }
      
      if (!timeRange || typeof timeRange.startJD !== 'number' || typeof timeRange.endJD !== 'number') {
        throw new Error('getTimeRange() must return object with startJD and endJD numbers');
      }
      
      if (timeRange.startJD >= timeRange.endJD) {
        throw new Error('Invalid time range: startJD must be less than endJD');
      }
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INTERFACE_VIOLATION,
          message: `Provider interface validation failed: ${error}`
        }
      };
    }

    this.providers.set(providerId, provider);
    return { success: true, data: undefined };
  }

  setProviderPriority(bodyId: string, providerIds: readonly string[]): SpaceTimeResult<void> {
    if (!bodyId || typeof bodyId !== 'string' || bodyId.trim().length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Body ID must be a valid non-empty string'
        }
      };
    }

    if (!Array.isArray(providerIds) || providerIds.length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Provider IDs must be a non-empty array'
        }
      };
    }

    // Validate that all provider IDs are registered
    for (const providerId of providerIds) {
      if (!this.providers.has(providerId)) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.PROVIDER_UNAVAILABLE,
            message: `Provider '${providerId}' is not registered`
          }
        };
      }
    }

    this.priorities.set(bodyId, providerIds);
    return { success: true, data: undefined };
  }

  selectProvider(bodyId: string, julianDate: number): SpaceTimeResult<EphemerisProvider> {
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

    // Get priority list for this body
    const priorityList = this.priorities.get(bodyId) || [];
    
    // Try providers in priority order
    for (const providerId of priorityList) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;
      
      // Check if provider supports this body
      const supportedBodies = provider.getSupportedBodies();
      if (!supportedBodies.includes(bodyId)) continue;
      
      // Check if provider supports this time
      const timeRange = provider.getTimeRange();
      if (julianDate < timeRange.startJD || julianDate > timeRange.endJD) continue;
      
      // Found suitable provider
      return { success: true, data: provider };
    }

    // Try any available provider that supports this body and time
    for (const provider of this.providers.values()) {
      const supportedBodies = provider.getSupportedBodies();
      if (!supportedBodies.includes(bodyId)) continue;
      
      const timeRange = provider.getTimeRange();
      if (julianDate < timeRange.startJD || julianDate > timeRange.endJD) continue;
      
      // Found fallback provider
      return { success: true, data: provider };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.PROVIDER_UNAVAILABLE,
        message: `No provider available for body '${bodyId}' at Julian Date ${julianDate}`
      }
    };
  }

  getRegisteredProviders(): readonly string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider by ID (for testing/debugging)
   */
  getProvider(providerId: string): EphemerisProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get priority list for a body (for testing/debugging)
   */
  getPriorities(bodyId: string): readonly string[] {
    return this.priorities.get(bodyId) || [];
  }

  /**
   * Clear all providers (for testing)
   */
  clear(): void {
    this.providers.clear();
    this.priorities.clear();
    
    // Restore default priorities
    for (const [bodyId, providerIds] of Object.entries(DEFAULT_PROVIDER_PRIORITIES)) {
      this.priorities.set(bodyId, providerIds);
    }
  }
}

/**
 * Ephemeris Router Implementation
 * 
 * Lightweight routing of state queries to appropriate providers.
 * Uses strategy for provider selection.
 */
export class EphemerisRouterImpl implements EphemerisRouter {
  private strategy: EphemerisStrategy;

  constructor(strategy: EphemerisStrategy) {
    this.strategy = strategy;
  }

  getState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector> {
    // Select appropriate provider
    const providerResult = this.strategy.selectProvider(bodyId, julianDate);
    if (!providerResult.success) {
      return providerResult as SpaceTimeResult<StateVector>;
    }

    const provider = providerResult.data;

    // Get state from provider
    try {
      return provider.getState(bodyId, julianDate);
    } catch (error) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.CALCULATION_FAILED,
          message: `Provider '${provider.getProviderId()}' failed to calculate state: ${error}`,
          details: { bodyId, julianDate, providerId: provider.getProviderId() }
        }
      };
    }
  }

  getStates(bodyId: string, julianDates: readonly number[]): SpaceTimeResult<readonly StateVector[]> {
    if (!Array.isArray(julianDates) || julianDates.length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_JULIAN_DATE,
          message: 'Julian dates must be a non-empty array'
        }
      };
    }

    // For bulk queries, we'll use the first date to select provider
    // In a more sophisticated implementation, we might select different providers for different time ranges
    const firstDate = julianDates[0];
    const providerResult = this.strategy.selectProvider(bodyId, firstDate);
    if (!providerResult.success) {
      return providerResult as SpaceTimeResult<readonly StateVector[]>;
    }

    const provider = providerResult.data;

    // Check if provider supports bulk queries
    try {
      return provider.getStates(bodyId, julianDates);
    } catch (error) {
      // Fallback to individual queries if bulk query fails
      try {
        const states: StateVector[] = [];
        
        for (const jd of julianDates) {
          const stateResult = provider.getState(bodyId, jd);
          if (!stateResult.success) {
            return stateResult as SpaceTimeResult<readonly StateVector[]>;
          }
          states.push(stateResult.data);
        }
        
        return { success: true, data: states };
      } catch (fallbackError) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.CALCULATION_FAILED,
            message: `Provider '${provider.getProviderId()}' failed bulk calculation: ${error}`,
            details: { bodyId, julianDates: julianDates.length, providerId: provider.getProviderId() }
          }
        };
      }
    }
  }

  /**
   * Get the underlying strategy (for testing/configuration)
   */
  getStrategy(): EphemerisStrategy {
    return this.strategy;
  }
}