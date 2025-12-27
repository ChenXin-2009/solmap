# Implementation Plan: Axial Tilt Physics System

## Overview

本实现计划将「物理正确的自转轴倾角系统」分解为可执行的编码任务。实现顺序遵循依赖关系：先建立物理层计算器，再建立坐标转换器，最后集成到渲染层。

## Tasks

- [x] 1. 创建核心类型定义和接口
  - 在 `src/lib/axial-tilt/types.ts` 中定义 Vector3、OrbitalElements、CelestialBodyOrientationConfig 等类型
  - 定义 OrbitalCalculator、SpinAxisCalculator、FrameTransformer、MeshOrientationManager 接口
  - 添加 rotationSense 字段和退化情况常量
  - _Requirements: 2.1, 2.2, 7.1_

- [x] 2. 实现 OrbitalCalculator
  - [x] 2.1 实现 computeOrbitalNormal 函数
    - 使用公式：N_x = sin(i) * sin(Ω), N_y = -sin(i) * cos(Ω), N_z = cos(i)
    - 处理 Sun 特殊情况返回 (0, 0, 1)
    - 验证输出为单位向量
    - _Requirements: 1.1, 1.3, 1.4, 1.6_
  - [x] 2.2 实现 computeAscendingNodeDirection 函数
    - 使用公式：A_x = cos(Ω), A_y = sin(Ω), A_z = 0
    - _Requirements: 1.1_
  - [x] 2.3 编写 OrbitalCalculator 属性测试
    - **Property 1: Orbital Normal Unit Vector**
    - **Property 2: Orbital Normal Determinism**
    - **Validates: Requirements 1.1, 1.5, 1.6**

- [x] 3. 实现 SpinAxisCalculator
  - [x] 3.1 实现 computeSpinAxis 函数
    - 使用 Rodrigues 旋转公式
    - 处理退化情况：ε=0 直接返回 orbitalNormal
    - 处理退化情况：|A×N| < 1e-10 使用确定性备选轴
    - _Requirements: 2.3, 2.4, 2.5_
  - [x] 3.2 实现 computeObliquity 函数
    - 使用公式：ε = acos(clamp(S·N, -1, 1))
    - _Requirements: 3.1, 3.2_
  - [x] 3.3 编写 SpinAxisCalculator 属性测试
    - **Property 3: Spin Axis Round-Trip**
    - **Validates: Requirements 2.3, 2.5, 3.6**

- [x] 4. Checkpoint - 验证物理层计算
  - 确保所有物理层测试通过
  - 验证 Earth (23.44°)、Venus (177.4°)、Uranus (97.77°) 的计算结果
  - 如有问题请询问用户

- [x] 5. 实现 FrameTransformer
  - [x] 5.1 实现 icrfToRender 函数
    - 应用变换：render_x = icrf_x, render_y = icrf_z, render_z = -icrf_y
    - _Requirements: 5.1, 5.2_
  - [x] 5.2 实现 renderToIcrf 函数
    - 应用逆变换：icrf_x = render_x, icrf_y = -render_z, icrf_z = render_y
    - _Requirements: 5.1_
  - [x] 5.3 实现 validateUnitVector 函数
    - 检查向量模长是否为 1 ± tolerance
    - 非单位向量时记录警告
    - _Requirements: 5.5_
  - [x] 5.4 编写 FrameTransformer 属性测试
    - **Property 4: Frame Transformation Round-Trip**
    - **Property 5: Frame Transformation Preserves Magnitude**
    - **Validates: Requirements 5.3, 5.4**

- [x] 6. 实现 MeshOrientationManager
  - [x] 6.1 实现 applySpinAxisOrientation 函数
    - 调用 FrameTransformer 转换 spinAxis
    - 使用 Quaternion.setFromUnitVectors(modelNorthAxis, spinAxis)
    - 确保幂等性：替换而非累积
    - _Requirements: 4.2, 4.3, 4.4, 4.7_
  - [x] 6.2 实现 applyDailyRotation 函数
    - 绕 spinAxis 旋转，不是绕 world Y
    - 与基础朝向组合
    - _Requirements: 4.5_
  - [x] 6.3 编写 MeshOrientationManager 属性测试
    - **Property 6: Mesh Alignment Correctness**
    - **Property 7: Daily Rotation Axis**
    - **Property 9: Orientation Idempotency**
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [x] 7. Checkpoint - 验证渲染层集成
  - 确保所有渲染层测试通过
  - 如有问题请询问用户

- [x] 8. 更新数据配置
  - [x] 8.1 扩展 CelestialBodyConfig 类型
    - 添加 CelestialBodyOrientationConfig 字段
    - 添加 rotationSense 字段
    - _Requirements: 2.1, 7.4_
  - [x] 8.2 添加行星朝向数据
    - 为所有行星添加 obliquityDegrees 配置
    - 为逆行天体（Venus、Uranus）添加 rotationSense: "retrograde"
    - _Requirements: 3.5_

- [x] 9. 集成到 Planet 类
  - [x] 9.1 重构 Planet 构造函数
    - 移除直接的 rotation.x 设置
    - 调用 OrbitalCalculator 和 SpinAxisCalculator 计算向量
    - _Requirements: 6.1, 6.2_
  - [x] 9.2 重构 updateRotation 方法
    - 使用 MeshOrientationManager.applyDailyRotation
    - 确保绕正确的轴旋转
    - _Requirements: 4.5_
  - [x] 9.3 添加 setSpinAxisVector 方法
    - 作为设置朝向的唯一公开方法
    - 内部调用 MeshOrientationManager
    - _Requirements: 6.2_
  - [x] 9.4 编写 Planet 集成测试
    - 验证 Earth 北极在夏至时朝向太阳
    - 验证 Uranus 侧躺旋转
    - 验证 Venus 逆行旋转
    - _Requirements: 8.5, 8.6_

- [x] 10. 添加迁移工具和弃用警告
  - [x] 10.1 创建 migrateLegacyObliquity 工具函数
    - 将旧的角度配置转换为 spinAxis 向量
    - _Requirements: 6.4_
  - [x] 10.2 添加开发模式警告
    - 检测直接设置 rotation.x/y/z 的代码
    - 在开发模式下抛出错误
    - _Requirements: 6.3_

- [x] 11. Final Checkpoint - 完整系统验证
  - 确保所有测试通过
  - 运行视觉回归测试
  - 验证所有行星的朝向正确
  - 如有问题请询问用户

## Notes

- All tasks are required for comprehensive testing from the start
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 实现语言：TypeScript
- 属性测试框架：fast-check

