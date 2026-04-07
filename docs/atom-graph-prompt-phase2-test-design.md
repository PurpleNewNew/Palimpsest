# Phase 2 测试用例设计文档

## 测试策略

Phase 2 引入了 5 个新模块，需要全面的测试覆盖：

1. Embedding 系统
2. 评分系统
3. Token 预算管理
4. 混合检索策略
5. Smart Tool 集成

---

## 1. Embedding 系统测试

### 1.1 基础功能测试

**测试用例：should generate and cache embeddings**

- 目标：验证 embedding 生成和缓存机制
- 步骤：
  1. 生成文本的 embedding
  2. 验证维度为 384
  3. 验证缓存中存在
  4. 再次获取，验证从缓存读取
- 预期：embedding 正确生成并缓存

**测试用例：should calculate cosine similarity correctly**

- 目标：验证余弦相似度计算
- 步骤：
  1. 生成两个相似文本的 embeddings
  2. 计算相似度
- 预期：相似文本相似度 > 0.5

**测试用例：should distinguish different topics**

- 目标：验证能区分不同主题
- 步骤：
  1. 生成不同主题文本的 embeddings
  2. 计算相似度
- 预期：不同主题相似度 < 0.7

**测试用例：should persist cache to file**

- 目标：验证缓存持久化
- 步骤：
  1. 生成 embedding 并保存
  2. 重新加载缓存
- 预期：缓存正确持久化和加载

### 1.2 边界情况测试

- 空文本处理
- 超长文本处理
- 特殊字符处理
- 中英文混合文本

---

## 2. 评分系统测试

### 2.1 单维度评分测试

**测试用例：should score atoms based on distance**

- 验证距离分数计算
- 距离 0 应得高分，距离增加分数降低

**测试用例：should score atoms based on type**

- 验证类型分数计算
- theorem > method > verification > fact

**测试用例：should score atoms based on semantic similarity**

- 验证语义相似度分数
- 相似内容得高分

**测试用例：should score atoms based on temporal**

- 验证时间新近度分数
- 最近创建的得高分

**测试用例：should score atoms based on relation chain**

- 验证关系链质量分数
- validates > analyzes > derives

### 2.2 综合评分测试

**测试用例：should rank atoms by综合 score**

- 验证多维度综合评分
- 按分数降序排列

**测试用例：should apply custom weights**

- 验证自定义权重
- 不同权重产生不同排序

### 2.3 多样性选择测试

**测试用例：should select diverse atoms**

- 验证 MMR 算法
- 选择的 atoms 类型和距离多样化

---

## 3. Token 预算管理测试

### 3.1 Token 估算测试

**测试用例：should estimate tokens for English text**

- 验证英文 token 估算
- 约 4 字符 = 1 token

**测试用例：should estimate tokens for Chinese text**

- 验证中文 token 估算
- 约 1.5 字符 = 1 token

**测试用例：should estimate tokens for mixed text**

- 验证中英文混合估算

**测试用例：should estimate tokens for code blocks**

- 验证代码块估算
- 约 3 字符 = 1 token

### 3.2 预算选择测试

**测试用例：should select atoms within budget**

- 验证在预算内选择 atoms
- 总 tokens 不超过限制

**测试用例：should prioritize high-score atoms**

- 验证优先选择高分 atoms
- 预算不足时选择最有价值的

**测试用例：should respect token budget strictly**

- 验证严格遵守预算
- 即使有更多 atoms 也不超预算

### 3.3 自适应调整测试

**测试用例：should adaptively adjust content**

- 验证自适应内容调整
- 预算不足时自动关闭 evidence

---

## 4. 混合检索策略测试

### 4.1 纯语义搜索测试

**测试用例：should find atoms by semantic query**

- 验证语义搜索功能
- 找到语义相关的 atoms

**测试用例：should respect semantic threshold**

- 验证相似度阈值
- 只返回超过阈值的结果

**测试用例：should return top K results**

- 验证 topK 参数
- 返回指定数量的结果

### 4.2 纯图遍历测试

**测试用例：should traverse graph without query**

- 验证纯图遍历模式
- Phase 1 兼容性

### 4.3 混合模式测试

**测试用例：should combine semantic and graph traversal**

- 验证混合检索
- 从语义搜索结果开始图遍历

**测试用例：should merge and deduplicate results**

- 验证结果合并去重
- 无重复 atoms

**测试用例：should apply scoring to merged results**

- 验证对合并结果评分
- 综合考虑语义和图结构

---

## 5. Smart Tool 集成测试

### 5.1 基础功能测试

**测试用例：should work with semantic query**

- 验证自然语言查询
- 返回相关 atoms

**测试用例：should work with atom IDs**

- 验证从指定 IDs 开始
- Phase 1 兼容

**测试用例：should work with token budget**

- 验证 token 预算管理
- 遵守预算限制

### 5.2 参数组合测试

**测试用例：should work with query + atomIds**

- 验证混合起始点
- 语义搜索 + 指定 IDs

**测试用例：should work with all filters**

- 验证所有过滤器
- relationTypes + atomTypes + semanticThreshold

### 5.3 元数据测试

**测试用例：should provide scoring information**

- 验证返回评分信息
- topScores 字段

**测试用例：should provide search statistics**

- 验证搜索统计
- fromSemanticSearch, fromGraphTraversal

**测试用例：should provide token usage**

- 验证 token 使用信息
- tokensUsed, budgetUsed

---

## 6. 性能测试

### 6.1 响应时间测试

**测试用例：should complete within 3 seconds**

- 小规模（< 20 atoms）< 1秒
- 中规模（20-50 atoms）< 3秒

### 6.2 缓存效率测试

**测试用例：should reuse cached embeddings**

- 第二次查询更快
- 缓存命中率 > 80%

### 6.3 内存使用测试

**测试用例：should not leak memory**

- 多次查询后内存稳定
- 缓存大小可控

---

## 7. 集成测试

### 7.1 端到端测试

**测试用例：complete workflow test**

- 创建 atoms → 语义查询 → 图遍历 → 评分 → 预算管理 → 生成 prompt
- 验证完整流程

### 7.2 真实场景测试

**测试用例：research question answering**

- 场景：用户提问"如何提升模型训练稳定性？"
- 验证：找到相关的 method 和 theorem atoms

**测试用例：literature review**

- 场景：查找特定主题的所有相关研究
- 验证：覆盖率和相关性

---

## 8. 回归测试

### 8.1 Phase 1 兼容性测试

**测试用例：should maintain Phase 1 compatibility**

- 所有 Phase 1 测试用例仍然通过
- atom_graph_prompt tool 功能不变

### 8.2 向后兼容测试

**测试用例：should work without embeddings**

- 首次使用时自动生成
- 不依赖预先存在的缓存

---

## 测试覆盖率目标

| 模块                       | 目标覆盖率 |
| -------------------------- | ---------- |
| embedding.ts               | > 85%      |
| scoring.ts                 | > 90%      |
| token-budget.ts            | > 85%      |
| hybrid.ts                  | > 80%      |
| atom-graph-prompt-smart.ts | > 85%      |
| **总体**                   | **> 85%**  |

---

## 测试数据准备

### 标准测试数据集

创建包含以下内容的测试数据：

- 5 个 fact atoms（背景知识）
- 3 个 method atoms（方法）
- 2 个 theorem atoms（理论）
- 3 个 verification atoms（验证）
- 关系：motivates, analyzes, validates

### 测试查询

准备标准查询：

1. "machine learning optimization"
2. "neural network convergence"
3. "training stability improvement"
4. "model performance evaluation"

---

## 测试执行计划

### 阶段 1：单元测试（优先）

- Embedding 系统（4 个测试）
- 评分系统（6 个测试）
- Token 预算（6 个测试）

### 阶段 2：集成测试

- 混合检索（6 个测试）
- Smart Tool（6 个测试）

### 阶段 3：性能和回归测试

- 性能测试（3 个测试）
- 兼容性测试（2 个测试）

**总计：约 33 个测试用例**

---

## 测试工具和框架

- **测试框架**：Bun Test
- **断言库**：expect (内置)
- **测试隔离**：tmpdir fixture
- **数据库**：SQLite (测试实例)

---

## 成功标准

✅ 所有测试用例通过  
✅ 代码覆盖率 > 85%  
✅ 无内存泄漏  
✅ 性能达标（< 3秒）  
✅ Phase 1 兼容性保持

---

## 下一步

1. 实现阶段 1 的单元测试（优先）
2. 修复发现的 bug
3. 实现阶段 2 的集成测试
4. 性能优化和调优
5. 完整的测试报告

这个测试设计确保 Phase 2 的质量和可靠性！
