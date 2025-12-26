# Requirements Document

## Introduction

本文档定义了「物理正确的自转轴倾角系统」的需求。

当前系统的根本问题是：自转轴倾角被当作"模型旋转角度"而非"定义在轨道参考系中的物理量"。这导致 AI 在错误的空间里做数值微调，永远无法得到正确结果。

本系统的核心认知转变是：
> **倾角不是旋转量，而是一个几何关系。**

自转轴倾角 = 行星自转轴向量 与 轨道平面法线向量 之间的夹角。

### 战略级声明

**轨道参考系的层级定义：**
- The Orbital_Reference_Frame is defined hierarchically
- For planets: the reference orbital plane is the ecliptic (黄道面)
- For moons: the reference orbital plane SHALL be the parent planet's equatorial plane unless explicitly specified otherwise
- For artificial satellites: the reference frame SHALL be explicitly declared per mission

## Glossary

- **Orbital_Reference_Frame**: 轨道参考系。Z 轴为轨道平面法线（角动量方向），X 轴指向升交点，Y 轴由右手系补全。所有"倾角"都相对于这个 Z 轴定义。
- **Body_Reference_Frame**: 行星本体参考系。Z 轴为自转轴方向，X/Y 轴在赤道平面内。
- **Render_Reference_Frame**: 渲染参考系。Three.js / Canvas 使用的坐标系，只是最终映射目标。
- **Orbital_Normal_Vector**: 轨道法线向量。轨道平面的法向量，指向轨道角动量方向。**权威定义来源：轨道根数 (i, Ω)**。
- **Spin_Axis_Vector**: 自转轴向量。行星自转轴的方向向量，指向北极。
- **Obliquity**: 自转轴倾角。自转轴向量与轨道法线向量之间的夹角（度或弧度）。
- **Ascending_Node_Direction**: 升交点方向。轨道平面与参考平面（黄道面）的交线方向，指向升交点。
- **Axial_Precession**: 轴进动（岁差）。自转轴方向随时间的缓慢变化。Phase 1 不实现，但接口需预留。
- **Vector_Alignment**: 向量对齐。通过四元数或旋转矩阵将一个向量对齐到另一个向量的操作。
- **Physical_Layer**: 物理层。负责计算物理正确的向量和状态，不涉及渲染。
- **Render_Layer**: 渲染层。负责将物理层的向量映射到 Three.js 坐标系并应用到 mesh。
- **Model_North_Axis**: 模型北极轴。每个模型的配置项，定义哪个本地轴指向物理北极。默认为 +Y，但可按模型覆盖。

## Requirements

### Requirement 1: 轨道法线向量计算

**User Story:** As a developer, I want each celestial body to have a computed orbital normal vector, so that I can define axial tilt relative to the correct reference frame.

#### Acceptance Criteria

1. THE Orbital_Calculator SHALL compute the Orbital_Normal_Vector for each celestial body from its orbital elements (inclination i, longitude of ascending node Ω)
2. **Orbital_Normal_Vector SHALL be computed from orbital elements (i, Ω) as the authoritative definition. Position–velocity cross product MAY be used only for validation, not as a primary source.**
3. THE formula SHALL be:
   - N_x = sin(i) * sin(Ω)
   - N_y = -sin(i) * cos(Ω)  
   - N_z = cos(i)
   - Where i = inclination, Ω = longitude of ascending node, in the ecliptic J2000 frame
4. FOR the Sun, THE Orbital_Calculator SHALL return the ecliptic normal vector (0, 0, 1)
5. THE Orbital_Normal_Vector SHALL be immutable once computed for a given epoch
6. THE Orbital_Normal_Vector SHALL be a unit vector (magnitude = 1 ± 1e-10)

### Requirement 2: 自转轴向量定义

**User Story:** As a developer, I want each celestial body to have an explicit spin axis vector, so that rotation is physically correct.

#### Acceptance Criteria

1. THE Celestial_Body_Config SHALL include a Spin_Axis_Vector property defined as a 3D unit vector
2. THE Spin_Axis_Vector SHALL be defined in the ICRF/J2000 ecliptic frame (same as Orbital_Normal_Vector)
3. **WHEN computing Spin_Axis_Vector from obliquity angle, THE System SHALL:**
   - **Step 1: Start from the Orbital_Normal_Vector N**
   - **Step 2: Compute the Ascending_Node_Direction A = (cos(Ω), sin(Ω), 0)**
   - **Step 3: Rotate N around A by the obliquity angle ε using right-hand rule**
   - **Step 4: The resulting vector S is the Spin_Axis_Vector**
   - **Formula: S = N * cos(ε) + (A × N) * sin(ε) + A * (A · N) * (1 - cos(ε))**
4. THE Spin_Axis_Vector SHALL point toward the body's north pole (right-hand rule: fingers curl in rotation direction, thumb points to north)
5. THE System SHALL validate that Spin_Axis_Vector is a unit vector (magnitude = 1 ± 0.0001)
6. FOR retrograde rotators (obliquity > 90°), THE Spin_Axis_Vector SHALL point to the "north" pole as defined by IAU conventions

### Requirement 3: 倾角作为派生量

**User Story:** As a developer, I want obliquity to be a derived quantity from vectors, so that the system is geometrically consistent.

#### Acceptance Criteria

1. THE Obliquity_Calculator SHALL compute obliquity as the angle between Spin_Axis_Vector and Orbital_Normal_Vector
2. THE Obliquity_Calculator SHALL use the formula: obliquity = acos(clamp(dot(spinAxis, orbitalNormal), -1, 1))
3. WHEN obliquity is provided as input (legacy), THE System SHALL convert it to a Spin_Axis_Vector using Requirement 2.3
4. THE System SHALL support obliquity values from 0° to 180° (including retrograde rotation)
5. THE computed obliquity SHALL match NASA Planetary Fact Sheet values within 0.1° tolerance
6. THE round-trip property SHALL hold: computeObliquity(computeSpinAxis(obliquity, orbitalNormal)) ≈ obliquity

### Requirement 4: 渲染层向量对齐

**User Story:** As a developer, I want the render layer to align mesh orientation to the spin axis vector, so that visual representation matches physics.

#### Acceptance Criteria

1. THE Render_Layer SHALL NOT directly set rotation.x/y/z to represent obliquity
2. THE Render_Layer SHALL use Vector_Alignment (quaternion from-to) to orient the mesh
3. WHEN applying rotation, THE Render_Layer SHALL first transform Spin_Axis_Vector from ICRF/J2000 to Render_Reference_Frame
4. **THE Render_Layer SHALL align the mesh's declared Model_North_Axis to the transformed Spin_Axis_Vector**
5. THE Render_Layer SHALL apply daily rotation around the aligned spin axis, not around world Y
6. THE Model_North_Axis SHALL be configurable per model (default: +Y for standard sphere models)
7. THE quaternion construction SHALL use: Quaternion.setFromUnitVectors(modelNorthAxis, transformedSpinAxis)

### Requirement 5: 坐标系转换

**User Story:** As a developer, I want explicit coordinate frame transformations, so that vectors are correctly mapped between frames.

#### Acceptance Criteria

1. THE Frame_Transformer SHALL provide methods to transform vectors between ICRF/J2000, Body_Reference_Frame, and Render_Reference_Frame
2. WHEN transforming from ICRF/J2000 (Z-up ecliptic) to Render_Reference_Frame (Y-up Three.js), THE Frame_Transformer SHALL apply:
   - render_x = icrf_x
   - render_y = icrf_z
   - render_z = -icrf_y
3. THE Frame_Transformer SHALL preserve vector magnitude during transformation (isometric transformation)
4. THE Frame_Transformer SHALL be invertible: transform(inverse_transform(v)) = v within floating-point tolerance (1e-10)
5. THE Frame_Transformer SHALL log warnings if input vectors are not unit vectors when expected

### Requirement 6: 禁止直接欧拉角设置

**User Story:** As a system architect, I want to prevent direct Euler angle manipulation for obliquity, so that the codebase enforces physical correctness.

#### Acceptance Criteria

1. THE Planet class SHALL NOT expose methods that directly set rotation.x/y/z for obliquity purposes
2. THE Planet class SHALL provide a setSpinAxisVector(vector: Vector3) method as the only way to set orientation
3. IF legacy code attempts to set rotation directly for obliquity, THE System SHALL throw an error in development mode
4. THE System SHALL provide a migration utility to convert legacy obliquity angles to Spin_Axis_Vectors
5. THE code review guidelines SHALL flag any direct rotation.x/y/z assignments related to obliquity

### Requirement 7: 岁差预留接口

**User Story:** As a developer, I want the system to support future axial precession, so that the architecture is extensible.

#### Acceptance Criteria

1. THE Spin_Axis_Vector interface SHALL include an optional epoch parameter (Julian Date)
2. THE System SHALL support querying Spin_Axis_Vector at different epochs (returns same value in Phase 1)
3. THE interface SHALL allow future implementation of getSpinAxisAtEpoch(jd: number): Vector3
4. THE data model SHALL store precession rate (arcseconds/century) even if unused in Phase 1
5. THE System SHALL document that precession is not implemented in Phase 1 but interface is stable

### Requirement 8: 验证与测试

**User Story:** As a QA engineer, I want comprehensive validation of the axial tilt system, so that I can verify physical correctness.

#### Acceptance Criteria

1. THE System SHALL include property-based tests verifying that computed obliquity matches input obliquity (round-trip)
2. THE System SHALL include tests verifying that Spin_Axis_Vector is always a unit vector
3. THE System SHALL include tests verifying coordinate frame transformations are invertible
4. THE System SHALL include visual regression tests comparing rendered orientation against reference images
5. THE System SHALL include tests verifying that Earth's obliquity renders with north pole tilted toward ecliptic north in appropriate configuration
6. THE System SHALL include tests verifying that Venus (obliquity ~177°) and Uranus (obliquity ~98°) render correctly as retrograde/sideways rotators

## Non-Goals / Explicit Anti-Patterns

**The following are explicitly FORBIDDEN:**

1. ❌ **Treating obliquity as a direct Euler rotation** - Obliquity is a geometric relationship, not a rotation amount
2. ❌ **Defining tilt relative to world axes** - Tilt is always relative to the orbital normal, never to world Y or any global axis
3. ❌ **Inferring spin axis from mesh orientation** - The mesh orientation is OUTPUT, not INPUT
4. ❌ **Modifying spin axis in render layer logic** - Render layer only READS and TRANSFORMS, never COMPUTES physics
5. ❌ **Assuming all models have the same north axis** - Each model declares its own Model_North_Axis
6. ❌ **Using position-velocity cross product as primary orbital normal source** - Only orbital elements (i, Ω) are authoritative
7. ❌ **Hardcoding coordinate frame conversions inline** - All conversions go through Frame_Transformer

