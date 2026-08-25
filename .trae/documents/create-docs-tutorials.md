# 计划：LangChain TypeScript 新手教程

## Summary

以 LangChain 知识体系为主线，在 `docs/` 目录下编写一套完整的新手教程。教程按照学习逻辑组织章节，现有 `src/` 下的代码仅作为实战案例嵌入到对应知识点中。每个章节末尾附本节小结。

---

## Current State

- 项目有 11 个示例文件，涵盖 LangChain TS 核心功能
- `docs/` 目录不存在
- 需要以教学为目的重新组织内容，而非逐文件翻译注释

---

## 教程章节规划

```
docs/
├── README.md                 # 教程导读 + 环境准备 + 学习路线
├── 01-quickstart.md          # 快速开始：你的第一个 LLM 应用
├── 02-prompt-engineering.md  # 提示词工程：模板与变量
├── 03-lcel.md                # LCEL：用管道组装 AI 应用
├── 04-output-parsing.md      # 输出解析：让 LLM 返回结构化数据
├── 05-streaming.md           # 流式输出：打造打字机体验
├── 06-tools.md               # 工具调用：让 LLM 连接外部世界
├── 07-memory.md              # 对话记忆：让 LLM 记住上下文
├── 08-rag.md                 # RAG：让 LLM 基于你的文档回答
└── 09-advanced.md            # 进阶：中间件、回调与生产实践
```

共 10 个文件。从 11 个示例文件中提取内容，按知识体系重新组织。

---

## 各章节详细规划

### `README.md` — 教程导读
- 这套教程是什么、适合谁
- 环境准备（Node.js 22+、npm install、配置 .env）
- 学习路线图表格（章节、核心知识点、涉及示例文件、难度）
- LangChain 生态简介（@langchain/core、langchain、@langchain/openai 的关系）

**涉及示例**：`config.ts`（环境配置说明）

---

### `01-quickstart.md` — 快速开始
- LLM 应用的基本架构：输入 → 处理 → 输出
- 创建模型实例：`createMimoModel()` 的原理
- 调用模型：`.invoke()` 方法
- 消息类型：SystemMessage / HumanMessage / AIMessage
- 多轮对话上下文的传递方式
- Token 概念与计费
- 动手练习：修改 system prompt 观察行为变化

**涉及示例**：`01_chat_model.ts`

---

### `02-prompt-engineering.md` — 提示词工程
- 为什么需要模板（vs 字符串拼接）
- `PromptTemplate`：简单字符串模板
- `ChatPromptTemplate`：对话格式模板（推荐）
- 模板变量与 `formatMessages()`
- Prompt Engineering 基本原则（清晰、具体、给示例）
- 模板 + 模型 = 完整链（`.pipe()` 初体验）

**涉及示例**：`02_prompt_template.ts`

---

### `03-lcel.md` — LCEL 管道
- LCEL 是什么：LangChain Expression Language
- `.pipe()` 的本质：数据从左到右流动
- 构建链：prompt → model → parser
- 多步骤链：串联多个处理步骤
- `batch()` 批量并行调用
- Zod schema：TypeScript 的数据验证利器（对比 Pydantic）
- LCEL 的核心优势：统一接口、自动并行、流式支持

**涉及示例**：`03_lcel_chain.ts`

---

### `04-output-parsing.md` — 输出解析
- 为什么 LLM 输出需要解析
- `StringOutputParser`：提取纯文本
- `CommaSeparatedListOutputParser`：输出为数组
- `JsonOutputParser`：输出为 JSON 对象
- `getFormatInstructions()` 自动注入格式要求
- 结构化输出进阶：Zod + JsonOutputParser 校验
- `withStructuredOutput()`：OpenAI 原生方案（对比）

**涉及示例**：`04_output_parser.ts`, `06_structured_output.ts`

---

### `05-streaming.md` — 流式输出
- 为什么需要流式（用户体验、感知延迟）
- `model.stream()`：模型级流式
- `chain.stream()`：链级流式（推荐）
- `AsyncIterable` 与 `for await...of`
- 收集 chunk 合并为完整结果
- 前端集成思路（SSE、WebSocket）

**涉及示例**：`05_streaming.ts`

---

### `06-tools.md` — 工具调用
- 什么是 Tool Calling：让 LLM 触发外部操作
- 定义工具：`tool()` + Zod schema
- 绑定工具：`bindTools()`
- 工具调用流程：模型决定 → 执行 → 反馈
- 多工具协作：模型自动选择
- ReAct 循环：自动循环调用工具
- 错误处理与优雅降级
- LCEL 链中的工具集成

**涉及示例**：`07_tools_and_agent.ts`, `10_tool_calling_chain.ts`

---

### `07-memory.md` — 对话记忆
- LLM 的无状态本质
- "记忆"的原理：把历史消息一起发给模型
- 手动管理 chatHistory 数组
- 多轮对话的上下文传递
- 记忆策略：全量 vs 滑动窗口 vs 摘要
- LangGraph MemorySaver 简介（生产推荐）

**涉及示例**：`08_memory.ts`

---

### `08-rag.md` — RAG 检索增强生成
- RAG 是什么：检索 + 生成
- RAG 工作流：文档 → 分块 → 向量化 → 检索 → 生成
- `Document` 对象
- `RecursiveCharacterTextSplitter` 文本分割
- 检索器实现（关键词 vs 向量）
- 构建 RAG 链：context + question → LLM → 回答
- RAG vs Fine-tuning 的选择

**涉及示例**：`09_rag.ts`

---

### `09-advanced.md` — 进阶：中间件与回调
- 回调系统：LangChain 的"中间件"
- `BaseCallbackHandler`：自定义回调处理器
- 函数式回调：`BaseCallbackHandler.fromMethods()`
- `RunnableLambda`：函数式中间件
- 性能监控实践
- 综合示例：校验 → 处理 → 监控 → 响应

**涉及示例**：`11_middleware.ts`

---

## 图表说明

在涉及调用链、数据流、架构的章节中使用 **Mermaid 流程图**，帮助读者直观理解。

需要加图的位置：

| 章节 | 图表内容 |
|------|----------|
| 01-quickstart | LLM 应用基本架构：输入 → 模型 → 输出 |
| 02-prompt-engineering | 模板变量填充流程：模板 + 变量 → 格式化消息 → 模型 |
| 03-lcel | **核心图**：`.pipe()` 管道数据流（prompt → model → parser）、多步骤链、batch 并行 |
| 04-output-parsing | 解析器在链中的位置：model → parser → 结构化数据 |
| 05-streaming | 流式 chunk 传输过程 |
| 06-tools | **核心图**：Tool Calling 完整流程（用户 → 模型 → 工具执行 → 结果反馈 → 模型 → 回答）、ReAct 循环 |
| 07-memory | 多轮对话消息传递：历史消息 + 新消息 → 模型 |
| 08-rag | **核心图**：RAG 架构（文档 → 分块 → 向量化 → 存储 / 提问 → 检索 → 拼接 → 生成） |
| 09-advanced | 中间件链路：请求 → 校验 → 预处理 → 模型 → 后处理 → 响应 |

示例 Mermaid 格式：
```mermaid
flowchart LR
    A[用户输入] --> B[Prompt 模板]
    B --> C[LLM 模型]
    C --> D[输出解析器]
    D --> E[结构化结果]
```

---

## 每个教程的统一模板

```markdown
# 第 N 节：标题

> 一句话概括本节核心价值

## 简介
本节主题、为什么重要、学完能做什么。

## 核心概念
知识点讲解（配合小代码片段说明概念，非完整示例）。
涉及流程/架构时，用 Mermaid 图辅助说明。

## 实战
完整代码案例（从示例文件提取关键部分），逐段解释。

### 运行方式
npm run XX 的命令和预期输出说明。

## 进阶补充（可选）
更深入的知识、常见陷阱、最佳实践。

## 本节小结
- 3-5 条要点回顾
- 学到这里你应该掌握了什么
- 下一步预告
```

---

## 实施步骤

| Step | 操作 | 文件 |
|------|------|------|
| 1 | 编写 README.md | `docs/README.md` |
| 2 | 编写 01-quickstart.md | `docs/01-quickstart.md` |
| 3 | 编写 02-prompt-engineering.md | `docs/02-prompt-engineering.md` |
| 4 | 编写 03-lcel.md | `docs/03-lcel.md` |
| 5 | 编写 04-output-parsing.md | `docs/04-output-parsing.md` |
| 6 | 编写 05-streaming.md | `docs/05-streaming.md` |
| 7 | 编写 06-tools.md | `docs/06-tools.md` |
| 8 | 编写 07-memory.md | `docs/07-memory.md` |
| 9 | 编写 08-rag.md | `docs/08-rag.md` |
| 10 | 编写 09-advanced.md | `docs/09-advanced.md` |

---

## Assumptions & Decisions

1. **知识体系优先**：章节按学习逻辑排列，不按文件编号一一对应
2. **04 和 06 合并**：`04_output_parser.ts` 和 `06_structured_output.ts` 同属"输出解析"主题，合并为一章
3. **07 和 10 合并**：`07_tools_and_agent.ts` 和 `10_tool_calling_chain.ts` 同属"工具调用"主题，合并为一章
4. **中文编写**：API 名称保留英文
5. **不修改源代码**：仅创建文档
6. **代码嵌入方式**：教程中展示关键代码片段并解释，不逐行贴完整文件

---

## Verification

1. 确认 `docs/` 下共 10 个 `.md` 文件
2. 每个教程包含"本节小结"
3. 代码片段与 `src/` 实际代码一致
4. README.md 学习路线图链接正确
