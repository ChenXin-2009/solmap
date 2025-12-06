# 星球 LOD（Level of Detail）动态优化说明

## 功能概述

已实现 **动态 LOD 优化**，使星球在靠近时能显示更多细节（增加面数），远离时减少面数以优化渲染性能。

### 核心特性
- ✅ **靠近星球时**：自动增加几何体分段数，显示更多细节，消除棱角感
- ✅ **远离星球时**：自动减少分段数，降低 GPU 负担，提升帧率
- ✅ **平滑过渡**：分段数变化平缓，避免视觉抖动和频繁的几何体重建

## 技术实现

### 1. 配置文件修改
**文件**: `src/lib/config/visualConfig.ts`

新增 `PLANET_LOD_CONFIG` 配置：

```typescript
export const PLANET_LOD_CONFIG = {
  baseSegments: 32,          // 基础分段数（中等距离）
  minSegments: 16,           // 最少分段数（远距离下限）
  maxSegments: 128,          // 最多分段数（近距离上限）
  transitionDistance: 10,    // LOD 过渡参考距离
  smoothness: 0.15,          // 分段数平滑过渡速度 (0-1)
};
```

### 2. Planet 类改进
**文件**: `src/lib/3d/Planet.ts`

改进了 `updateLOD()` 方法：

- **输入**: 相机到星球中心的距离
- **输出**: 根据距离动态计算目标分段数，并以平滑的速度过渡
- **算法**: 使用对数缩放，确保距离变化映射为合理的分段数增减

新增方法：
- `rebuildGeometry()`: 当分段数变化时重建几何体

### 3. 渲染循环集成
**文件**: `src/components/canvas/3d/SolarSystemCanvas3D.tsx`

在动画循环中添加了 LOD 更新：

```typescript
// 计算相机到星球的距离并更新 LOD
const planetWorldPos = new THREE.Vector3(body.x, body.y, body.z);
const cameraPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
const distance = planetWorldPos.distanceTo(cameraPos);
planet.updateLOD(distance);
```

## 参数调整指南

### 调整方法

编辑 `src/lib/config/visualConfig.ts` 中的 `PLANET_LOD_CONFIG`：

| 参数 | 现值 | 说明 | 建议范围 |
|------|------|------|--------|
| `baseSegments` | 32 | 中等距离（约 30 AU）的分段数 | 24-48 |
| `minSegments` | 16 | 远距离时不低于此值 | 8-32 |
| `maxSegments` | 128 | 近距离时不超过此值 | 64-256 |
| `transitionDistance` | 10 | LOD 过渡敏感度参考距离 | 5-20 |
| `smoothness` | 0.15 | 分段数变化的平滑度 | 0.1-0.3 |

### 调整效果

**增加 `maxSegments`** （如改为 256）：
- 优点：近距离看星球细节更清晰
- 缺点：靠近星球时 GPU 负担增加，可能降低帧率

**减少 `minSegments`** （如改为 8）：
- 优点：远距离渲染更快
- 缺点：远处星球看起来更粗糙

**增加 `transitionDistance`** （如改为 20）：
- 优点：LOD 变化更缓和，减少突变感
- 缺点：靠近时需要更接近才能看到细节增加

**减少 `smoothness`** （如改为 0.1）：
- 优点：细节增加/减少更平缓
- 缺点：反应速度变慢，可能有延迟感

## 性能影响

### CPU 影响
- **几何体重建开销**：当分段数变化时需要重建 `SphereGeometry`，触发垃圾回收
- **优化方案**：`smoothness` 值较小时重建频率降低

### GPU 影响
- **近距离**：更多顶点和面数意味着更多计算，但通常在可接受范围内
- **远距离**：分段数少，性能最优

## 测试场景

1. **场景1：远距离观看太阳系**
   - 相机距离 > 30 AU
   - 星球使用 `minSegments`（约 16 面）

2. **场景2：靠近地球**
   - 相机距离约 5 AU
   - 星球分段数逐步增加到中等

3. **场景3：极近距离观看星球表面**
   - 相机距离 < 1 AU
   - 星球使用接近 `maxSegments`（约 128 面）
   - 能清晰看到球面细节

## 未来优化方向

1. **非均匀采样**：离相机越近采样越密，可进一步优化性能
2. **多 LOD 版本缓存**：预生成常用分段数的几何体，加速切换
3. **GPU 驱动的 LOD**：使用 Compute Shader 动态调整细节
4. **纹理贴图支持**：配合法线贴图增强细节而无需增加面数
