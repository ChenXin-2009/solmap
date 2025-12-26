# Design Document: Axial Tilt Physics System

## Overview

本设计文档描述了「物理正确的自转轴倾角系统」的技术架构和实现方案。

核心设计原则：
1. **向量优先** - 自转轴是向量，不是角度
2. **参考系明确** - 所有向量都有明确的参考系标注
3. **物理层权威** - 物理计算在 Physical Layer，渲染层只做映射
4. **禁止捷径** - 不允许直接设置欧拉角
5. **层间隔离** - Physical Layer 不知道 Three.js，Render Layer 不知道 ICRF

### 关键约束声明

**轨道根数的参考平面假设（CRITICAL）：**
```
Orbital elements (i, Ω) SHALL be interpreted as:
- Inclination (i): relative to the ECLIPTIC plane (黄道面)
- Longitude of ascending node (Ω): measured in the ecliptic plane, from vernal equinox (春分点)
- Reference frame: ICRF/J2000 ecliptic, Z-axis = ecliptic normal
```

**Non-Goal：** This OrbitalCalculator is NOT valid for non-ecliptic reference planes (e.g., satellite equators, planetary equators). Satellite orientation systems require a separate calculator with explicit parent body reference.

**层间依赖禁止规则：**
- Physical Layer SHALL NOT import or reference any Three.js types
- Render Layer SHALL NOT import or reference any ICRF/J2000 constants
- FrameTransformer is the ONLY module allowed to encode engine-specific axis conventions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Physical Layer (权威)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ OrbitalCalculator│    │ SpinAxisCalculator│                   │
│  │                 │    │                 │                     │
│  │ Input:          │    │ Input:          │                     │
│  │  - i (inclination)│   │  - orbitalNormal │                    │
│  │  - Ω (LOAN)     │    │  - obliquity    │                     │
│  │                 │    │  - Ω (LOAN)     │                     │
│  │ Output:         │    │                 │                     │
│  │  - orbitalNormal│───▶│ Output:         │                     │
│  │    (unit vector)│    │  - spinAxis     │                     │
│  └─────────────────┘    │    (unit vector)│                     │
│                         └────────┬────────┘                     │
│                                  │                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    CelestialBodyState                       ││
│  │  - orbitalNormal: Vector3 (ICRF/J2000)                      ││
│  │  - spinAxis: Vector3 (ICRF/J2000)                           ││
│  │  - obliquity: number (derived, readonly)                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ READ-ONLY
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frame Transformer                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ICRF/J2000 (Z-up) ──────▶ Three.js (Y-up)                   ││
│  │                                                             ││
│  │ render_x = icrf_x                                           ││
│  │ render_y = icrf_z                                           ││
│  │ render_z = -icrf_y                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ TRANSFORMED VECTORS
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Render Layer (显示)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    MeshOrientationManager                   ││
│  │                                                             ││
│  │ Input:                                                      ││
│  │  - spinAxis (in Render frame)                               ││
│  │  - modelNorthAxis (per-model config)                        ││
│  │                                                             ││
│  │ Process:                                                    ││
│  │  1. quaternion = Quaternion.setFromUnitVectors(             ││
│  │       modelNorthAxis, spinAxis)                             ││
│  │  2. mesh.quaternion.copy(quaternion)                        ││
│  │                                                             ││
│  │ Daily Rotation:                                             ││
│  │  - Rotate around spinAxis, NOT world Y                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. OrbitalCalculator

计算轨道法线向量。

```typescript
interface OrbitalElements {
  /** Inclination in radians */
  inclination: number;
  /** Longitude of Ascending Node in radians */
  longitudeOfAscendingNode: number;
}

interface OrbitalCalculator {
  /**
   * Compute orbital normal vector from orbital elements.
   * 
   * Formula:
   *   N_x = sin(i) * sin(Ω)
   *   N_y = -sin(i) * cos(Ω)
   *   N_z = cos(i)
   * 
   * @param elements - Orbital elements (i, Ω)
   * @returns Unit vector in ICRF/J2000 ecliptic frame
   */
  computeOrbitalNormal(elements: OrbitalElements): Vector3;
  
  /**
   * Get ascending node direction vector.
   * 
   * Formula:
   *   A_x = cos(Ω)
   *   A_y = sin(Ω)
   *   A_z = 0
   * 
   * @param longitudeOfAscendingNode - Ω in radians
   * @returns Unit vector in ICRF/J2000 ecliptic frame
   */
  computeAscendingNodeDirection(longitudeOfAscendingNode: number): Vector3;
}
```

### 2. SpinAxisCalculator

计算自转轴向量。

```typescript
interface SpinAxisCalculator {
  /**
   * Compute spin axis vector from obliquity and orbital normal.
   * 
   * Algorithm (Rodrigues' rotation formula):
   *   1. Start from orbital normal N
   *   2. Get ascending node direction A
   *   3. Rotate N around A by obliquity ε
   *   4. S = N*cos(ε) + (A×N)*sin(ε) + A*(A·N)*(1-cos(ε))
   * 
   * DEGENERATE CASES (CRITICAL):
   *   - If obliquity = 0: return orbitalNormal directly (no rotation needed)
   *   - If |ascendingNodeDirection × orbitalNormal| < 1e-10:
   *     choose a deterministic orthogonal axis:
   *     fallbackAxis = normalize(cross(orbitalNormal, [1,0,0]))
   *     if |fallbackAxis| < 1e-10: fallbackAxis = normalize(cross(orbitalNormal, [0,1,0]))
   * 
   * @param orbitalNormal - Orbital plane normal (unit vector)
   * @param ascendingNodeDirection - Ascending node direction (unit vector)
   * @param obliquityRadians - Obliquity in radians (0 to π)
   * @returns Spin axis unit vector in ICRF/J2000 frame
   */
  computeSpinAxis(
    orbitalNormal: Vector3,
    ascendingNodeDirection: Vector3,
    obliquityRadians: number
  ): Vector3;
  
  /**
   * Compute obliquity from spin axis and orbital normal.
   * 
   * Formula: ε = acos(clamp(S·N, -1, 1))
   * 
   * @param spinAxis - Spin axis unit vector
   * @param orbitalNormal - Orbital normal unit vector
   * @returns Obliquity in radians
   */
  computeObliquity(spinAxis: Vector3, orbitalNormal: Vector3): number;
}
```

### 3. FrameTransformer

坐标系转换器。

```typescript
interface FrameTransformer {
  /**
   * Transform vector from ICRF/J2000 (Z-up ecliptic) to Three.js (Y-up).
   * 
   * Transformation:
   *   render_x = icrf_x
   *   render_y = icrf_z
   *   render_z = -icrf_y
   */
  icrfToRender(v: Vector3): Vector3;
  
  /**
   * Transform vector from Three.js (Y-up) to ICRF/J2000 (Z-up ecliptic).
   * 
   * Inverse transformation:
   *   icrf_x = render_x
   *   icrf_y = -render_z
   *   icrf_z = render_y
   */
  renderToIcrf(v: Vector3): Vector3;
  
  /**
   * Validate that a vector is a unit vector.
   * @throws Error if magnitude differs from 1 by more than tolerance
   */
  validateUnitVector(v: Vector3, tolerance?: number): void;
}
```

### 4. MeshOrientationManager

网格朝向管理器（Render Layer）。

```typescript
interface ModelConfig {
  /** Which local axis points to physical north pole */
  northAxis: Vector3; // Default: (0, 1, 0) for +Y
}

interface MeshOrientationManager {
  /**
   * Apply spin axis orientation to mesh.
   * 
   * Process:
   *   1. Transform spinAxis from ICRF to Render frame
   *   2. Create quaternion: setFromUnitVectors(modelNorthAxis, spinAxis)
   *   3. Apply to mesh.quaternion
   * 
   * IDEMPOTENCY GUARANTEE:
   *   This operation SHALL be idempotent: applying it multiple times
   *   with the same inputs MUST result in the same mesh orientation.
   *   The mesh's previous orientation is REPLACED, not accumulated.
   * 
   * @param mesh - Three.js mesh to orient
   * @param spinAxis - Spin axis in ICRF/J2000 frame
   * @param modelConfig - Model-specific configuration
   */
  applySpinAxisOrientation(
    mesh: THREE.Mesh,
    spinAxis: Vector3,
    modelConfig: ModelConfig
  ): void;
  
  /**
   * Apply daily rotation around spin axis.
   * 
   * This rotation is COMPOSED with the base orientation, not replacing it.
   * 
   * @param mesh - Three.js mesh to rotate
   * @param spinAxis - Spin axis in Render frame
   * @param rotationAngle - Rotation angle in radians
   */
  applyDailyRotation(
    mesh: THREE.Mesh,
    spinAxis: Vector3,
    rotationAngle: number
  ): void;
}
```

### 5. CelestialBodyOrientationState

天体朝向状态（扩展现有 StateVector）。

```typescript
interface CelestialBodyOrientationState {
  /** Body identifier */
  bodyId: string;
  
  /** Orbital normal vector in ICRF/J2000 frame */
  orbitalNormal: Vector3;
  
  /** Spin axis vector in ICRF/J2000 frame */
  spinAxis: Vector3;
  
  /** Derived obliquity in radians (readonly) */
  readonly obliquity: number;
  
  /** Epoch for which these values are valid (Julian Date) */
  epoch: number;
  
  /** Precession rate in arcseconds/century (reserved for future) */
  precessionRate?: number;
}
```

## Data Models

### Celestial Body Orientation Data

每个天体的朝向数据将存储在配置中：

```typescript
// 新增到 celestialTypes.ts
interface CelestialBodyOrientationConfig {
  /** 
   * Spin axis vector in ICRF/J2000 ecliptic frame.
   * If not provided, computed from obliquity.
   */
  spinAxis?: [number, number, number];
  
  /**
   * Obliquity in degrees (legacy support).
   * Used to compute spinAxis if spinAxis not provided.
   * Range: [0, 90] for prograde, (90, 180] for retrograde.
   * 
   * NOTE: For retrograde rotators, obliquity encodes BOTH
   * geometric tilt AND rotation sense. See rotationSense for
   * explicit control.
   */
  obliquityDegrees?: number;
  
  /**
   * Rotation sense (prograde or retrograde).
   * 
   * - "prograde": rotation in same direction as orbital motion
   * - "retrograde": rotation opposite to orbital motion
   * 
   * If not specified:
   * - obliquity <= 90°: assumed prograde
   * - obliquity > 90°: assumed retrograde
   * 
   * This field allows explicit control independent of obliquity,
   * which is important for future angular velocity calculations.
   */
  rotationSense?: "prograde" | "retrograde";
  
  /**
   * Model north axis (which local axis points to north pole).
   * Default: [0, 1, 0] for +Y
   */
  modelNorthAxis?: [number, number, number];
  
  /**
   * Precession rate in arcseconds per century.
   * Reserved for future use.
   */
  precessionRate?: number;
}

// 示例数据
const EARTH_ORIENTATION: CelestialBodyOrientationConfig = {
  obliquityDegrees: 23.44,
  modelNorthAxis: [0, 1, 0],
  precessionRate: 50.29, // Earth's precession rate
};

const URANUS_ORIENTATION: CelestialBodyOrientationConfig = {
  obliquityDegrees: 97.77, // Sideways rotation
  modelNorthAxis: [0, 1, 0],
};

const VENUS_ORIENTATION: CelestialBodyOrientationConfig = {
  obliquityDegrees: 177.4, // Retrograde rotation
  modelNorthAxis: [0, 1, 0],
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Orbital Normal Unit Vector

*For any* valid orbital elements (inclination i ∈ [0, π], longitude of ascending node Ω ∈ [0, 2π]), the computed orbital normal vector SHALL have magnitude 1 ± 1e-10.

**Validates: Requirements 1.1, 1.6**

### Property 2: Orbital Normal Determinism

*For any* orbital elements and epoch, calling computeOrbitalNormal multiple times SHALL return identical vectors (bitwise equality).

**Validates: Requirements 1.5**

### Property 3: Spin Axis Round-Trip

*For any* obliquity ε ∈ [0, π] and any valid orbital normal N, computing the spin axis S from (N, ε) and then computing obliquity back from (S, N) SHALL yield the original obliquity within 1e-10 radians tolerance.

Formally: |computeObliquity(computeSpinAxis(N, A, ε), N) - ε| < 1e-10

**Validates: Requirements 2.3, 2.5, 3.6**

### Property 4: Frame Transformation Round-Trip

*For any* vector v, transforming from ICRF to Render and back SHALL yield the original vector within floating-point tolerance.

Formally: |renderToIcrf(icrfToRender(v)) - v| < 1e-10 (component-wise)

**Validates: Requirements 5.3, 5.4**

### Property 5: Frame Transformation Preserves Magnitude

*For any* vector v, the magnitude of icrfToRender(v) SHALL equal the magnitude of v within 1e-10 tolerance.

**Validates: Requirements 5.3**

### Property 6: Mesh Alignment Correctness

*For any* spin axis S (in Render frame) and model north axis M, after applying orientation, the mesh's transformed M direction SHALL be parallel to S within 1e-6 angular tolerance.

**Validates: Requirements 4.3, 4.4**

### Property 7: Daily Rotation Axis

*For any* mesh with applied spin axis orientation, daily rotation SHALL occur around the spin axis direction, not around world Y. Specifically, the rotation quaternion's axis SHALL be parallel to the spin axis.

**Validates: Requirements 4.5**

### Property 8: Orbital Translation Invariance

*For any* valid spinAxis S and orbitalNormal N, changing the body's position along its orbit SHALL NOT change S or N. The spin axis is a direction vector, not a state quantity tied to position.

**Validates: Requirements 2.2 (implicit invariant)**

### Property 9: Orientation Idempotency

*For any* mesh and spin axis, calling applySpinAxisOrientation multiple times with the same inputs SHALL result in the same final mesh orientation. The operation replaces orientation, not accumulates.

**Validates: Requirements 4.4 (implicit idempotency)**

## Error Handling

### Input Validation Errors

| Error Code | Condition | Handling |
|------------|-----------|----------|
| `INVALID_INCLINATION` | i < 0 or i > π | Throw with message |
| `INVALID_LOAN` | Ω < 0 or Ω > 2π | Normalize to [0, 2π) |
| `INVALID_OBLIQUITY` | ε < 0 or ε > π | Throw with message |
| `NON_UNIT_VECTOR` | |v| differs from 1 by > tolerance | Log warning, normalize |
| `ZERO_VECTOR` | |v| < 1e-10 | Throw with message |

### Runtime Errors

| Error Code | Condition | Handling |
|------------|-----------|----------|
| `DIRECT_ROTATION_SET` | Code attempts to set rotation.x/y/z for obliquity | Throw in dev mode, log warning in prod |
| `MISSING_SPIN_AXIS` | Body has no spin axis config | Use default (aligned with orbital normal) |

## Testing Strategy

### Unit Tests

1. **OrbitalCalculator Tests**
   - Test with known planet orbital elements
   - Verify Sun returns (0, 0, 1)
   - Verify output is always unit vector

2. **SpinAxisCalculator Tests**
   - Test with Earth (23.44°)
   - Test with Venus (177.4°, retrograde)
   - Test with Uranus (97.77°, sideways)
   - Verify output is always unit vector

3. **FrameTransformer Tests**
   - Test specific vector transformations
   - Test identity: transform then inverse
   - Test magnitude preservation

4. **MeshOrientationManager Tests**
   - Test quaternion construction
   - Test daily rotation axis

### Property-Based Tests

Using fast-check for TypeScript:

1. **Property 1**: Generate random (i, Ω), verify |N| = 1
2. **Property 2**: Generate random elements, call twice, verify equality
3. **Property 3**: Generate random (ε, N), verify round-trip
4. **Property 4**: Generate random vectors, verify transform round-trip
5. **Property 5**: Generate random vectors, verify magnitude preservation
6. **Property 6**: Generate random spin axes, verify alignment
7. **Property 7**: Generate random orientations, verify rotation axis
8. **Property 8**: Generate random positions along orbit, verify spin axis unchanged
9. **Property 9**: Apply orientation twice, verify same result

### Visual Regression Tests

1. Earth at summer solstice - north pole tilted toward Sun
2. Uranus - rotating on its side
3. Venus - retrograde rotation visible

### Integration Tests

1. Full pipeline: orbital elements → spin axis → mesh orientation
2. Time progression: verify rotation is around correct axis
3. Multiple bodies: verify each has independent orientation

