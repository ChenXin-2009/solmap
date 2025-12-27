# SolMap · Kiro Specs：AI 协同开发与结构监督体系

> 本文档是 **SolMap 项目的 Kiro AI Specs 拆解版**，用于驱动多 AI Agent 在明确职责、强约束下进行自主开发。
> 
> **目标**：防止 AI 在简单物理问题上反复犯错，确保项目长期可演化。

---

## Spec-0：最高约束（Global Constitution）

### 目标

- 将 SolMap 定义为 **物理系统优先的软件系统**
- 明确：
  - 正确性 > 架构完整性 > 功能实现 > 视觉效果

### 强制规则

1. SolMap 中所有天文/物理概念必须存在 **唯一权威定义点**
2. 任意模块 **禁止引入第二定义源**
3. 渲染层不得解释、推导或修正物理量

### 失败判定

- 同一问题被修改 ≥ 3 次 → **结构性失败**
- 结构性失败必须触发重构流程

---

## Spec-1：Architecture Guardian（架构守护 AI）

### 职责

- 审计项目目录结构
- 确保层分离不被破坏
- 拒绝任何“能跑但结构错误”的改动

### 关注点

- 是否存在跨层 import
- 是否存在概念散落在多个目录
- constants 是否被污染（出现逻辑或计算）

### 否决权

- 可直接否决 Implementation AI 的 PR
- 否决无需给出修复方案

---

## Spec-2：Physics Guardian（物理守护 AI）

### 职责

- 维护所有天文与物理定义的正确性
- 管理 reference frame、单位、epoch

### 强制规则

- 所有以下内容只能来自 `lib/astronomy/constants`：
  - 轴倾角
  - 半径 / 质量 / GM
  - 自转、公转周期

### 禁止事项

- 编写 UI / Renderer 代码
- 为通过测试而修改物理常量

---

## Spec-3：Implementation AI（实现 AI）

### 职责

- 在既定结构与常量约束下实现功能
- 不引入新概念、不修改权威定义

### 强制规则

- 所有物理数据必须通过 import 获取
- 不得在函数内部出现魔法数

### 失败条件

- 私自定义角度/周期/比例
- 在 Renderer 中进行物理推导

---

## Spec-4：Audit AI（审计 AI）

### 职责

- 只读代码
- 不允许写任何业务逻辑

### 审计清单

- [ ] 是否存在重复定义
- [ ] 是否出现单位不明确的数值
- [ ] 是否违反层分离
- [ ] 是否出现“为了看起来对”的调参

### 输出

- 只能输出：`PASS / FAIL + 理由`

---

## Spec-5：Single Source of Truth（SSOT）规范

### 目录规范

```
lib/astronomy/constants/
  ├── axialTilt.ts
  ├── physicalParams.ts
  ├── rotation.ts
  └── referenceFrames.ts
```

### 规则

- constants 目录只允许：
  - 常量
  - 冻结对象（Object.freeze）
- 禁止任何逻辑或条件分支

---

## Spec-6：Renderer 愚蠢化原则

### Renderer 允许接收

- 位置向量（km）
- 姿态矩阵 / Quaternion
- 已解析的可视参数

### Renderer 禁止

- 知道轴倾角的存在
- 使用角度或周期计算
- 知道参考系名称

---

## Spec-7：结构性失败处理流程

### 触发条件

- 同一物理问题被多次回滚
- 测试通过但视觉/数值不稳定

### 处理步骤

1. 冻结功能开发
2. 启动 Architecture Guardian
3. 合并或删除重复定义
4. 重新建立 SSOT

---

## Spec-8：AI 自检流程（Pre-Commit）

### 必答问题

- 我是否引入了新的定义点？
- 我是否理解该数值的单位与参考系？
- 这个计算是否属于渲染层？

> 任意问题无法回答 → 禁止提交

---

## 最终裁决原则

> **SolMap 的稳定性来自结构，而不是聪明实现。**

任何破坏结构的改动，
即使功能正确，**一律视为失败实现**。

