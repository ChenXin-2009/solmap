/**
 * Local Storage Manager Implementation
 * 
 * Manages all client-side data persistence using browser storage APIs.
 * Provides user preferences persistence, quota management, and error handling.
 */

import {
  LocalStorageManager,
  UserPreferences,
  ImportResult,
  INFRASTRUCTURE_CONSTANTS,
  ErrorContext,
} from './types';

/**
 * Default user preferences with sensible defaults
 */
const DEFAULT_USER_PREFERENCES: UserPreferences = {
  version: '1.0.0',
  display: {
    units: 'metric',
    showGrid: true,
    showOrbits: true,
    qualityLevel: 'auto',
    showLabels: true,
    showTrajectories: false,
  },
  performance: {
    targetFPS: 60,
    autoAdjustQuality: true,
    enableCaching: true,
    maxCacheSize: 100, // MB
    enableOfflineMode: true,
  },
  language: 'en',
  theme: 'auto',
  bookmarks: [],
  recentViews: [],
  onboarding: {
    completed: false,
    currentStep: 0,
    skippedSteps: [],
    userType: 'beginner',
  },
};

/**
 * Storage quota exceeded error
 */
export class StorageQuotaExceededError extends Error {
  constructor(message: string = 'Storage quota exceeded') {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

/**
 * Storage corruption error
 */
export class StorageCorruptionError extends Error {
  constructor(message: string = 'Storage data is corrupted') {
    super(message);
    this.name = 'StorageCorruptionError';
  }
}

/**
 * LocalStorageManagerImpl - Implementation of LocalStorageManager interface
 */
export class LocalStorageManagerImpl implements LocalStorageManager {
  private readonly storageKey = INFRASTRUCTURE_CONSTANTS.STORAGE_KEYS.USER_PREFERENCES;
  private errorHandler?: (error: Error, context?: ErrorContext) => void;

  constructor(errorHandler?: (error: Error, context?: ErrorContext) => void) {
    this.errorHandler = errorHandler;
  }

  /**
   * Save user preferences to localStorage with error handling
   */
  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      // Validate preferences structure
      this.validatePreferences(preferences);

      // Clean preferences to ensure JSON compatibility
      const cleanedPreferences = this.cleanPreferencesForSerialization(preferences);

      // Serialize to JSON
      const serialized = JSON.stringify(cleanedPreferences, null, 2);
      
      // Check if we have enough space
      await this.checkStorageQuota(serialized.length);

      // Save to localStorage
      localStorage.setItem(this.storageKey, serialized);

    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const quotaError = new StorageQuotaExceededError('Failed to save preferences: storage quota exceeded');
        this.handleError(quotaError, { action: 'saveUserPreferences' });
        await this.handleQuotaExceeded();
        throw quotaError;
      }
      
      this.handleError(error as Error, { action: 'saveUserPreferences' });
      throw error;
    }
  }

  /**
   * Load user preferences from localStorage with fallback to defaults
   */
  async loadUserPreferences(): Promise<UserPreferences> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      
      if (!stored) {
        // No stored preferences, return defaults
        return { ...DEFAULT_USER_PREFERENCES };
      }

      // Parse JSON
      const parsed = JSON.parse(stored);
      
      // Restore special values
      const restored = this.restoreSpecialValues(parsed);
      
      // Validate structure
      this.validatePreferences(restored);

      // Merge with defaults to ensure all fields are present
      return this.mergeWithDefaults(restored);

    } catch (error) {
      if (error instanceof SyntaxError) {
        const corruptionError = new StorageCorruptionError('Failed to parse stored preferences');
        this.handleError(corruptionError, { action: 'loadUserPreferences' });
        
        // Clear corrupted data and return defaults
        localStorage.removeItem(this.storageKey);
        return { ...DEFAULT_USER_PREFERENCES };
      }

      this.handleError(error as Error, { action: 'loadUserPreferences' });
      
      // Return defaults on any error
      return { ...DEFAULT_USER_PREFERENCES };
    }
  }

  /**
   * Export settings as JSON string with metadata and validation
   */
  async exportSettings(): Promise<string> {
    try {
      const preferences = await this.loadUserPreferences();
      
      const exportData = {
        version: preferences.version,
        exportedAt: new Date().toISOString(),
        exportedBy: 'Solmap Frontend Infrastructure',
        checksum: this.calculateChecksum(preferences),
        data: preferences,
      };

      // Validate export data before returning
      const exportString = JSON.stringify(exportData, null, 2);
      
      // Verify the export can be parsed back
      JSON.parse(exportString);

      return exportString;

    } catch (error) {
      this.handleError(error as Error, { action: 'exportSettings' });
      throw error;
    }
  }

  /**
   * Import settings from JSON string with comprehensive validation and backup
   */
  async importSettings(data: string, options: { backup?: boolean; merge?: boolean } = {}): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      itemsImported: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Create backup if requested
      if (options.backup !== false) {
        try {
          const backupData = await this.exportSettings();
          const backupKey = `${this.storageKey}_backup_${Date.now()}`;
          localStorage.setItem(backupKey, backupData);
          result.warnings.push(`Backup created at key: ${backupKey}`);
        } catch (backupError) {
          result.warnings.push('Failed to create backup before import');
        }
      }

      // Parse JSON
      let importData;
      try {
        importData = JSON.parse(data);
      } catch (parseError) {
        result.errors.push('Invalid JSON format');
        return result;
      }
      
      // Validate import format
      if (!importData.data || typeof importData.data !== 'object') {
        result.errors.push('Invalid import format: missing data field');
        return result;
      }

      // Verify checksum if present
      if (importData.checksum) {
        const calculatedChecksum = this.calculateChecksum(importData.data);
        if (calculatedChecksum !== importData.checksum) {
          result.warnings.push('Checksum mismatch: data may be corrupted');
        }
      }

      // Validate preferences structure
      try {
        this.validatePreferences(importData.data);
      } catch (error) {
        result.errors.push(`Invalid preferences structure: ${(error as Error).message}`);
        return result;
      }

      // Check version compatibility
      if (importData.version && importData.version !== DEFAULT_USER_PREFERENCES.version) {
        result.warnings.push(`Version mismatch: importing ${importData.version}, current is ${DEFAULT_USER_PREFERENCES.version}`);
        
        // Auto-migrate if needed
        try {
          const migrated = this.applyMigrations(importData.data, importData.version, DEFAULT_USER_PREFERENCES.version);
          importData.data = migrated;
          result.warnings.push('Settings automatically migrated to current version');
        } catch (migrationError) {
          result.warnings.push('Failed to auto-migrate settings');
        }
      }

      let finalPreferences = importData.data;

      // Handle merge option
      if (options.merge) {
        const currentPreferences = await this.loadUserPreferences();
        finalPreferences = this.mergePreferences(currentPreferences, importData.data);
        result.warnings.push('Settings merged with existing preferences');
      }

      // Save imported preferences
      await this.saveUserPreferences(finalPreferences);
      
      result.success = true;
      result.itemsImported = 1;

    } catch (error) {
      result.errors.push(`Import failed: ${(error as Error).message}`);
      this.handleError(error as Error, { action: 'importSettings' });
    }

    return result;
  }

  /**
   * Create a backup of current settings
   */
  async createBackup(name?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = name || `backup-${timestamp}`;
      const backupKey = `${this.storageKey}_backup_${backupName}`;
      
      const exportData = await this.exportSettings();
      localStorage.setItem(backupKey, exportData);
      
      return backupKey;
    } catch (error) {
      this.handleError(error as Error, { action: 'createBackup' });
      throw error;
    }
  }

  /**
   * Restore settings from a backup
   */
  async restoreFromBackup(backupKey: string): Promise<ImportResult> {
    try {
      const backupData = localStorage.getItem(backupKey);
      
      if (!backupData) {
        return {
          success: false,
          itemsImported: 0,
          errors: ['Backup not found'],
          warnings: [],
        };
      }

      return await this.importSettings(backupData, { backup: false });
    } catch (error) {
      this.handleError(error as Error, { action: 'restoreFromBackup' });
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ key: string; name: string; createdAt: string }>> {
    try {
      const backups: Array<{ key: string; name: string; createdAt: string }> = [];
      const backupPrefix = `${this.storageKey}_backup_`;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(backupPrefix)) {
          try {
            const backupData = localStorage.getItem(key);
            if (backupData) {
              const parsed = JSON.parse(backupData);
              backups.push({
                key,
                name: key.replace(backupPrefix, ''),
                createdAt: parsed.exportedAt || 'Unknown',
              });
            }
          } catch (error) {
            // Skip corrupted backups
            continue;
          }
        }
      }
      
      return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      this.handleError(error as Error, { action: 'listBackups' });
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupKey: string): Promise<boolean> {
    try {
      if (localStorage.getItem(backupKey)) {
        localStorage.removeItem(backupKey);
        return true;
      }
      return false;
    } catch (error) {
      this.handleError(error as Error, { action: 'deleteBackup' });
      return false;
    }
  }

  /**
   * Migrate settings from old version to new version
   * Automatically detects current version and applies necessary migrations
   */
  async migrateSettings(oldVersion: string, newVersion: string): Promise<void> {
    try {
      const preferences = await this.loadUserPreferences();
      
      // If no migration needed, just update version
      if (this.compareVersions(oldVersion, newVersion) >= 0) {
        preferences.version = newVersion;
        await this.saveUserPreferences(preferences);
        return;
      }
      
      // Apply version-specific migrations
      const migratedPreferences = this.applyMigrations(preferences, oldVersion, newVersion);
      
      // Update version to new version
      migratedPreferences.version = newVersion;
      
      // Save migrated preferences
      await this.saveUserPreferences(migratedPreferences);

    } catch (error) {
      this.handleError(error as Error, { 
        action: 'migrateSettings',
        additionalData: { oldVersion, newVersion }
      });
      throw error;
    }
  }

  /**
   * Auto-migrate settings if version mismatch is detected
   */
  async autoMigrateIfNeeded(): Promise<boolean> {
    try {
      const preferences = await this.loadUserPreferences();
      const currentVersion = preferences.version;
      const targetVersion = DEFAULT_USER_PREFERENCES.version;

      if (this.compareVersions(currentVersion, targetVersion) < 0) {
        await this.migrateSettings(currentVersion, targetVersion);
        return true;
      }

      return false;
    } catch (error) {
      this.handleError(error as Error, { action: 'autoMigrateIfNeeded' });
      return false;
    }
  }

  /**
   * Handle storage quota exceeded by cleaning up old data
   */
  async handleQuotaExceeded(): Promise<void> {
    try {
      // Clear non-essential data first
      const keysToCheck = [
        INFRASTRUCTURE_CONSTANTS.STORAGE_KEYS.ERROR_LOG,
        INFRASTRUCTURE_CONSTANTS.STORAGE_KEYS.PERFORMANCE_LOG,
        INFRASTRUCTURE_CONSTANTS.STORAGE_KEYS.CACHE_INDEX,
      ];

      let freedSpace = false;

      for (const key of keysToCheck) {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          freedSpace = true;
        }
      }

      if (!freedSpace) {
        // If no non-essential data to clear, we might need to clear user data
        // This should be a last resort and should prompt the user
        throw new StorageQuotaExceededError('Unable to free storage space');
      }

    } catch (error) {
      this.handleError(error as Error, { action: 'handleQuotaExceeded' });
      throw error;
    }
  }

  /**
   * Clear all stored data
   */
  async clearAllData(): Promise<void> {
    try {
      const keys = Object.values(INFRASTRUCTURE_CONSTANTS.STORAGE_KEYS);
      
      for (const key of keys) {
        localStorage.removeItem(key);
      }

    } catch (error) {
      this.handleError(error as Error, { action: 'clearAllData' });
      throw error;
    }
  }

  /**
   * Validate preferences structure
   */
  private validatePreferences(preferences: any): void {
    if (!preferences || typeof preferences !== 'object') {
      throw new Error('Preferences must be an object');
    }

    // Check required fields
    const requiredFields = ['version', 'display', 'performance', 'language', 'theme'];
    for (const field of requiredFields) {
      if (!(field in preferences)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate display settings
    if (!preferences.display || typeof preferences.display !== 'object') {
      throw new Error('Display settings must be an object');
    }

    // Validate performance settings
    if (!preferences.performance || typeof preferences.performance !== 'object') {
      throw new Error('Performance settings must be an object');
    }

    // Validate arrays
    if (preferences.bookmarks && !Array.isArray(preferences.bookmarks)) {
      throw new Error('Bookmarks must be an array');
    }

    if (preferences.recentViews && !Array.isArray(preferences.recentViews)) {
      throw new Error('Recent views must be an array');
    }
  }

  /**
   * Merge loaded preferences with defaults to ensure all fields are present
   */
  private mergeWithDefaults(loaded: Partial<UserPreferences>): UserPreferences {
    return {
      ...DEFAULT_USER_PREFERENCES,
      ...loaded,
      display: {
        ...DEFAULT_USER_PREFERENCES.display,
        ...loaded.display,
      },
      performance: {
        ...DEFAULT_USER_PREFERENCES.performance,
        ...loaded.performance,
      },
      onboarding: {
        ...DEFAULT_USER_PREFERENCES.onboarding,
        ...loaded.onboarding,
      },
    };
  }

  /**
   * Apply version-specific migrations
   */
  private applyMigrations(preferences: UserPreferences, oldVersion: string, newVersion: string): UserPreferences {
    let migrated = { ...preferences };

    // Migration from 1.0.0 to 1.1.0 (example)
    if (this.shouldMigrate(oldVersion, '1.0.0', newVersion, '1.1.0')) {
      migrated = this.migrateFrom1_0_0To1_1_0(migrated);
    }

    // Migration from 1.1.0 to 1.2.0 (example)
    if (this.shouldMigrate(oldVersion, '1.1.0', newVersion, '1.2.0')) {
      migrated = this.migrateFrom1_1_0To1_2_0(migrated);
    }

    // Add more migrations as needed
    
    return migrated;
  }

  /**
   * Check if migration should be applied
   */
  private shouldMigrate(currentVersion: string, fromVersion: string, targetVersion: string, toVersion: string): boolean {
    return this.compareVersions(currentVersion, fromVersion) >= 0 && 
           this.compareVersions(targetVersion, toVersion) >= 0;
  }

  /**
   * Compare version strings (returns -1, 0, or 1)
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * Migration from version 1.0.0 to 1.1.0
   * Example: Add new display settings
   */
  private migrateFrom1_0_0To1_1_0(preferences: UserPreferences): UserPreferences {
    const migrated = { ...preferences };
    
    // Add new display settings if they don't exist
    if (!migrated.display.showLabels) {
      migrated.display.showLabels = true;
    }
    
    if (!migrated.display.showTrajectories) {
      migrated.display.showTrajectories = false;
    }
    
    // Migrate old theme values if needed
    if ((migrated.theme as any) === 'system') {
      migrated.theme = 'auto';
    }
    
    return migrated;
  }

  /**
   * Migration from version 1.1.0 to 1.2.0
   * Example: Add new performance settings
   */
  private migrateFrom1_1_0To1_2_0(preferences: UserPreferences): UserPreferences {
    const migrated = { ...preferences };
    
    // Add new performance settings if they don't exist
    if (!migrated.performance.enableOfflineMode) {
      migrated.performance.enableOfflineMode = true;
    }
    
    // Migrate old quality level values
    if ((migrated.display.qualityLevel as any) === 'adaptive') {
      migrated.display.qualityLevel = 'auto';
    }
    
    return migrated;
  }

  /**
   * Clean preferences to ensure JSON compatibility
   */
  private cleanPreferencesForSerialization(preferences: UserPreferences): UserPreferences {
    return JSON.parse(JSON.stringify(preferences, (key, value) => {
      // Handle undefined values
      if (value === undefined) {
        return null;
      }
      
      // Handle special float values
      if (typeof value === 'number') {
        if (!isFinite(value)) {
          if (value === Infinity) return 'Infinity';
          if (value === -Infinity) return '-Infinity';
          if (isNaN(value)) return 'NaN';
        }
      }
      
      return value;
    }));
  }

  /**
   * Restore special values after JSON deserialization
   */
  private restoreSpecialValues(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      // Handle special string representations
      if (obj === 'Infinity') return Infinity;
      if (obj === '-Infinity') return -Infinity;
      if (obj === 'NaN') return NaN;
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.restoreSpecialValues(item));
    }

    const restored: any = {};
    for (const [key, value] of Object.entries(obj)) {
      restored[key] = this.restoreSpecialValues(value);
    }
    return restored;
  }

  /**
   * Calculate a simple checksum for data integrity verification
   */
  private calculateChecksum(data: any): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  /**
   * Merge imported preferences with existing preferences
   */
  private mergePreferences(current: UserPreferences, imported: UserPreferences): UserPreferences {
    return {
      ...current,
      ...imported,
      display: {
        ...current.display,
        ...imported.display,
      },
      performance: {
        ...current.performance,
        ...imported.performance,
      },
      onboarding: {
        ...current.onboarding,
        ...imported.onboarding,
      },
      bookmarks: [
        ...current.bookmarks,
        ...imported.bookmarks.filter(
          importedBookmark => !current.bookmarks.some(
            currentBookmark => currentBookmark.id === importedBookmark.id
          )
        ),
      ],
      recentViews: [
        ...imported.recentViews,
        ...current.recentViews.filter(
          currentView => !imported.recentViews.some(
            importedView => importedView.target === currentView.target && 
                           importedView.time === currentView.time
          )
        ),
      ].slice(0, 50), // Limit to 50 recent views
    };
  }
  private async checkStorageQuota(dataSize: number): Promise<void> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const available = (estimate.quota || 0) - (estimate.usage || 0);
        
        if (dataSize > available) {
          throw new StorageQuotaExceededError(`Not enough storage space: need ${dataSize} bytes, have ${available} bytes`);
        }
      } catch (error) {
        // If quota estimation fails, continue anyway
        console.warn('Failed to estimate storage quota:', error);
      }
    }
  }

  /**
   * Handle errors with optional error handler
   */
  private handleError(error: Error, context?: ErrorContext): void {
    if (this.errorHandler) {
      this.errorHandler(error, {
        component: 'LocalStorageManager',
        ...context,
      });
    }
  }
}

/**
 * Create a new LocalStorageManager instance
 */
export function createLocalStorageManager(
  errorHandler?: (error: Error, context?: ErrorContext) => void
): LocalStorageManager {
  return new LocalStorageManagerImpl(errorHandler);
}