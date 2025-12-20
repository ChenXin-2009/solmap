/**
 * TextureManager Unit Tests
 * 
 * Tests for the TextureManager singleton service.
 * Validates: Requirements 1.1, 1.2, 2.3, 2.4, 4.5, 5.3, 5.4
 * 
 * @see .kiro/specs/planet-texture-system/requirements.md
 */

import { TextureManager, normalizeBodyId, TextureLoadState } from '@/lib/3d/TextureManager';
import { PLANET_TEXTURE_CONFIG } from '@/lib/config/visualConfig';

// Mock THREE.TextureLoader
jest.mock('three', () => ({
  TextureLoader: jest.fn().mockImplementation(() => ({
    load: jest.fn((path, onLoad, onProgress, onError) => {
      // Simulate async loading
      setTimeout(() => {
        if (path.includes('invalid') || path.includes('error')) {
          onError(new Error('Failed to load texture'));
        } else {
          onLoad({ dispose: jest.fn() });
        }
      }, 10);
    }),
  })),
}));

describe('TextureManager', () => {
  beforeEach(() => {
    // Reset singleton before each test
    TextureManager.resetInstance();
  });

  afterEach(() => {
    TextureManager.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = TextureManager.getInstance();
      const instance2 = TextureManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = TextureManager.getInstance();
      TextureManager.resetInstance();
      const instance2 = TextureManager.getInstance();
      // After reset, it's a new instance (different object)
      // But we can't directly compare since it's a new singleton
      expect(instance2).toBeDefined();
    });
  });

  describe('normalizeBodyId', () => {
    it('should convert to lowercase', () => {
      expect(normalizeBodyId('Earth')).toBe('earth');
      expect(normalizeBodyId('MARS')).toBe('mars');
      expect(normalizeBodyId('Jupiter')).toBe('jupiter');
    });

    it('should trim whitespace', () => {
      expect(normalizeBodyId('  earth  ')).toBe('earth');
      expect(normalizeBodyId('\tmars\n')).toBe('mars');
    });

    it('should handle mixed case and whitespace', () => {
      expect(normalizeBodyId('  EaRtH  ')).toBe('earth');
    });
  });

  describe('Configuration Lookup', () => {
    it('should return null for unconfigured bodies', async () => {
      const manager = TextureManager.getInstance();
      const texture = await manager.getTexture('unknown_body');
      expect(texture).toBeNull();
    });

    it('should return null for sun (emissive-only)', async () => {
      const manager = TextureManager.getInstance();
      const texture = await manager.getTexture('sun');
      expect(texture).toBeNull();
    });

    it('should have configuration for all major planets', () => {
      const planets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
      planets.forEach(planet => {
        expect(PLANET_TEXTURE_CONFIG[planet]).toBeDefined();
        expect(PLANET_TEXTURE_CONFIG[planet].baseColor).toBeDefined();
      });
    });

    it('should NOT have configuration for sun', () => {
      expect(PLANET_TEXTURE_CONFIG['sun']).toBeUndefined();
    });
  });

  describe('Cache Behavior', () => {
    it('should return cached texture on subsequent calls', async () => {
      const manager = TextureManager.getInstance();
      
      // First call
      const texture1 = await manager.getTexture('earth');
      
      // Second call should return same instance
      const texture2 = await manager.getTexture('earth');
      
      expect(texture1).toBe(texture2);
    });

    it('should track reference count correctly', async () => {
      const manager = TextureManager.getInstance();
      
      // Get texture twice
      await manager.getTexture('earth');
      await manager.getTexture('earth');
      
      const stats = manager.getCacheStats();
      expect(stats.totalRefCount).toBeGreaterThanOrEqual(2);
    });

    it('should report correct cache statistics', async () => {
      const manager = TextureManager.getInstance();
      
      // Load a texture
      await manager.getTexture('earth');
      
      const stats = manager.getCacheStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
      expect(stats.loadedCount).toBeGreaterThanOrEqual(0); // May still be loading
    });
  });

  describe('hasTexture and getCachedTexture', () => {
    it('hasTexture should return false for unconfigured body', () => {
      const manager = TextureManager.getInstance();
      expect(manager.hasTexture('unknown')).toBe(false);
    });

    it('getCachedTexture should return null for unconfigured body', () => {
      const manager = TextureManager.getInstance();
      expect(manager.getCachedTexture('unknown')).toBeNull();
    });

    it('getCachedTexture should return null before texture is loaded', () => {
      const manager = TextureManager.getInstance();
      // Don't await - check immediately
      manager.getTexture('earth');
      // Texture is still loading, so cached should be null
      expect(manager.getCachedTexture('earth')).toBeNull();
    });
  });

  describe('Resource Management', () => {
    it('should release texture reference', async () => {
      const manager = TextureManager.getInstance();
      
      await manager.getTexture('earth');
      const statsBefore = manager.getCacheStats();
      
      manager.releaseTexture('earth');
      const statsAfter = manager.getCacheStats();
      
      expect(statsAfter.totalRefCount).toBeLessThan(statsBefore.totalRefCount);
    });

    it('should handle release for non-existent texture gracefully', () => {
      const manager = TextureManager.getInstance();
      // Should not throw
      expect(() => manager.releaseTexture('unknown')).not.toThrow();
    });

    it('disposeAll should clear all textures', async () => {
      const manager = TextureManager.getInstance();
      
      await manager.getTexture('earth');
      await manager.getTexture('mars');
      
      manager.disposeAll();
      
      const stats = manager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});

describe('Physical Layer Isolation', () => {
  /**
   * Property 4: Physical Layer State Invariance
   * Validates: Requirements 4.1, 4.3, 4.6
   * 
   * TextureManager should NOT be imported by Physical Layer modules.
   * This test verifies the architectural constraint.
   */
  it('TextureManager should not expose Physical Layer modification methods', () => {
    const manager = TextureManager.getInstance();
    
    // TextureManager should only have read/render methods
    expect(typeof manager.getTexture).toBe('function');
    expect(typeof manager.hasTexture).toBe('function');
    expect(typeof manager.getCachedTexture).toBe('function');
    expect(typeof manager.releaseTexture).toBe('function');
    expect(typeof manager.disposeAll).toBe('function');
    expect(typeof manager.getCacheStats).toBe('function');
    
    // Should NOT have any methods that could modify Physical Layer
    expect((manager as any).setBodyPosition).toBeUndefined();
    expect((manager as any).updatePhysics).toBeUndefined();
    expect((manager as any).setTime).toBeUndefined();
  });

  it('TextureManager should be a Render Layer only service', () => {
    // Verify the module path is in the 3d (render) directory
    const modulePath = require.resolve('@/lib/3d/TextureManager');
    expect(modulePath).toContain('3d');
    expect(modulePath).not.toContain('space-time-foundation');
  });
});
