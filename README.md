# Palimpsest

**Palimpsest 把推理过程转化为可复用的资产。**

English version: [README.en.md](./README.en.md)

Palimpsest 是：

- 纯 Web 产品
- Linux server 优先的平台
- 基于 workspace 的多用户系统
- 以 domain core 为中心的协作产品
- 只有一套扩展模型的插件化系统

它**不是**：

- 桌面应用
- TUI 优先的 shell
- IDE 插件产品
- 纯研究场景的应用
- "OpenCode 加研究补丁"

## 唯一事实来源

[`specs/`](./specs) 目录是实现契约。未写入 specs 的内容，就不是仓库承诺的行为。

五份 spec：

- [`specs/product.md`](./specs/product.md) —— 产品身份、核心承诺、运行时边界、
  成功标准
- [`specs/domain.md`](./specs/domain.md) —— 权威的 domain 层（实体、表、操作、
  session 附着、分享、权限）
- [`specs/plugin.md`](./specs/plugin.md) —— 唯一扩展系统（manifest、preset、
  lens、server hook、web 归属、workflow）
- [`specs/ui.md`](./specs/ui.md) —— UI 外壳（路由、workbench tab、对象工作区、
  session 页、上下文工具）
- [`specs/graph-workbench-pattern.md`](./specs/graph-workbench-pattern.md)
  —— 图形镜头共用的 graph workbench 原语

每一份 spec 的每一节都严格拆成 **Current reality** 与 **Intended direction**
两栏：Current reality 的断言必须 cite 具体代码，Intended direction 明确指出
待补的缺口。格式规则与 spec = test 纪律见
[`specs/README.md`](./specs/README.md)。

若代码与 specs 冲突，以 specs 为准。

## 产品词汇

Palimpsest 围绕以下对象：

- Workspace
- Project
- Node
- Run
- Artifact
- Decision
- Proposal
- Review
- Commit

面向用户的稳定动作是：

- Ask
- Propose
- Review
- Run
- Inspect

## 当前产品形态

Palimpsest 已足够接近目标架构，可用的心智模型是：

1. 打开一个 project
2. 在 workbench tab（如 `Nodes` / `Runs` / `Artifacts` / `Decisions` /
   `Reviews`）之间移动
3. 打开 proposal / node / run / decision 的对象工作区
4. 把文件 / 终端 / diff / 日志 / review 当作上下文工具使用
5. 通过 proposal、commit、decision、share、export 保留推理的来源链

剩余主要缺口是外壳一致性、最后的归属清理、协作面细节打磨，不是缺核心架构。

## 本地开发

当前包布局：

- server：`apps/server`
- web app：`apps/web`
- domain：`packages/domain`
- runner：`packages/runner`
- 内建插件：`plugins/{core,research,security-audit}`

本地开发入口见 [README.quick-start.md](./README.quick-start.md)。
