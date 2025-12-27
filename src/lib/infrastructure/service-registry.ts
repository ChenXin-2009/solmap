/**
 * Service Registry Implementation
 * 
 * Provides dependency injection and service management for the infrastructure system.
 * This allows services to be registered once and accessed throughout the application.
 */

import type { ServiceRegistry } from './types';

class ServiceRegistryImpl implements ServiceRegistry {
  private services = new Map<string, any>();
  private singletons = new Set<string>();

  /**
   * Register a service instance
   */
  register<T>(name: string, service: T, singleton: boolean = true): void {
    if (this.services.has(name)) {
      console.warn(`Service '${name}' is already registered. Overwriting.`);
    }

    this.services.set(name, service);
    
    if (singleton) {
      this.singletons.add(name);
    }
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }

    return service as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Unregister a service
   */
  unregister(name: string): boolean {
    const removed = this.services.delete(name);
    this.singletons.delete(name);
    return removed;
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Check if a service is registered as singleton
   */
  isSingleton(name: string): boolean {
    return this.singletons.has(name);
  }
}

// Global service registry instance
export const serviceRegistry = new ServiceRegistryImpl();

// Service registration helpers
export const Services = {
  // Core services
  STORAGE_MANAGER: 'storageManager',
  CACHE_MANAGER: 'cacheManager',
  SEARCH_INDEX: 'searchIndex',
  PERFORMANCE_MONITOR: 'performanceMonitor',
  ERROR_HANDLER: 'errorHandler',
  CONFIGURATION_SYSTEM: 'configurationSystem',
  
  // Additional services
  EVENT_BUS: 'eventBus',
  EXPORT_SERVICE: 'exportService',
  OFFLINE_MANAGER: 'offlineManager',
  ANALYTICS_SERVICE: 'analyticsService',
} as const;

// Type-safe service getters
export const getService = {
  storageManager: () => serviceRegistry.get<import('./types').LocalStorageManager>(Services.STORAGE_MANAGER),
  cacheManager: () => serviceRegistry.get<import('./types').CacheManager>(Services.CACHE_MANAGER),
  searchIndex: () => serviceRegistry.get<import('./types').SearchIndex>(Services.SEARCH_INDEX),
  performanceMonitor: () => serviceRegistry.get<import('./types').PerformanceMonitor>(Services.PERFORMANCE_MONITOR),
  errorHandler: () => serviceRegistry.get<import('./types').ErrorHandler>(Services.ERROR_HANDLER),
  configurationSystem: () => serviceRegistry.get<import('./types').ConfigurationSystem>(Services.CONFIGURATION_SYSTEM),
  eventBus: () => serviceRegistry.get<import('./types').EventBus>(Services.EVENT_BUS),
};

// Service registration decorator
export function registerService(name: string, singleton: boolean = true) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        serviceRegistry.register(name, this, singleton);
      }
    };
  };
}

// Service initialization helper
export async function initializeServices(): Promise<void> {
  console.log('Initializing infrastructure services...');
  
  // Services will be registered as they are imported and instantiated
  // This function can be used to perform any global initialization
  
  console.log('Infrastructure services initialized');
}