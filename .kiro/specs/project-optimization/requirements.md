# 项目优化需求文档

## 介绍

SolMap 项目必须严格遵守 `.kiro/specs/solmap-ai-governance.md` 中定义的 Spec-0 到 Spec-8 治理规范。本规范旨在创建一个项目优化工具，能够自动检测、报告和修复违反治理规范的代码，确保项目的物理系统优先性、架构一致性和长期可演化性。

## 术语表

- **System**: SolMap 太阳系可视化应用
- **Physics_Guardian**: 负责维护物理定义正确性的系统组件
- **Architecture_Guardian**: 负责审计和维护架构分层的系统组件
- **SSOT_Violation**: 违反单一数据源原则的代码实现
- **Layer_Separation_Violation**: 违反层分离原则的跨层访问
- **Constants_Pollution**: 在常量文件中出现逻辑或计算代码
- **Magic_Number**: 在代码中硬编码的物理常量或配置值
- **Renderer_Intelligence**: 渲染层中不应存在的物理推导或解释逻辑
- **Structural_Failure**: 同一问题被修改≥3次的结构性问题
- **Authority_Definition**: 物理/天文概念的唯一权威定义点

## 需求

### 需求 1: 治理规范合规性检测

**用户故事:** 作为架构师，我希望自动检测违反 Spec-0 到 Spec-8 治理规范的代码，以便确保项目的结构完整性和物理系统优先性。

#### 验收标准

1. WHEN 扫描项目代码 THEN THE System SHALL 识别所有违反 Spec-0 最高约束的代码实现
2. WHEN 检查物理常量定义 THEN THE System SHALL 确保所有天文/物理概念只存在唯一权威定义点
3. WHEN 分析渲染层代码 THEN THE System SHALL 检测渲染层中的物理推导或解释逻辑
4. WHEN 验证层分离 THEN THE System SHALL 识别所有跨层 import 和依赖违规
5. WHEN 检查常量文件 THEN THE System SHALL 确保 constants 目录只包含常量，无逻辑或计算

### 需求 2: 单一数据源 (SSOT) 强制执行

**用户故事:** 作为物理守护者，我希望强制执行单一数据源原则，以便防止物理概念的重复定义和不一致性。

#### 验收标准

1. WHEN 扫描轴倾角定义 THEN THE System SHALL 确保所有轴倾角数据只来自 `lib/astronomy/constants/axialTilt.ts`
2. WHEN 检查物理参数 THEN THE System SHALL 确保半径、质量、GM 只来自 `lib/astronomy/constants/physicalParams.ts`
3. WHEN 分析周期数据 THEN THE System SHALL 确保自转、公转周期只来自 `lib/astronomy/constants/rotation.ts`
4. WHEN 验证参考系 THEN THE System SHALL 确保参考系定义只来自 `lib/astronomy/constants/referenceFrames.ts`
5. WHEN 检测重复定义 THEN THE System SHALL 识别并报告任何物理概念的第二定义源

### 需求 3: 渲染层愚蠢化验证

**用户故事:** 作为架构守护者，我希望确保渲染层保持愚蠢化，以便维护清晰的职责分离。

#### 验收标准

1. WHEN 分析渲染器代码 THEN THE System SHALL 确保渲染器只接收位置向量、姿态矩阵和可视参数
2. WHEN 检查渲染层导入 THEN THE System SHALL 禁止渲染器导入任何物理常量或计算模块
3. WHEN 验证渲染逻辑 THEN THE System SHALL 确保渲染器不知道轴倾角、周期或参考系的存在
4. WHEN 检测计算逻辑 THEN THE System SHALL 识别渲染层中的任何角度或周期计算
5. WHEN 分析渲染器职责 THEN THE System SHALL 确保渲染器不进行物理推导或数据解释

### 需求 4: 魔法数字消除

**用户故事:** 作为实现 AI，我希望消除代码中的魔法数字，以便确保所有物理数据都通过权威定义获取。

#### 验收标准

1. WHEN 扫描函数内部 THEN THE System SHALL 识别所有硬编码的物理常量
2. WHEN 检查角度定义 THEN THE System SHALL 确保所有角度值都来自权威常量文件
3. WHEN 分析周期使用 THEN THE System SHALL 确保所有周期数据都通过 import 获取
4. WHEN 验证比例因子 THEN THE System SHALL 识别硬编码的比例或缩放因子
5. WHEN 检测配置值 THEN THE System SHALL 确保配置值都有明确的来源和单位

### 需求 5: 结构性失败检测

**用户故事:** 作为审计 AI，我希望检测结构性失败模式，以便触发重构流程防止重复错误。

#### 验收标准

1. WHEN 分析代码历史 THEN THE System SHALL 识别同一问题被修改≥3次的代码区域
2. WHEN 检测不稳定性 THEN THE System SHALL 识别测试通过但视觉/数值不稳定的实现
3. WHEN 验证修复质量 THEN THE System SHALL 检测"为了看起来对"的调参行为
4. WHEN 分析重复修改 THEN THE System SHALL 标记需要结构性重构的代码区域
5. WHEN 触发重构流程 THEN THE System SHALL 提供冻结功能开发的建议

### 需求 6: 架构层分离强制执行

**用户故事:** 作为架构守护者，我希望强制执行严格的层分离，以便维护系统的可维护性和可演化性。

#### 验收标准

1. WHEN 检查导入关系 THEN THE System SHALL 识别所有违反层分离的跨层导入
2. WHEN 验证依赖方向 THEN THE System SHALL 确保依赖关系符合既定的架构设计
3. WHEN 分析模块职责 THEN THE System SHALL 检测违反单一职责原则的模块
4. WHEN 检查接口边界 THEN THE System SHALL 验证模块间接口的清晰性和一致性
5. WHEN 审计架构决策 THEN THE System SHALL 拒绝"能跑但结构错误"的代码实现

### 需求 7: 常量文件纯净性维护

**用户故事:** 作为物理守护者，我希望维护常量文件的纯净性，以便确保 SSOT 原则的严格执行。

#### 验收标准

1. WHEN 检查常量文件内容 THEN THE System SHALL 确保只包含常量和冻结对象
2. WHEN 分析常量文件逻辑 THEN THE System SHALL 禁止任何条件分支或计算逻辑
3. WHEN 验证对象冻结 THEN THE System SHALL 确保所有常量对象都使用 Object.freeze
4. WHEN 检测函数定义 THEN THE System SHALL 禁止在常量文件中定义任何函数
5. WHEN 分析导入依赖 THEN THE System SHALL 确保常量文件不依赖其他业务模块

### 需求 8: AI 自检流程实现

**用户故事:** 作为 AI 代理，我希望实现自检流程，以便在提交代码前验证治理规范合规性。

#### 验收标准

1. WHEN 执行自检流程 THEN THE System SHALL 验证是否引入了新的定义点
2. WHEN 检查数值理解 THEN THE System SHALL 确认数值的单位与参考系是否明确
3. WHEN 分析计算归属 THEN THE System SHALL 验证计算是否属于正确的层级
4. WHEN 评估结构影响 THEN THE System SHALL 检测是否破坏了现有架构
5. WHEN 无法回答关键问题 THEN THE System SHALL 禁止代码提交并要求人工审查

### 需求 9: 治理规范教育和建议

**用户故事:** 作为开发者，我希望获得治理规范的教育和修复建议，以便理解和遵循项目的架构原则。

#### 验收标准

1. WHEN 检测到违规 THEN THE System SHALL 提供具体的治理规范引用和解释
2. WHEN 提供修复建议 THEN THE System SHALL 给出符合 SSOT 原则的重构方案
3. WHEN 教育开发者 THEN THE System SHALL 解释违规代码对系统稳定性的影响
4. WHEN 指导重构 THEN THE System SHALL 提供将违规代码迁移到正确位置的步骤
5. WHEN 预防未来违规 THEN THE System SHALL 提供最佳实践建议和模板

### 需求 10: 持续监控和报告

**用户故事:** 作为项目维护者，我希望持续监控治理规范合规性，以便及时发现和处理违规行为。

#### 验收标准

1. WHEN 生成合规报告 THEN THE System SHALL 提供详细的违规统计和趋势分析
2. WHEN 监控代码变更 THEN THE System SHALL 在每次提交时验证治理规范合规性
3. WHEN 跟踪修复进度 THEN THE System SHALL 记录违规修复的历史和效果
4. WHEN 评估架构健康度 THEN THE System SHALL 提供整体架构质量的量化指标
5. WHEN 预警结构性问题 THEN THE System SHALL 在问题达到结构性失败阈值前发出警告