/**
 * Core Infrastructure Types and Interfaces
 * 
 * This file defines all the fundamental types and interfaces for the frontend infrastructure system.
 * These types serve as contracts between different services and ensure type safety across the system.
 */

// ============================================================================
// User Preferences and Settings
// ============================================================================

export interface UserPreferences {
  version: string;
  display: DisplaySettings;
  performance: PerformanceSettings;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  bookmarks: Bookmark[];
  recentViews: ViewState[];
  onboarding: OnboardingState;
}

export interface DisplaySettings {
  units: 'metric' | 'imperial';
  showGrid: boolean;
  showOrbits: boolean;
  qualityLevel: 'low' | 'medium' | 'high' | 'auto';
  showLabels: boolean;
  showTrajectories: boolean;
}

export interface PerformanceSettings {
  targetFPS: number;
  autoAdjustQuality: boolean;
  enableCaching: boolean;
  maxCacheSize: number; // in MB
  enableOfflineMode: boolean;
}

export interface Bookmark {
  id: string;
  name: string;
  description?: string;
  viewState: ViewState;
  createdAt: number;
  tags: string[];
}

export interface ViewState {
  target: string; // celestial body ID
  position: [number, number, number]; // camera position
  time: number; // Julian Date
  timeSpeed: number;
  viewMode: '2d' | '3d';
  zoom: number;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  skippedSteps: string[];
  userType: 'beginner' | 'advanced' | 'educator';
}

// ============================================================================
// Cache System
// ============================================================================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: CacheMetadata;
}

export interface CacheMetadata {
  created: number;
  lastAccessed: number;
  accessCount: number;
  ttl: number; // time to live in milliseconds
  size: number; // estimated size in bytes
  tags: string[];
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
}

// ============================================================================
// Search System
// ============================================================================

export type SearchableType = 'celestial-body' | 'location' | 'event' | 'time-period' | 'bookmark';

export interface SearchableItem {
  id: string;
  type: SearchableType;
  name: string;
  nameVariants: string[];
  localizedNames: Record<string, string>;
  keywords: string[];
  description: string;
  metadata: SearchMetadata;
  searchableText: string; // preprocessed for fast searching
}

export interface SearchMetadata {
  category: string;
  priority: number;
  lastUpdated: number;
  relevanceBoost?: number;
}

export interface SearchOptions {
  type?: SearchableType | SearchableType[];
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  language?: string;
  dateRange?: [number, number]; // Julian Date range
}

export interface SearchResult {
  item: SearchableItem;
  score: number;
  matchedFields: string[];
  snippet?: string;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number; // in milliseconds
  memoryUsage: number; // in MB
  renderTime: number; // in milliseconds
  deviceCapabilities: DeviceCapabilities;
  timestamp: number;
}

export interface DeviceCapabilities {
  isMobile: boolean;
  hasTouch: boolean;
  screenSize: 'small' | 'medium' | 'large';
  pixelRatio: number;
  maxTextureSize: number;
  webglVersion: number;
  hardwareConcurrency: number;
  memoryLimit: number; // estimated in MB
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameTime: number;
  maxMemoryUsage: number;
  maxRenderTime: number;
}

// ============================================================================
// Error Handling
// ============================================================================

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'storage' | 'network' | 'performance' | 'user-input' | 'system' | 'unknown';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
}

export interface UserMessage {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actions?: MessageAction[];
  duration?: number; // auto-dismiss after milliseconds
  persistent?: boolean;
}

export interface MessageAction {
  label: string;
  action: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface RecoveryAction {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
  canRetry: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  lastError?: {
    message: string;
    timestamp: number;
    category: ErrorCategory;
  };
}

// ============================================================================
// Configuration System
// ============================================================================

export interface ConfigurationSchema {
  [key: string]: ConfigurationField;
}

export interface ConfigurationField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'range';
  default: any;
  validation?: ValidationRule[];
  description?: string;
  options?: Array<{ value: any; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

export interface UserProfile {
  type: 'beginner' | 'advanced' | 'educator';
  name: string;
  description: string;
  preferences: Partial<UserPreferences>;
  customizations: Record<string, any>;
}

// ============================================================================
// Data Export/Import
// ============================================================================

export type ExportFormat = 'json' | 'csv' | 'png' | 'jpeg' | 'svg';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number; // for image exports
  resolution?: [number, number]; // for image exports
  includeMetadata?: boolean;
  compression?: boolean;
}

export interface ExportResult {
  data: string | Blob;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ImportOptions {
  validate?: boolean;
  merge?: boolean; // merge with existing data or replace
  backup?: boolean; // create backup before import
}

export interface ImportResult {
  success: boolean;
  itemsImported: number;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Offline Support
// ============================================================================

export interface OfflineCapabilities {
  isOnline: boolean;
  hasServiceWorker: boolean;
  cacheSize: number;
  lastSync: number;
  pendingSync: boolean;
}

export interface SyncStatus {
  inProgress: boolean;
  lastSync: number;
  pendingChanges: number;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  key: string;
  localValue: any;
  remoteValue: any;
  timestamp: number;
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface LocalStorageManager {
  saveUserPreferences(preferences: UserPreferences): Promise<void>;
  loadUserPreferences(): Promise<UserPreferences>;
  exportSettings(): Promise<string>;
  importSettings(data: string, options?: { backup?: boolean; merge?: boolean }): Promise<ImportResult>;
  migrateSettings(oldVersion: string, newVersion: string): Promise<void>;
  autoMigrateIfNeeded(): Promise<boolean>;
  handleQuotaExceeded(): Promise<void>;
  clearAllData(): Promise<void>;
  createBackup(name?: string): Promise<string>;
  restoreFromBackup(backupKey: string): Promise<ImportResult>;
  listBackups(): Promise<Array<{ key: string; name: string; createdAt: string }>>;
  deleteBackup(backupKey: string): Promise<boolean>;
}

export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  invalidate(pattern: string): Promise<number>;
  getStats(): Promise<CacheStats>;
  cleanup(): Promise<number>;
}

export interface SearchIndex {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  addToIndex(item: SearchableItem): Promise<void>;
  removeFromIndex(id: string): Promise<boolean>;
  updateIndex(item: SearchableItem): Promise<void>;
  buildIndex(items: SearchableItem[]): Promise<void>;
  getSuggestions(partial: string, limit?: number): Promise<string[]>;
  clearIndex(): Promise<void>;
}

export interface PerformanceMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  getMetrics(): PerformanceMetrics;
  getAverageMetrics(duration?: number): PerformanceMetrics;
  onPerformanceChange(callback: (metrics: PerformanceMetrics) => void): () => void;
  adjustQualitySettings(targetFPS: number): Promise<void>;
  detectDeviceCapabilities(): DeviceCapabilities;
}

export interface ErrorHandler {
  handleError(error: Error, context?: ErrorContext): void;
  showUserMessage(message: UserMessage): void;
  addRecoveryAction(errorType: string, action: RecoveryAction): void;
  removeRecoveryAction(errorType: string): void;
  getErrorStats(): ErrorStats;
  clearErrorStats(): void;
  setErrorReporting(enabled: boolean): void;
}

export interface ConfigurationSystem {
  getConfig<T>(key: string): T;
  setConfig<T>(key: string, value: T): Promise<void>;
  resetToDefaults(keys?: string[]): Promise<void>;
  applyPreset(presetName: string): Promise<void>;
  validateConfig(config: any, schema?: ConfigurationSchema): ValidationResult;
  getSchema(): ConfigurationSchema;
  onConfigChange<T>(key: string, callback: (value: T) => void): () => void;
}

// ============================================================================
// Service Registry
// ============================================================================

export interface ServiceRegistry {
  register<T>(name: string, service: T): void;
  get<T>(name: string): T;
  has(name: string): boolean;
  unregister(name: string): boolean;
  clear(): void;
}

// ============================================================================
// Event System
// ============================================================================

export type EventCallback<T = any> = (data: T) => void;

export interface EventBus {
  on<T>(event: string, callback: EventCallback<T>): () => void;
  off(event: string, callback: EventCallback): void;
  emit<T>(event: string, data?: T): void;
  once<T>(event: string, callback: EventCallback<T>): void;
  clear(): void;
}

// ============================================================================
// Constants
// ============================================================================

export const INFRASTRUCTURE_CONSTANTS = {
  STORAGE_KEYS: {
    USER_PREFERENCES: 'solmap_user_preferences',
    CACHE_INDEX: 'solmap_cache_index',
    ERROR_LOG: 'solmap_error_log',
    PERFORMANCE_LOG: 'solmap_performance_log',
  },
  CACHE: {
    DEFAULT_TTL: 24 * 60 * 60 * 1000, // 24 hours
    MAX_MEMORY_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_ENTRIES: 10000,
    CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  },
  PERFORMANCE: {
    TARGET_FPS: 60,
    MIN_FPS: 30,
    MAX_FRAME_TIME: 16.67, // ~60fps
    MONITORING_INTERVAL: 1000, // 1 second
  },
  SEARCH: {
    MAX_RESULTS: 50,
    MIN_QUERY_LENGTH: 2,
    SUGGESTION_LIMIT: 10,
    FUZZY_THRESHOLD: 0.6,
  },
  ERRORS: {
    MAX_ERROR_LOG_SIZE: 1000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
    RETRY_BACKOFF: 2,
  },
} as const;

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;