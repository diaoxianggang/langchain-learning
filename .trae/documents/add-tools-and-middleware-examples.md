# 计划：增加 Tool 和中间件示例代码

## 概述

在现有 `langchain-ts-examples` 教学项目中新增两个示例文件，分别演示进阶工具用法和中间件/回调机制。遵循现有项目的文件编号、注释风格和代码模式。

---

## 当前状态分析

- 项目已有 `07_tools_and_agent.ts`，演示了**基础工具定义**（Zod schema + `tool()`）、`bindTools()` 绑定模型、单次 tool_calling
- 项目**没有中间件/回调**的示例
- 所有示例文件遵循统一模式：顶部 JSDoc 注释 → `async function main()` → `main().catch(console.error)`
- 模型通过 `createMimoModel()` 统一创建，ESM 模块需 `.js` 后缀
- 已安装依赖：`@langchain/core`、`@langchain/openai`、`langchain`、`zod`

---

## 变更方案

### 变更 1：新建 `src/10_tool_calling_chain.ts`

**目的**：演示工具在 LCEL 链中的完整使用模式，补充 07 中未覆盖的场景。

**内容包括**：

1. **工具 + LCEL 链集成** — 将 `bindTools` 后的模型放入 `.pipe()` 链中，展示工具在链式调用中的工作方式
2. **自动执行工具的循环模式** — 模拟一个简化版 ReAct 循环：模型调用工具 → 执行工具 → 将结果反馈给模型 → 模型生成最终回答（无需 `@langchain/langgraph`）
3. **多工具选择** — 定义 3+ 个工具，演示模型根据问题自主选择不同工具
4. **工具错误处理** — 工具执行失败时的优雅降级策略

**为什么新建文件而非修改 07**：项目约定每个文件独立聚焦一个主题，07 已完成其教学目标（基础概念），进阶用法应独立展示。

### 变更 2：新建 `src/11_middleware.ts`

**目的**：演示 LangChain 中的中间件模式，包括回调系统和自定义 Runnable。

**内容包括**：

1. **自定义回调处理器** — 继承 `BaseCallbackHandler`，实现 `handleChainStart`、`handleChainEnd`、`handleLLMStart`、`handleLLMEnd` 等方法，用于日志追踪
2. **通过 RunnableConfig 传递回调** — 在 `chain.invoke(input, { callbacks: [...] })` 中注入回调
3. **RunnableLambda 作为中间件** — 用 `RunnableLambda` 包装链的前后处理逻辑（输入校验、输出格式化），模拟中间件拦截模式
4. **链的执行耗时统计** — 用回调实现一个简单的性能计时中间件

### 变更 3：更新 `package.json`

添加两个 npm scripts：
```json
"10": "tsx src/10_tool_calling_chain.ts",
"11": "tsx src/11_middleware.ts"
```

---

## 具体文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/10_tool_calling_chain.ts` | 新建 | 进阶工具示例：LCEL 链集成 + 自动工具循环 + 多工具选择 + 错误处理 |
| `src/11_middleware.ts` | 新建 | 中间件示例：自定义回调 + RunnableConfig + RunnableLambda + 耗时统计 |
| `package.json` | 编辑 | 添加 `"10"` 和 `"11"` scripts |

---

## 假设与决策

- **不修改现有 `07_tools_and_agent.ts`**：保持现有文件不变，进阶内容放在新文件中
- **不引入新依赖**：所有功能使用已安装的 `@langchain/core` 和 `langchain` 中的 API 实现（`BaseCallbackHandler`、`RunnableLambda`、`RunnableConfig` 等均已包含）
- **MIMO 模型 tool calling 能力**：`07` 文件已验证 MIMO 支持 `bindTools`，新文件沿用相同模式；若 MIMO 不支持多轮 tool calling，将使用手动循环实现

---

## 验证步骤

1. `npm run 10` — 验证工具链示例正常运行，输出工具调用和结果
2. `npm run 11` — 验证中间件示例正常运行，输出回调日志和耗时信息
3. 检查 TypeScript 编译无报错：`npx tsc --noEmit`
