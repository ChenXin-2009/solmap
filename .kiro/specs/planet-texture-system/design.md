# Design Document: Planet Texture System

## Overview

本设计为太阳系可视化系统实现行星表面贴图（Base Color / Albedo）功能。系统采用严格的渲染层隔离架构，确保贴图资源完全不影响物理层计算。

核心设计原则：
- **渲染层单例服务**：TextureManager 作为 Render Layer 的私有单例服务
- **消费者模式**：渲染层只消费 Physical Layer 提供的 BodyId，不创造新的标识符
- **异步非阻塞**：贴图加载完全异步，不阻塞物理计算或渲染循环
- **引用计数缓存**：GPU 资源由 TextureManager 统一管理，基于引用计数释放

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Render Layer                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   TextureManager                         │    │
│  │  (Singleton Service - Render Layer Private)              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │   Config    │  │   Cache     │  │  RefCount   │      │    │
│  │  │  (BodyId →  │  │ (path →    │  │  (path →    │      │    │
│  │  │   path)     │  │  Texture)   │  │   count)    │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Planet (Renderer)                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │   Mesh      │  │  Material   │  │  Texture    │      │    │
│  │  │ (Geometry)  │  │ (Standard)  │  │  (map ref)  │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ BodyId (read-only)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Physical Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │  Space-Time     │  │  StateVector    │                       │
│  │  Core           │  │  (bodyId, pos,  │                       │
│  │                 │  │   vel, ...)     │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                  │
│  ⛔ NO IMPORTS FROM TextureManager                               │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. TextureManager (Singleton Service)

```typescript
/**
 * TextureManager - Render Layer Private Singleton
 * 
 * CRITICAL: This class MUST NOT be imported by any Physical Layer module.
 * It is a Render Layer internal service only.
 */
interface TextureManager {
  /**
   * Get texture for a celestial body
   * @param bodyId - Must originate from Physical Layer (StateVector/BodyHierarchy)
   * @returns Promise resolving to THREE.Texture or null (fallback to solid color)
   */
  getTexture(bodyId: string): Promise<THREE.Texture | null>;
  
  /**
   * Check if texture is already loaded (sync check)
   * @param bodyId - Body identifier from Physical Layer
   */
  hasTexture(bodyId: string): boolean;
  
  /**
   * Get cached texture synchronously (returns null if not loaded)
   * @param bodyId - Body identifier from Physical Layer
   */
  getCachedTexture(bodyId: string): THREE.Texture | null;
  
  /**
   * Release reference to texture (for Planet dispose)
   * Actual GPU disposal happens when refCount reaches 0
   * @param bodyId - Body identifier
   */
  releaseTexture(bodyId: string): void;
  
  /**
   * Dispose all textures and cleanup (for app shutdown)
   */
  disposeAll(): void;
}
```

### 2. Texture Configuration (visualConfig.ts)

```typescript
/**
 * Planet Texture Configuration
 * 
 * Maps BodyId to texture asset paths.
 * BodyId MUST match Physical Layer definitions (lowercase, normalized).
 */
export interface PlanetTextureConfig {
  /** Base color / albedo map path (equirectangular projection) */
  baseColor?: string;
  
  /** Reserved for future: normal map */
  normalMap?: string;
  
  /** Reserved for future: cloud layer */
  cloudMap?: string;
  
  /** Reserved for future: night lights */
  nightMap?: string;
}

export const PLANET_TEXTURE_CONFIG: Record<string, PlanetTextureConfig> = {
  // Sun: NO texture in Phase 1 (emissive-only)
  // sun: undefined,
  
  mercury: {
    baseColor: '/textures/planets/mercury_2k.jpg',
  },
  venus: {
    baseColor: '/textures/planets/venus_2k.jpg',
  },
  earth: {
    baseColor: '/textures/planets/earth_2k.jpg',
  },
  mars: {
    baseColor: '/textures/planets/mars_2k.jpg',
  },
  jupiter: {
    baseColor: '/textures/planets/jupiter_2k.jpg',
  },
  saturn: {
    baseColor: '/textures/planets/saturn_2k.jpg',
  },
  uranus: {
    baseColor: '/textures/planets/uranus_2k.jpg',
  },
  neptune: {
    baseColor: '/textures/planets/neptune_2k.jpg',
  },
};

/**
 * Texture loading configuration
 */
export const TEXTURE_MANAGER_CONFIG = {
  /** Default texture resolution suffix (for memory optimization) */
  defaultResolution: '2k',
  
  /** Enable texture loading (can be disabled for testing) */
  enabled: true,
  
  /** Log texture loading events */
  debugLogging: false,
};
```

### 3. Planet Class Extension

```typescript
// Additions to existing Planet class

class Planet {
  // ... existing code ...
  
  private textureLoaded: boolean = false;
  private textureBodyId: string | null = null;
  
  /**
   * Apply texture to planet material
   * Called by external code after TextureManager loads texture
   * 
   * @param texture - THREE.Texture from TextureManager (or null for fallback)
   * @param bodyId - Body identifier for reference tracking
   */
  applyTexture(texture: THREE.Texture | null, bodyId: string): void {
    // Sun exclusion: never apply texture to Sun
    if (this.isSun) {
      return;
    }
    
    if (texture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
      this.textureLoaded = true;
      this.textureBodyId = bodyId;
    }
  }
  
  /**
   * Check if texture is applied
   */
  hasTextureApplied(): boolean {
    return this.textureLoaded;
  }
  
  /**
   * Extended dispose to release texture reference
   */
  dispose(): void {
    // Release texture reference (TextureManager handles actual disposal)
    if (this.textureBodyId) {
      // Note: TextureManager.releaseTexture called externally
      this.material.map = null;
      this.textureBodyId = null;
      this.textureLoaded = false;
    }
    
    // ... existing dispose code ...
  }
}
```

## Data Models

### TextureLoadState

```typescript
enum TextureLoadState {
  NOT_STARTED = 'not_started',
  LOADING = 'loading',
  LOADED = 'loaded',
  FAILED = 'failed',
}

interface TextureCacheEntry {
  texture: THREE.Texture | null;
  state: TextureLoadState;
  refCount: number;
  error?: Error;
}
```

### BodyId Normalization

```typescript
/**
 * Normalize BodyId for texture lookup
 * Ensures consistent lowercase format matching Physical Layer conventions
 */
function normalizeBodyId(bodyId: string): string {
  return bodyId.toLowerCase().trim();
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Texture Lookup Consistency

*For any* valid BodyId from Physical Layer, the TextureManager SHALL return either a valid texture path from configuration or gracefully fall back to null (solid color).

**Validates: Requirements 1.1, 1.2**

### Property 2: Cache Identity

*For any* texture path, multiple requests to TextureManager SHALL return the same THREE.Texture instance (referential equality).

**Validates: Requirements 2.4, 5.3**

### Property 3: Error Fallback Graceful Degradation

*For any* invalid texture path or load failure, the TextureManager SHALL return null and the Planet SHALL continue rendering with solid color (no exceptions thrown).

**Validates: Requirements 2.3**

### Property 4: Physical Layer State Invariance

*For any* sequence of texture operations (load, apply, dispose), the Physical Layer state (positions, velocities, time) SHALL remain unchanged.

**Validates: Requirements 4.1, 4.3, 4.6**

### Property 5: Sun Texture Exclusion

*For any* Sun instance, the material.map property SHALL always be null, regardless of texture configuration or operations.

**Validates: Requirements 3.5**

### Property 6: Texture Rotation Synchronization

*For any* Planet with applied texture, when mesh.rotation.y changes, the texture orientation SHALL change correspondingly (texture is bound to mesh).

**Validates: Requirements 3.4**

### Property 7: Reference Count Disposal Safety

*For any* texture with refCount > 0, the GPU texture SHALL NOT be disposed. Disposal only occurs when refCount reaches 0.

**Validates: Requirements 5.4**

## Error Handling

### Texture Load Failure

```typescript
async function loadTexture(path: string): Promise<THREE.Texture | null> {
  try {
    const texture = await textureLoader.loadAsync(path);
    return texture;
  } catch (error) {
    console.error(`[TextureManager] Failed to load texture: ${path}`, error);
    // Return null - Planet will use solid color fallback
    return null;
  }
}
```

### Invalid BodyId

```typescript
function getTexture(bodyId: string): Promise<THREE.Texture | null> {
  const normalized = normalizeBodyId(bodyId);
  const config = PLANET_TEXTURE_CONFIG[normalized];
  
  if (!config?.baseColor) {
    // No texture configured - use solid color (not an error)
    return Promise.resolve(null);
  }
  
  return loadTexture(config.baseColor);
}
```

## Testing Strategy

### Unit Tests

1. **TextureManager Configuration Tests**
   - Verify config mapping returns correct paths
   - Verify missing BodyId returns null
   - Verify Sun has no texture config

2. **Cache Behavior Tests**
   - Verify same path returns same instance
   - Verify refCount increments/decrements correctly
   - Verify disposal only at refCount 0

3. **Planet Integration Tests**
   - Verify texture applies to material.map
   - Verify Sun rejects texture application
   - Verify dispose clears texture reference

### Property-Based Tests

Using fast-check for property-based testing:

1. **Property 1: Lookup Consistency**
   - Generate random BodyIds (valid and invalid)
   - Verify all return valid texture or null

2. **Property 4: Physical Layer Invariance**
   - Generate random texture operations
   - Verify Physical Layer state unchanged

3. **Property 5: Sun Exclusion**
   - Generate random texture operations on Sun
   - Verify material.map always null

4. **Property 7: RefCount Safety**
   - Generate random acquire/release sequences
   - Verify disposal only at refCount 0

### Test Configuration

```typescript
// jest.config.js additions
{
  testMatch: [
    '**/__tests__/texture/**/*.test.ts'
  ]
}
```

Property tests should run minimum 100 iterations per property.
