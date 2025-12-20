# Implementation Plan: Planet Texture System

## Overview

本实现计划将行星贴图系统分解为可增量执行的编码任务。每个任务构建在前一个任务之上，确保代码始终可运行。重点是渲染层隔离和正确的资源管理。

## Tasks

- [x] 1. 添加贴图配置到 visualConfig.ts
  - 在 visualConfig.ts 中添加 PlanetTextureConfig 接口
  - 添加 PLANET_TEXTURE_CONFIG 映射（BodyId → 贴图路径）
  - 添加 TEXTURE_MANAGER_CONFIG 配置项
  - Sun 不配置贴图（emissive-only）
  - _Requirements: 1.1, 1.3, 1.4, 3.5_

- [x] 2. 实现 TextureManager 单例服务
  - [x] 2.1 创建 TextureManager 类骨架
    - 在 src/lib/3d/TextureManager.ts 创建文件
    - 实现单例模式（私有构造函数 + getInstance）
    - 定义 TextureCacheEntry 和 TextureLoadState 类型
    - _Requirements: 4.4, 5.2_

  - [x] 2.2 实现贴图加载逻辑
    - 实现 getTexture(bodyId) 异步方法
    - 实现 normalizeBodyId 规范化函数
    - 使用 THREE.TextureLoader 加载贴图
    - 实现加载失败的错误处理和日志
    - _Requirements: 2.1, 2.3, 1.5_

  - [x] 2.3 实现缓存和引用计数
    - 实现 texture cache Map
    - 实现 refCount 引用计数
    - 实现 getCachedTexture(bodyId) 同步方法
    - 实现 hasTexture(bodyId) 检查方法
    - _Requirements: 2.4, 5.3_

  - [x] 2.4 实现资源释放
    - 实现 releaseTexture(bodyId) 方法
    - 实现 disposeAll() 方法
    - 确保 refCount 为 0 时才释放 GPU 资源
    - _Requirements: 5.1, 5.4_

  - [x] 2.5 编写 TextureManager 属性测试
    - **Property 2: Cache Identity** - 多次请求返回同一实例
    - **Property 3: Error Fallback** - 加载失败优雅降级
    - **Property 7: RefCount Safety** - 引用计数释放安全
    - **Validates: Requirements 2.3, 2.4, 5.3, 5.4**
    - ✅ 实现于 `src/__tests__/texture/texture-properties.test.ts`

- [x] 3. 扩展 Planet 类支持贴图
  - [x] 3.1 添加贴图相关属性和方法
    - 添加 textureLoaded, textureBodyId 私有属性
    - 实现 applyTexture(texture, bodyId) 方法
    - 实现 hasTextureApplied() 方法
    - Sun 排除逻辑（isSun 检查）
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 3.2 扩展 dispose 方法
    - 清除 material.map 引用
    - 重置 textureLoaded 和 textureBodyId
    - 确保不直接释放 GPU 资源（由 TextureManager 管理）
    - _Requirements: 5.1_

  - [x] 3.3 编写 Planet 贴图属性测试
    - **Property 5: Sun Exclusion** - Sun 的 material.map 始终为 null
    - **Property 6: Rotation Sync** - 贴图随 mesh 旋转
    - **Validates: Requirements 3.4, 3.5**
    - ✅ Sun Exclusion 实现于 `src/__tests__/texture/texture-properties.test.ts`

- [x] 4. 集成到 SolarSystemCanvas3D
  - [x] 4.1 在组件中初始化 TextureManager
    - 获取 TextureManager 单例
    - 在组件挂载时预加载贴图
    - _Requirements: 2.1_

  - [x] 4.2 创建 Planet 时应用贴图
    - 在 Planet 创建后调用 TextureManager.getTexture
    - 贴图加载完成后调用 planet.applyTexture
    - 处理加载中的过渡状态（显示纯色）
    - _Requirements: 2.2, 2.5, 3.1_

  - [x] 4.3 组件卸载时清理资源
    - 调用 TextureManager.releaseTexture 释放引用
    - 确保 Planet.dispose 正确调用
    - _Requirements: 5.1, 5.4_

- [x] 5. Checkpoint - 验证基础功能
  - 确保所有测试通过
  - 验证贴图正确显示在行星上
  - 验证 Sun 保持 emissive-only
  - 如有问题，询问用户

- [x] 6. 添加物理层隔离验证
  - [x] 6.1 添加架构验证测试
    - 验证 TextureManager 不被 Physical Layer 模块导入
    - 验证贴图操作不影响 Physical Layer 状态
    - _Requirements: 4.5_

  - [x] 6.2 编写物理层不变性属性测试
    - **Property 4: Physical Layer Invariance** - 贴图操作不改变物理状态
    - **Validates: Requirements 4.1, 4.3, 4.6**
    - ✅ 实现于 `src/__tests__/texture/texture-properties.test.ts`

- [x] 7. Final Checkpoint - 完整验证
  - 确保所有测试通过
  - 验证内存使用正常（无泄漏）
  - 验证层级隔离完整
  - 如有问题，询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 贴图文件需要手动放置到 public/textures/planets/ 目录
- 初版使用 2K 分辨率贴图以优化内存
- Property tests 使用 fast-check 库，每个属性最少 100 次迭代
- BodyId 必须与 Physical Layer 定义一致（小写）
