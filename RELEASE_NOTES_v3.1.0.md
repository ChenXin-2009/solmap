# Release Notes - v3.1.0

## Planet Texture System (Phase 1)

发布日期: 2025-12-20

### 概述

本版本实现了行星表面贴图系统的 Phase 1 最小闭环。系统设计遵循严格的层级隔离原则，确保贴图功能完全不影响物理计算。

### 核心特性

- **BaseColor 贴图支持**: 8 大行星（水星、金星、地球、火星、木星、土星、天王星、海王星）支持表面贴图
- **TextureManager 单例服务**: 统一管理贴图加载、缓存和 GPU 资源释放
- **引用计数机制**: 安全的资源管理，防止内存泄漏

### 设计约束（Phase 1 锁定）

| 约束 | 状态 |
|------|------|
| Texture = Render-only | ✅ 贴图仅用于渲染层 |
| Low / High only | ✅ 仅支持 2K/4K 分辨率 |
| No 8K by design | ✅ 明确禁止 8K 贴图 |
| Sun emissive-only | ✅ 太阳不使用贴图 |
| No normal/specular maps | ✅ Phase 1 不支持 |
| No cloud animation | ✅ Phase 1 不支持 |

### 验证测试

- 45 个测试全部通过
- 3 条核心属性测试（Property Tests）:
  1. **Physical Layer Invariance**: 贴图操作不改变物理状态
  2. **Sun Never Textured**: Sun 永远 emissive-only
  3. **RefCount Safety**: 引用计数永不负数、不提前释放

### 文件变更

- `src/lib/config/visualConfig.ts` - 添加贴图配置和策略约束
- `src/lib/3d/TextureManager.ts` - 贴图管理器单例
- `src/lib/3d/Planet.ts` - 扩展支持贴图应用
- `src/components/canvas/3d/SolarSystemCanvas3D.tsx` - 集成贴图加载
- `src/__tests__/texture/` - 完整测试套件

### 贴图资源

贴图文件位于 `public/textures/planets/`，使用 NASA 官方资源（2K 分辨率）。

### 后续计划

Phase 1 已锁定，以下功能暂不实现：
- 8K 高分辨率贴图
- 法线/高光贴图
- 云层动画
- 自动下载贴图
- 地形细节

---

**版本标识**: v3.1.0  
**Phase**: 1  
**状态**: 稳定
