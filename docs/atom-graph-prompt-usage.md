# Atom Graph Prompt Tool - 使用指南

## 概述

OpenResearch 提供两个 Atom Graph Prompt 工具：

1. **`atom_graph_prompt`** (Phase 1) - 基础图遍历工具
2. **`atom_graph_prompt_smart`** (Phase 2) - 智能检索工具，支持自然语言查询 ✨

两个工具完全兼容，可根据需求选择使用。

---

## Phase 1: atom_graph_prompt

### 功能特性

- ✅ **多跳图遍历**：从起始 atom 开始，沿着关系边遍历指定深度
- ✅ **智能过滤**：支持按关系类型和 Atom 类型过滤
- ✅ **多种模板**：GraphRAG 风格（详细）和 Compact 风格（简洁）
- ✅ **自动推断**：可以从当前 session 自动推断起始 atom
- ✅ **灵活配置**：可控制是否包含 evidence 和 metadata

## 参数说明

| 参数              | 类型                      | 默认值       | 说明                 |
| ----------------- | ------------------------- | ------------ | -------------------- |
| `atomIds`         | `string[]?`               | 自动推断     | 起始 Atom IDs        |
| `maxDepth`        | `number`                  | 2            | 最大遍历深度（跳数） |
| `maxAtoms`        | `number`                  | 10           | 最多返回的 Atom 数量 |
| `relationTypes`   | `RelationType[]?`         | 全部         | 只遍历指定关系类型   |
| `atomTypes`       | `AtomType[]?`             | 全部         | 只包含指定 Atom 类型 |
| `template`        | `"graphrag" \| "compact"` | `"graphrag"` | Prompt 模板风格      |
| `includeEvidence` | `boolean`                 | `true`       | 是否包含 evidence    |
| `includeMetadata` | `boolean`                 | `true`       | 是否包含元数据       |

### 关系类型 (RelationType)

- `motivates` - A 激发/启发 B
- `formalizes` - A 形式化 B
- `derives` - A 推导出 B
- `analyzes` - A 分析 B
- `validates` - A 验证 B
- `contradicts` - A 与 B 矛盾
- `other` - 其他关系

### Atom 类型 (AtomType)

- `fact` - 事实声明
- `method` - 方法定义
- `theorem` - 理论证明
- `verification` - 实验验证

## 使用示例

### 示例 1: 基础使用

```typescript
// 从指定 atom 开始生成 prompt
const result = await agent.useTool("atom_graph_prompt", {
  atomIds: ["atom-123"],
  maxDepth: 2,
  maxAtoms: 10,
})

console.log(result.output) // 生成的 prompt
```

### 示例 2: 自动推断起始点

```typescript
// 从当前 session 绑定的 atom 开始
const result = await agent.useTool("atom_graph_prompt", {
  maxDepth: 3,
  template: "graphrag",
})
```

### 示例 3: 过滤特定类型

```typescript
// 只遍历验证和分析关系，只包含理论和验证类型的 atoms
const result = await agent.useTool("atom_graph_prompt", {
  atomIds: ["atom-456"],
  relationTypes: ["validates", "analyzes"],
  atomTypes: ["theorem", "verification"],
  maxDepth: 2,
})
```

### 示例 4: 使用 Compact 模板

```typescript
// 使用简洁模板，节省 tokens
const result = await agent.useTool("atom_graph_prompt", {
  atomIds: ["atom-789"],
  template: "compact",
  includeEvidence: false,
  includeMetadata: false,
  maxAtoms: 20,
})
```

## 输出格式

### GraphRAG 模板输出示例

```markdown
# Research Context Graph

You are analyzing a research project with the following knowledge atoms:

## Atoms (Knowledge Units)

### Atom 1: Transformer Architecture [method]

**Claim:**
The Transformer architecture uses self-attention mechanisms...

**Evidence:**
Experimental results show that...

**Metadata:**

- Type: method
- Distance from query: 0 hops
- Created: 2026-04-06T10:00:00.000Z

### Atom 2: Self-Attention Convergence [theorem]

**Claim:**
Under certain conditions, self-attention converges...

**Metadata:**

- Type: theorem
- Distance from query: 1 hops
- Created: 2026-04-06T11:00:00.000Z

## Relationships

- Transformer Architecture --[analyzes]--> Self-Attention Convergence

## Instructions

Based on the above research context graph, please analyze the relationships
between atoms and their types (fact/method/theorem/verification).
```

### Compact 模板输出示例

```markdown
Research Context:

1. [method] Transformer Architecture: The Transformer architecture uses self-attention mechanisms...
2. [theorem] Self-Attention Convergence: Under certain conditions, self-attention converges...

Relationships: Transformer Architecture->Self-Attention Convergence
```

## 返回值

```typescript
{
  title: "Generated prompt from 5 atom(s)",
  output: "# Research Context Graph\n...",
  metadata: {
    atomCount: 5,
    seedAtomIds: ["atom-123"],
    maxDepth: 2,
    template: "graphrag"
  }
}
```

## 使用场景

### 场景 1: 生成研究报告

```typescript
// 获取整个研究主题的上下文
const prompt = await agent.useTool("atom_graph_prompt", {
  atomIds: ["main-method-atom"],
  maxDepth: 3,
  maxAtoms: 20,
  template: "graphrag",
})

// 将 prompt 传给 LLM 生成报告
const report = await llm.complete(`${prompt.output}\n\nPlease generate a research report.`)
```

### 场景 2: 验证理论一致性

```typescript
// 只关注理论和验证部分
const prompt = await agent.useTool("atom_graph_prompt", {
  atomIds: ["theorem-atom-1"],
  atomTypes: ["theorem", "verification"],
  relationTypes: ["validates", "contradicts"],
  maxDepth: 2,
})

// 检查是否有矛盾
const analysis = await llm.complete(`${prompt.output}\n\nAre there any contradictions?`)
```

### 场景 3: 理解方法演化

```typescript
// 追踪方法的推导链
const prompt = await agent.useTool("atom_graph_prompt", {
  atomIds: ["base-method"],
  relationTypes: ["derives", "motivates"],
  maxDepth: 4,
  template: "compact",
})
```

## 性能考虑

- **小规模（< 20 atoms）**：响应时间 < 1秒
- **中规模（20-50 atoms）**：响应时间 < 3秒
- **大规模（> 50 atoms）**：建议使用 `maxAtoms` 限制数量

## 最佳实践

1. **合理设置深度**：通常 `maxDepth=2` 足够，过深会包含不相关内容
2. **使用过滤器**：通过 `relationTypes` 和 `atomTypes` 聚焦相关内容
3. **选择合适模板**：
   - 需要详细分析 → `graphrag`
   - Token 预算紧张 → `compact`
4. **控制数量**：使用 `maxAtoms` 避免超出 LLM 上下文窗口
5. **关闭不需要的内容**：如果不需要 evidence，设置 `includeEvidence: false`

## 工具对比

| 特性       | atom_graph_prompt (Phase 1) | atom_graph_prompt_smart (Phase 2) ✨ |
| ---------- | --------------------------- | ------------------------------------ |
| 查询方式   | 指定 atom ID                | atom ID + 自然语言查询               |
| 搜索方式   | 图遍历                      | 图遍历 + 语义搜索                    |
| 选择策略   | BFS 顺序                    | 智能评分 + 多样性                    |
| Token 管理 | 手动限制数量                | 自动预算管理                         |
| 适用场景   | 已知起点的探索              | 开放式问题查询                       |
| 性能       | 快速                        | 稍慢（需生成 embedding）             |

### 何时使用 Phase 1

- ✅ 已知具体的 atom ID
- ✅ 需要探索特定 atom 的邻域
- ✅ 不需要语义搜索
- ✅ 追求最快响应速度

### 何时使用 Phase 2

- ✅ 用自然语言提问
- ✅ 不确定从哪个 atom 开始
- ✅ 需要找到语义相关的内容
- ✅ 需要智能选择和排序
- ✅ 有严格的 token 预算限制

---

## Phase 2 高级特性

### 智能评分系统

Phase 2 使用 5 个维度对 atoms 进行综合评分：

1. **距离分数（25%）** - 图中距离查询点的跳数，越近越好
2. **类型分数（20%）** - Atom 类型重要性
   - theorem: 10 分（理论最重要）
   - method: 8 分
   - verification: 6 分
   - fact: 4 分
3. **语义相似度（30%）** - 与查询的语义相关性
4. **时间新近度（15%）** - 最新的研究进展优先
5. **关系链质量（10%）** - 遍历路径的关系类型质量
   - validates: 10 分（验证关系最重要）
   - analyzes: 9 分
   - derives: 8 分

**查看评分信息：**

```typescript
const result = await agent.useTool("atom_graph_prompt_smart", {
  query: "模型优化方法",
  maxAtoms: 10,
})

// 查看 top 5 的评分
console.log(result.metadata.topScores)
// [
//   { atomId: "atom-123", atomName: "SGD优化", score: "8.5" },
//   { atomId: "atom-456", atomName: "Adam算法", score: "7.8" },
//   ...
// ]
```

### Token 预算管理

Phase 2 自动管理 token 使用：

```typescript
// 设置严格预算
const result = await agent.useTool("atom_graph_prompt_smart", {
  query: "深度学习训练技巧",
  maxTokens: 3000, // 限制在 3000 tokens
  maxAtoms: 20, // 最多 20 个 atoms
})

// 系统会自动：
// 1. 估算每个 atom 的 token 数
// 2. 按分数排序
// 3. 贪心选择高价值 atoms
// 4. 如果预算不足，自动关闭 evidence
// 5. 确保不超过预算

console.log(result.metadata.tokensUsed) // 实际使用：2,850
console.log(result.metadata.budgetUsed) // 预算使用率：0.95
```

### Embedding 缓存

Phase 2 使用文件缓存存储 embeddings：

- **缓存位置**: `atom_list/.atom-embeddings-cache.json`
- **自动管理**: 首次使用时生成，后续从缓存读取
- **无需配置**: 完全自动化，无需手动管理
- **可扩展**: 易于替换为真实的 embedding API（OpenAI）

---

## 使用场景

### 场景 1: 文献综述

```typescript
// 查找特定主题的所有相关研究
const result = await agent.useTool("atom_graph_prompt_smart", {
  query: "Transformer 架构的改进方法",
  maxDepth: 3,
  maxAtoms: 20,
  atomTypes: ["method", "theorem"], // 只要方法和理论
  template: "graphrag",
})
```

### 场景 2: 问题解答

```typescript
// 回答具体的研究问题
const result = await agent.useTool("atom_graph_prompt_smart", {
  query: "如何解决梯度消失问题？",
  maxTokens: 4000,
  diversityWeight: 0.4, // 获取多样化的解决方案
})
```

### 场景 3: 验证理论一致性

```typescript
// 检查理论和验证结果
const result = await agent.useTool("atom_graph_prompt_smart", {
  atomIds: ["theorem-atom-1"],
  atomTypes: ["theorem", "verification"],
  relationTypes: ["validates", "contradicts"],
  maxDepth: 2,
})
```

### 场景 4: 追踪研究演化

```typescript
// 查看最新进展
const result = await agent.useTool("atom_graph_prompt_smart", {
  query: "注意力机制的最新研究",
  scoringWeights: {
    distance: 0.2,
    type: 0.2,
    semantic: 0.2,
    temporal: 0.3, // 重视时间新近度
    relationChain: 0.1,
  },
})
```

---

## 性能考虑

### Phase 1 性能

- **小规模（< 20 atoms）**：响应时间 < 1秒
- **中规模（20-50 atoms）**：响应时间 < 3秒
- **大规模（> 50 atoms）**：建议使用 `maxAtoms` 限制数量

### Phase 2 性能

- **首次查询**：需要生成 embeddings，稍慢（+1-2秒）
- **后续查询**：使用缓存，接近 Phase 1 速度
- **语义搜索**：在所有 atoms 中搜索，时间与 atom 总数相关
- **建议**：合理设置 `semanticTopK` 和 `maxAtoms` 参数

---

## 最佳实践

### Phase 1 最佳实践

1. **合理设置深度**：通常 `maxDepth=2` 足够，过深会包含不相关内容
2. **使用过滤器**：通过 `relationTypes` 和 `atomTypes` 聚焦相关内容
3. **选择合适模板**：
   - 需要详细分析 → `graphrag`
   - Token 预算紧张 → `compact`
4. **控制数量**：使用 `maxAtoms` 避免超出 LLM 上下文窗口
5. **关闭不需要的内容**：如果不需要 evidence，设置 `includeEvidence: false`

### Phase 2 最佳实践

1. **清晰的查询**：使用具体、明确的自然语言查询
2. **设置 token 预算**：明确指定 `maxTokens` 避免超出限制
3. **调整多样性**：根据需求调整 `diversityWeight`
   - 需要聚焦单一主题 → 0.1-0.2
   - 需要多样化视角 → 0.4-0.5
4. **自定义权重**：根据场景调整 `scoringWeights`
   - 查找最新研究 → 提高 `temporal` 权重
   - 理论分析 → 提高 `type` 权重
5. **混合使用**：结合 `query` 和 `atomIds` 获得最佳结果

---

## 故障排查

### Phase 1 常见问题

#### 问题：返回 "No atoms found"

**原因：**

- 提供的 `atomIds` 不存在
- 当前 session 未绑定到任何 atom
- 过滤条件太严格，没有匹配的 atoms

**解决：**

- 使用 `atom_query` 工具先查询可用的 atoms
- 放宽过滤条件
- 检查 session 绑定状态

#### 问题：生成的 prompt 太长

**解决：**

- 减小 `maxDepth` 或 `maxAtoms`
- 使用 `compact` 模板
- 设置 `includeEvidence: false`
- 使用更严格的过滤条件

#### 问题：缺少重要的 atoms

**解决：**

- 增加 `maxDepth`
- 增加 `maxAtoms`
- 检查关系是否正确建立
- 移除过滤条件

### Phase 2 常见问题

#### 问题：语义搜索结果不相关

**原因：**

- 查询表述不够清晰
- 相似度阈值太低
- Atom 的 claim 内容与查询主题不匹配

**解决：**

- 使用更具体、明确的查询
- 提高 `semanticThreshold`（如 0.6 或 0.7）
- 结合 `atomTypes` 过滤器缩小范围
- 使用 `atomIds` 指定起点

#### 问题：Token 预算超限

**解决：**

- 设置 `maxTokens` 参数
- 减少 `maxAtoms`
- 使用 `compact` 模板
- 设置 `includeEvidence: false`

#### 问题：首次查询很慢

**原因：**

- 需要为 atoms 生成 embeddings

**解决：**

- 这是正常现象，embeddings 会被缓存
- 后续查询会快很多
- 可以预先生成常用 atoms 的 embeddings

#### 问题：评分结果不符合预期

**解决：**

- 自定义 `scoringWeights` 调整评分策略
- 检查 `diversityWeight` 设置
- 查看 `metadata.topScores` 了解评分详情
- 调整 `semanticThreshold` 过滤低相关度结果

---

## 反馈

如有问题或建议，请在项目中提出 Issue。

---

## 更新日志

### 2026-04-07 - Phase 2 发布 ✨

- ✨ 新增 `atom_graph_prompt_smart` 工具
- ✨ 支持自然语言查询
- ✨ 智能评分系统（5维度）
- ✨ Token 预算管理
- ✨ 语义搜索和混合检索
- ✅ 完全兼容 Phase 1

### 2026-04-06 - Phase 1 发布

- ✅ 基础图遍历功能
- ✅ GraphRAG 和 Compact 模板
- ✅ 关系和类型过滤
- ✅ 自动推断起始点
