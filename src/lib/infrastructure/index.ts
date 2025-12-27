/**
 * Frontend Infrastructure - Main Export
 * 
 * This file provides the main entry point for the frontend infrastructure system.
 * It exports all the core types, services, and utilities needed by the application.
 */

// Core types and interfaces
export * from './types';

// Service registry and dependency injection
export * from './service-registry';

// Event system
export * from './event-bus';

// Re-export commonly used types for convenience
export type {
  UserPreferences,
  DisplaySettings,
  PerformanceSettings,
  CacheEntry,
  SearchableItem,
  SearchResult,
  PerformanceMetrics,
  ErrorContext,
  UserMessage,
} from './types';

// Re-export service interfaces
export type {
  LocalStorageManager,
  CacheManager,
  SearchIndex,
  PerformanceMonitor,
  ErrorHandler,
  ConfigurationSystem,
} from './types';

// Constants for easy access
export { INFRASTRUCTURE_CONSTANTS } from './types';

// Service names for registration
export { Services } from './service-registry';

// Common event names
export { InfrastructureEvents } from './event-bus';