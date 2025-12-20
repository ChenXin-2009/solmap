# Requirements Document

## Introduction

本功能为太阳系可视化系统添加行星表面贴图（Base Color / Albedo）支持。贴图仅用于渲染层，不参与任何物理计算。采用分阶段实现策略：

- **第一步（当前）**：只添加 Base Color（Albedo）贴图，不加法线、高程、云层动画。贴图只读，不参与物理计算。
- **第二步（可选）**：将贴图作为 Render Asset 与 BodyId / CelestialBody 绑定，支持热替换。
- **第三步（未来）**：支持多层贴图（地表/云层/夜面），时间驱动云层动画（仍然只在渲染层）。

贴图来源：NASA 科学等经纬贴图（Equirectangular projection）。
实现目标：能验证物理正确性即可，不追求视觉细节。

## Glossary

- **Texture_Manager**: 贴图管理器，负责加载、缓存和管理行星贴图资源
- **Planet_Renderer**: 行星渲染器（现有 Planet.ts），负责将贴图应用到行星 3D 网格
- **Render_Layer**: 渲染层，只负责视觉呈现，不参与物理计算
- **Physical_Layer**: 物理层，负责天体位置、轨道等物理计算
- **Base_Color_Map**: 基础颜色贴图（Albedo），定义行星表面的漫反射颜色
- **Equirectangular_Projection**: 等距圆柱投影，NASA 行星贴图的标准格式
- **BodyId**: 天体唯一标识符（如 "earth", "mars"）
- **Texture_Asset**: 贴图资源，包含贴图路径、加载状态等元数据

## Requirements

### Requirement 1: 贴图配置定义

**User Story:** As a developer, I want to define texture configurations for each planet, so that the system knows which texture to load for each celestial body.

#### Acceptance Criteria

1. THE Texture_Manager SHALL provide a configuration mapping from BodyId to texture file path
2. WHEN a BodyId has no configured texture THEN THE Texture_Manager SHALL use the existing solid color fallback
3. THE configuration SHALL support equirectangular projection textures (standard NASA format)
4. THE configuration SHALL be defined in a centralized location (visualConfig.ts)
5. THE BodyId used for texture lookup SHALL originate from Physical_Layer StateVector metadata or BodyHierarchy definitions

### Requirement 2: 贴图加载

**User Story:** As a user, I want planet textures to load efficiently, so that the visualization remains responsive.

#### Acceptance Criteria

1. WHEN the application starts THEN THE Texture_Manager SHALL load configured textures asynchronously
2. WHILE a texture is loading THEN THE Planet_Renderer SHALL display the existing solid color
3. WHEN a texture fails to load THEN THE Texture_Manager SHALL log an error and continue with solid color fallback
4. THE Texture_Manager SHALL cache loaded textures to avoid redundant loading
5. WHEN a texture is successfully loaded THEN THE Planet_Renderer SHALL apply it to the planet mesh

### Requirement 3: 贴图应用到行星网格

**User Story:** As a user, I want to see realistic planet surfaces, so that I can better visualize the solar system.

#### Acceptance Criteria

1. WHEN a texture is available THEN THE Planet_Renderer SHALL apply it as the diffuse map (map property) of MeshStandardMaterial
2. THE Planet_Renderer SHALL preserve existing emissive properties for the Sun
3. THE texture mapping SHALL use spherical UV coordinates matching equirectangular projection
4. WHEN the planet rotates THEN THE texture SHALL rotate with the planet mesh
5. The Sun SHALL NOT use Base_Color_Map textures in Phase 1; it remains emissive-only

### Requirement 4: 渲染层隔离

**User Story:** As a system architect, I want textures to be purely render-layer assets, so that they don't affect physical calculations.

#### Acceptance Criteria

1. THE Texture_Manager SHALL NOT expose any methods that modify Physical_Layer state
2. THE texture loading and application SHALL NOT block or delay Physical_Layer calculations
3. WHEN texture state changes THEN THE Physical_Layer state SHALL remain unchanged
4. THE Texture_Manager SHALL only be accessible from Render_Layer components
5. THE Texture_Manager SHALL NOT be imported or referenced by any Physical_Layer module, including Space-Time Core, Ephemeris Providers, or Time Authority
6. Texture dimensions, aspect ratio, or visual features SHALL NOT affect collision radius, picking radius, or any physical or interaction calculations

### Requirement 5: 贴图资源管理

**User Story:** As a developer, I want proper resource management for textures, so that memory is used efficiently.

#### Acceptance Criteria

1. WHEN a Planet instance is disposed THEN THE Planet_Renderer SHALL release its material reference to the texture
2. THE Texture_Manager SHALL support texture disposal for cleanup
3. WHEN the same texture is requested multiple times THEN THE Texture_Manager SHALL return the cached instance
4. THE Texture_Manager SHALL manage actual GPU texture disposal based on reference counting or cache policy, not individual Planet disposal

### Requirement 6: 贴图配置扩展性

**User Story:** As a developer, I want the texture system to be extensible, so that future features (normal maps, cloud layers) can be added easily.

#### Acceptance Criteria

1. THE texture configuration structure SHALL support additional texture types (reserved for future use)
2. THE Texture_Manager interface SHALL be designed to accommodate multiple texture layers per body
3. THE current implementation SHALL only use Base_Color_Map, with other types as optional placeholders
