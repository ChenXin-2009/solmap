/**
 * Event Bus Implementation
 * 
 * Provides a centralized event system for communication between services and components.
 * This enables loose coupling and reactive programming patterns.
 */

import type { EventBus, EventCallback } from './types';

export class EventBusImpl implements EventBus {
  private listeners = new Map<string, Set<EventCallback>>();
  private onceListeners = new Map<string, Set<EventCallback>>();

  /**
   * Subscribe to an event
   */
  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      
      // Clean up empty event sets
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceEventListeners = this.onceListeners.get(event);
    if (onceEventListeners) {
      onceEventListeners.delete(callback);
      
      if (onceEventListeners.size === 0) {
        this.onceListeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T>(event: string, data?: T): void {
    // Handle regular listeners
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for '${event}':`, error);
        }
      });
    }

    // Handle once listeners
    const onceEventListeners = this.onceListeners.get(event);
    if (onceEventListeners) {
      const listenersToCall = Array.from(onceEventListeners);
      this.onceListeners.delete(event); // Clear once listeners
      
      listenersToCall.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in once event listener for '${event}':`, error);
        }
      });
    }
  }

  /**
   * Subscribe to an event that will only fire once
   */
  once<T>(event: string, callback: EventCallback<T>): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    
    this.onceListeners.get(event)!.add(callback);
  }

  /**
   * Clear all event listeners
   */
  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  /**
   * Get all event names that have listeners
   */
  getEventNames(): string[] {
    const regularEvents = Array.from(this.listeners.keys());
    const onceEvents = Array.from(this.onceListeners.keys());
    return [...new Set([...regularEvents, ...onceEvents])];
  }

  /**
   * Get listener count for an event
   */
  getListenerCount(event: string): number {
    const regularCount = this.listeners.get(event)?.size || 0;
    const onceCount = this.onceListeners.get(event)?.size || 0;
    return regularCount + onceCount;
  }

  /**
   * Remove all listeners for a specific event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.clear();
    }
  }
}

// Create and export global event bus instance
export const eventBus = new EventBusImpl();

// Common event names used throughout the application
export const InfrastructureEvents = {
  // User preferences
  PREFERENCES_CHANGED: 'preferences:changed',
  PREFERENCES_LOADED: 'preferences:loaded',
  PREFERENCES_SAVED: 'preferences:saved',
  
  // Performance
  PERFORMANCE_METRICS_UPDATED: 'performance:metrics-updated',
  PERFORMANCE_THRESHOLD_EXCEEDED: 'performance:threshold-exceeded',
  QUALITY_SETTINGS_ADJUSTED: 'performance:quality-adjusted',
  
  // Cache
  CACHE_HIT: 'cache:hit',
  CACHE_MISS: 'cache:miss',
  CACHE_EVICTION: 'cache:eviction',
  CACHE_CLEARED: 'cache:cleared',
  
  // Search
  SEARCH_QUERY: 'search:query',
  SEARCH_RESULTS: 'search:results',
  SEARCH_INDEX_UPDATED: 'search:index-updated',
  
  // Errors
  ERROR_OCCURRED: 'error:occurred',
  ERROR_RECOVERED: 'error:recovered',
  ERROR_STATS_UPDATED: 'error:stats-updated',
  
  // Configuration
  CONFIG_CHANGED: 'config:changed',
  CONFIG_RESET: 'config:reset',
  PRESET_APPLIED: 'config:preset-applied',
  
  // Offline/Online
  ONLINE_STATUS_CHANGED: 'offline:status-changed',
  SYNC_STARTED: 'offline:sync-started',
  SYNC_COMPLETED: 'offline:sync-completed',
  SYNC_FAILED: 'offline:sync-failed',
  
  // UI
  THEME_CHANGED: 'ui:theme-changed',
  LANGUAGE_CHANGED: 'ui:language-changed',
  LAYOUT_CHANGED: 'ui:layout-changed',
  
  // Analytics
  USER_ACTION: 'analytics:user-action',
  PAGE_VIEW: 'analytics:page-view',
  FEATURE_USED: 'analytics:feature-used',
} as const;

// Type-safe event emitters
export const emitEvent = {
  preferencesChanged: (preferences: any) => eventBus.emit(InfrastructureEvents.PREFERENCES_CHANGED, preferences),
  performanceMetricsUpdated: (metrics: any) => eventBus.emit(InfrastructureEvents.PERFORMANCE_METRICS_UPDATED, metrics),
  errorOccurred: (error: any) => eventBus.emit(InfrastructureEvents.ERROR_OCCURRED, error),
  configChanged: (config: any) => eventBus.emit(InfrastructureEvents.CONFIG_CHANGED, config),
  onlineStatusChanged: (isOnline: boolean) => eventBus.emit(InfrastructureEvents.ONLINE_STATUS_CHANGED, isOnline),
  userAction: (action: any) => eventBus.emit(InfrastructureEvents.USER_ACTION, action),
};