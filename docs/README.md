# LangChain TypeScript 新手教程

## 教程简介

本教程面向希望使用 TypeScript 构建 LLM 应用的开发者。通过 15 个渐进式章节，你将从零掌握 LangChain 的核心概念与实战技巧，并进一步学习个人知识库项目使用的两大关键基础设施：**Hono 后端框架**与 **Prisma ORM**。每个 LangChain 示例都是独立可运行的 `.ts` 文件；每个后端教程都结合了本项目 `src/real-project-combat/` 中的真实实现，配有详细中文讲解，方便边学边练。

**适合人群：**
- 有 TypeScript 基础，想了解 LLM 应用开发的前端/全栈工程师
- 熟悉 Python LangChain，希望迁移到 TypeScript 生态的开发者
- 需要在 Node.js / Bun 服务中集成大模型能力，并希望构建 REST/SSE API 的后端工程师
- 想把个人/团队文档沉淀为"向量知识库 + 问答系统"的读者

## LangChain 生态概览

LangChain TypeScript 生态由三个核心包组成：

| 包名 | 定位 | 包含内容 |
|------|------|----------|
| `@langchain/core` | 基础抽象层 | `BaseChatModel`、`Runnable` 接口、消息类型、输出解析器基类等。所有其他包都依赖它 |
| `langchain` | 编排层 | Agent、Chain、通用工具函数（如 `initChatModel`）。负责将核心组件串联成完整的工作流 |
| `@langchain/openai` | 模型提供商集成 | OpenAI 兼容 API 的具体实现。本教程使用的 MIMO 模型通过此包接入 |

**依赖关系：**

```
@langchain/openai  -->  @langchain/core
langchain          -->  @langchain/core
```

简而言之：`@langchain/core` 定义接口，`@langchain/openai` 提供实现，`langchain` 负责编排。

## 环境准备

### 1. 安装 Node.js

确保 Node.js 版本 >= 22：

```bash
node -v
```

### 2. 安装依赖

```bash
npm install
```

项目依赖一览：

| 依赖 | 用途 |
|------|------|
| `@langchain/core` | LangChain 核心抽象 |
| `langchain` | Agent、Chain、通用工具 |
| `@langchain/openai` | OpenAI 兼容 API 集成 |
| `@langchain/textsplitters` | 文本分块（RAG 示例使用） |
| `zod` | Schema 定义（结构化输出使用） |
| `dotenv` | 加载 `.env` 环境变量 |

### 3. 配置 API Key

在项目根目录的 `.env` 文件中配置：

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://your-api-endpoint/v1
MIMO_MODEL=mimo-v2.5-pro
```

### 4. 关于 `config.ts`

所有示例文件共享 `src/config.ts` 中的模型配置，它使用 `initChatModel` 函数初始化模型：

```typescript
import { initChatModel } from "langchain/chat_models/universal";

export async function createMimoModel(temperature = 0.7, maxTokens = 2048) {
  return await initChatModel(process.env.MIMO_MODEL || "mimo-v2.5-pro", {
    modelProvider: "openai",
    temperature,
    maxTokens,
  });
}
```

`initChatModel` 会自动从 `.env` 读取 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL`，无需在代码中硬编码密钥。即使你使用的不是 OpenAI 官方模型，只要 API 格式兼容，都可以通过此方式接入。

## 学习路线

| 章节 | 核心知识点 | 涉及示例/文件 | 难度 |
|------|-----------|-------------|------|
| [第1节 快速开始](./01-quickstart.md) | Chat Model, 消息类型, Token | `src/01_chat_model.ts` | 初级 |
| [第2节 提示词工程](./02-prompt-engineering.md) | PromptTemplate, ChatPromptTemplate | `src/02_prompt_template.ts` | 初级 |
| [第3节 LCEL 管道](./03-lcel.md) | `.pipe()`, `batch()`, Zod | `src/03_lcel_chain.ts` | 初级 |
| [第4节 输出解析](./04-output-parsing.md) | OutputParser, 结构化输出 | `src/04_output_parser.ts`, `src/06_structured_output.ts` | 中级 |
| [第5节 流式输出](./05-streaming.md) | `stream()`, AsyncIterable | `src/05_streaming.ts` | 中级 |
| [第6节 工具调用](./06-tools.md) | `tool()`, `bindTools()`, ReAct | `src/07_tools_and_agent.ts`, `src/10_tool_calling_chain.ts` | 中级 |
| [第7节 对话记忆](./07-memory.md) | 消息历史管理 | `src/08_memory.ts` | 中级 |
| [第8节 RAG](./08-rag.md) | Document, TextSplitter, 检索 | `src/09_rag.ts` | 高级 |
| [第9节 进阶](./09-advanced.md) | 中间件, 回调, RunnableLambda | `src/11_middleware.ts` | 高级 |
| [第10节 智能代理](./10-agent.md) | Agent, ReAct, 多步推理, 对话记忆 | `src/12_agent.ts`, `src/13_agent_createAgent.ts` | 高级 |
| — | — | **以下为个人知识库项目的支撑技术（结合实际代码讲解）** | — |
| [第14节 Hono](./14-hono.md) | 轻量化后端、路由模块化、SSE 流式、Bun.serve | `src/real-project-combat/server/app.ts`、`server/routes/*` | 中级 |
| [第15节 Prisma ORM](./15-prisma.md) | schema.prisma、Prisma Client、CRUD/聚合、与 pg 共存 | `prisma/schema.prisma`、`server/services/prisma.ts`、`documentRegistry.ts` | 中级 |

建议按顺序学习。初级部分介绍了 LangChain 的基础构建块；中级部分展示如何组合这些构建块完成实际任务，以及如何把能力通过 Hono 暴露为 API；高级部分涉及生产环境中常见的架构模式、RAG 检索增强和 Agent 智能代理，最后用 Prisma ORM 把文档元数据沉淀到 PostgreSQL。

---

## 完整目录索引

### 第1节：快速开始 — 你的第一个 LLM 应用

> [查看教程](./01-quickstart.md) | 运行示例：`npm run 01`

| 章节 | 内容 |
|------|------|
| 简介 | LLM 应用的基本架构：输入 → 模型 → 输出 |
| 核心概念 | Chat Model vs Completion Model |
| | 创建模型实例：`initChatModel` |
| | `.invoke()` 方法 |
| | 消息类型：SystemMessage / HumanMessage / AIMessage |
| | 多轮对话上下文 |
| | Token 概念与计费 |
| 整体流程 | Mermaid 流程图 |
| 实战 | 简单调用、角色控制、多轮上下文、Token 查看 |
| 进阶补充 | "多轮对话不是真正记忆"的本质 |

---

### 第2节：提示词工程 — 模板与变量

> [查看教程](./02-prompt-engineering.md) | 运行示例：`npm run 02`

| 章节 | 内容 |
|------|------|
| 简介 | 字符串拼接的问题，为什么需要模板 |
| 核心概念 | `PromptTemplate`：简单字符串模板 |
| | `ChatPromptTemplate`：对话格式模板（推荐） |
| | 模板变量与 `formatMessages()` |
| | Prompt Engineering 基本原则 |
| | `.pipe()` 初体验 |
| 实战 | 翻译模板、角色扮演模板、模板+模型调用 |
| 进阶补充 | Python vs TS 对比、Few-shot Prompting |

---

### 第3节：LCEL — 用管道组装 AI 应用

> [查看教程](./03-lcel.md) | 运行示例：`npm run 03`

| 章节 | 内容 |
|------|------|
| 简介 | LCEL 的定义和存在原因 |
| 核心概念 | `.pipe()` 的本质：数据从左到右流动 |
| | Runnable 接口：统一的 invoke/stream/batch |
| | StringOutputParser：提取纯文本 |
| | 多步骤链：生成 → 翻译 |
| | `batch()` 批量并行调用 |
| | Zod schema：TypeScript 数据验证 |
| | LCEL 三大优势 |
| 流程图解 | 基础链、多步骤链、batch 并行 |
| 实战 | 基础链、多步骤链、批量调用、Zod 验证 |
| 进阶补充 | Python `|` vs TS `.pipe()` 对比 |

---

### 第4节：输出解析 — 让 LLM 返回结构化数据

> [查看教程](./04-output-parsing.md) | 运行示例：`npm run 04` / `npm run 06`

| 章节 | 内容 |
|------|------|
| 简介 | 为什么 LLM 输出需要解析 |
| 核心概念 | `StringOutputParser`：提取纯文本 |
| | `CommaSeparatedListOutputParser`：输出为数组 |
| | `JsonOutputParser`：输出为 JSON 对象 |
| | 结构化输出与 Zod 校验 |
| | `withStructuredOutput()`：OpenAI 原生方案 |
| 流程图解 | 解析器在链中的位置 |
| 实战 | 三种 Parser 示例、Zod 校验、withStructuredOutput |
| 进阶补充 | 何时使用哪种解析器、对比表 |

---

### 第5节：流式输出 — 打造打字机体验

> [查看教程](./05-streaming.md) | 运行示例：`npm run 05`

| 章节 | 内容 |
|------|------|
| 简介 | 为什么需要流式（用户体验、感知延迟） |
| 核心概念 | `model.stream()`：模型级流式 |
| | `chain.stream()`：链级流式（推荐） |
| | `process.stdout.write()` 打字机效果 |
| | 收集 chunk 合并为完整结果 |
| | 前端集成方式（SSE/WebSocket） |
| 流程图解 | 流式数据流动、模型级 vs 链级对比 |
| 实战 | 模型流式、链式流式、chunk 收集 |
| 进阶补充 | AIMessageChunk vs AIMessage、前端实现原理 |

---

### 第6节：工具调用 — 让 LLM 连接外部世界

> [查看教程](./06-tools.md) | 运行示例：`npm run 07` / `npm run 10`

| 章节 | 内容 |
|------|------|
| 简介 | LLM 的局限性，Tool Calling 如何解决 |
| 核心概念 | Tool Calling 协议 |
| | `tool()` 定义工具：执行函数 + Zod schema |
| | `bindTools()` 绑定工具到模型 |
| | `tool_calls` 响应 |
| | 多工具选择 |
| | `ToolMessage` 反馈 |
| | ReAct 循环：自动迭代调用工具 |
| | 错误处理与 LCEL 链集成 |
| 流程图解 | 单次调用、ReAct 循环、多工具协作 |
| 实战 | 工具定义、bindTools、ReAct 实现、错误处理 |
| 进阶补充 | ReAct 框架、LangGraph 生产级 Agent |

---

### 第7节：对话记忆 — 让 LLM 记住上下文

> [查看教程](./07-memory.md) | 运行示例：`npm run 08`

| 章节 | 内容 |
|------|------|
| 简介 | LLM 的无状态本质 |
| 核心概念 | "记忆"的工作原理：拼接历史消息 |
| | 手动管理 chatHistory 数组 |
| | 消息流：完整调用过程 |
| | 记忆策略对比：全量/滑动窗口/摘要 |
| | LangGraph MemorySaver：checkpoint 机制 |
| | 持久化存储：SQLite/PostgreSQL |
| | 历史越长，token 越多 |
| 流程图解 | 多轮对话消息累积过程 |
| 实战 | 初始化历史、多轮对话循环、查看历史 |
| 进阶补充 | 历史截断策略、Token 计数、对话记忆 vs RAG |

---

### 第8节：RAG — 让 LLM 基于你的文档回答

> [查看教程](./08-rag.md) | 运行示例：`npm run 09`

| 章节 | 内容 |
|------|------|
| 简介 | RAG 解决的问题（知识截止、幻觉、私有数据） |
| 核心概念 | RAG = Retrieval-Augmented Generation |
| | LLM 的困境 |
| | RAG 工作流程：索引阶段 + 查询阶段 |
| | Document 对象：pageContent + metadata |
| | `RecursiveCharacterTextSplitter` 文本分割 |
| | 检索方式：关键词 vs 向量 |
| | RAG 链构建 |
| | RAG vs Fine-tuning |
| 流程图解 | RAG 完整架构（索引+查询双阶段） |
| 实战 | Document 创建、文本分割、检索器、RAG 链 |
| 进阶补充 | 向量数据库、Embedding 模型、高级 RAG 技术 |

---

### 第9节：进阶 — 中间件、回调与生产实践

> [查看教程](./09-advanced.md) | 运行示例：`npm run 11`

| 章节 | 内容 |
|------|------|
| 简介 | 生产环境的需求：日志、监控、校验、格式化 |
| 核心概念 | 回调系统：LangChain 的生命周期钩子 |
| | `BaseCallbackHandler`：类继承方式 |
| | 注入回调：`{ callbacks: [...] }` |
| | `BaseCallbackHandler.fromMethods()`：函数式快捷方式 |
| | `RunnableLambda`：把函数变成链的一环 |
| | 多回调叠加 |
| 流程图解 | 带中间件的链执行流程 |
| 实战 | 日志回调、函数式回调、RunnableLambda、性能监控、多回调 |
| 进阶补充 | Express/Koa 中间件对比、AsyncLocalStorage、LangSmith、LangGraph |

---

## 运行示例

每个示例都有对应的 npm script，使用 `tsx` 直接运行 TypeScript 文件：

```bash
npm run 01    # Chat Model 基础
npm run 02    # Prompt Template
npm run 03    # LCEL Chain
npm run 04    # Output Parser
npm run 05    # Streaming
npm run 06    # Structured Output
npm run 07    # Tools & Agent
npm run 08    # Memory
npm run 09    # RAG
npm run 10    # Tool Calling Chain
npm run 11    # Middleware
npm run 12    # Agent（手写 ReAct）
npm run 13    # Agent（createAgent 生产用法）
```

### 个人知识库项目：启动与脚本

对应第 14~15 节的实战项目（`src/real-project-combat/`），启动与常用脚本如下：

```bash
# 1) 启动 PostgreSQL + Qdrant 容器（使用仓库根目录 docker-compose.yml）
docker compose up -d

# 2) 启动 Hono 后端（端口 3001，Bun.serve + Prisma ORM）
npm run kb:server

# 3) 启动 Vue 3.5 前端（端口 5173，/api 代理到后端）
npm run kb:web

# 4) 命令行触发文档入库（增量同步：递归扫描 docs -> 解析 -> 向量化 -> Qdrant + 文档注册表）
npm run kb:ingest

# 5) Prisma：生成客户端（每次修改 schema.prisma 后必跑）
npm run prisma:generate

# 6) Prisma：把 schema 对齐到 PostgreSQL（个人项目推荐 db push）
npm run prisma:push
```

运行前请确保已正确配置 `.env` 文件，尤其以下两项需同时存在（值通常相同）：

- `DATABASE_URL=postgres://admin:Admin@123@localhost:5432/my_db`（Prisma 专用）
- `PG_CONNECTION_STRING=postgres://admin:Admin@123@localhost:5432/my_db`（PostgresSaver 用）

## 项目结构

```
langchain-ts/
  docs/
    README.md              -- 本文档
    01~10-*.md             -- LangChain 新手教程
    14-hono.md             -- Hono 后端框架新手教程（配合 real-project-combat/server/*）
    15-prisma.md           -- Prisma ORM 新手教程（配合 prisma/schema.prisma 与 services）
  prisma/
    schema.prisma          -- Prisma schema：映射 PostgreSQL 的 documents + checkpoint_* 五张表
  src/
    config.ts              -- 共享模型配置（createMimoModel）
    01_chat_model.ts       -- Chat Model 基础用法
    02_prompt_template.ts  -- 提示词模板
    03_lcel_chain.ts       -- LCEL 管道链
    04_output_parser.ts    -- 输出解析器
    05_streaming.ts        -- 流式输出
    06_structured_output.ts-- 结构化输出（Zod）
    07_tools_and_agent.ts  -- 工具定义与 ReAct Agent
    08_memory.ts           -- 对话记忆管理
    09_rag.ts              -- RAG 检索增强生成
    10_tool_calling_chain.ts-- 工具调用链
    11_middleware.ts        -- 中间件与回调
    12_agent.ts            -- 智能代理（Agent）完整实战
    13_agent_createAgent.ts -- createAgent 生产版 Agent（记忆/流式）
    real-project-combat/   -- ★ 个人知识库完整项目
      server/              --   Hono + Bun + TypeScript 后端（Prisma/PG + Qdrant + Mimo + Ollama）
      web/                 --   Vue 3.5 + Vite 前端
      scripts/ingest.ts    --   CLI 入库脚本
      README.md            --   知识库项目独立文档
  .env                     -- API Key + 数据库连接串 + Prisma DATABASE_URL
  package.json             -- 项目依赖与脚本
  tsconfig.json            -- TypeScript 配置
  docker-compose.yml       -- PostgreSQL(postgres-db:5432) + Qdrant(qdrant-vector:6333)
```

---

### 第10节：智能代理 — 让 LLM 自主规划和行动

> [查看教程](./10-agent.md) | 运行示例：`npm run 12` / `npm run 13`

| 章节 | 内容 |
|------|------|
| 简介 | Agent 的定义，Agent vs Chain 的区别 |
| 核心概念 | Agent = LLM + Tools + Loop + System Prompt |
| | ReAct 循环：推理 → 行动 → 观察 |
| | System Prompt：Agent 的"人格"和行为规范 |
| | 工具定义与描述质量 |
| | 消息类型：SystemMessage / HumanMessage / AIMessage / ToolMessage |
| | 带对话记忆的 Agent |
| 流程图解 | 单次问答、多轮对话、不同场景行为 |
| 实战 | 工具集定义、ReAct 循环实现、单次问答、多轮对话、自定义行为 |
| | 代码级对比：手写实现 vs `createAgent`（记忆/流式等增强能力） |
| 进阶补充 | 使用场景、常见问题、LangGraph、Agent 局限性 |

---

### 第14节：Hono — 为 LangChain 应用写一个轻量、超快的后端

> [查看教程](./14-hono.md) | 启动命令：`npm run kb:server`

| 章节 | 内容 |
|------|------|
| 简介 | Hono 的定位、优势、与 Bun.serve 的搭配方式 |
| 核心概念 | `new Hono()` 与 `app.fetch` 的最小骨架 |
| | `Bun.serve({ fetch: app.fetch })` 在 Bun 上启动 |
| | 路由、参数、响应（query / path param / json / status code） |
| | 路由模块化：`app.route("/api/x", routes)` |
| | CORS 中间件 vs Vite 代理两种跨域方案 |
| | SSE 流式输出：`ReadableStream` + `Content-Type: text/event-stream` |
| | 分层架构：Hono 只做 HTTP，LangChain 逻辑落在 services/* |
| 流程图解 | HTTP 请求经 Bun → Hono → routes → services → 基础设施 |
| 实战 | 写最小 20 行 demo → 调用项目真实接口 → 验证 /api/chat 流式 |
| 进阶补充 | Hono vs Express/Fastify/Nest 选型、常见坑位、下一步建议 |

---

### 第15节：Prisma ORM — 让 PostgreSQL 的增删改查变成 TypeScript 的快乐

> [查看教程](./15-prisma.md) | 初始化命令：`npm run prisma:generate` / `npm run prisma:push`

| 章节 | 内容 |
|------|------|
| 简介 | Prisma 的三步工作流、与个人知识库项目的结合方式 |
| 核心概念 | `schema.prisma`：generator / datasource / model 三段式 |
| | 字段类型：Int / String / DateTime / Json、`@default` / `@unique` / `@id` |
| | 列/表映射：`@map("xxx")` / `@@map("xxx")` 对齐 PG snake_case |
| | `DATABASE_URL` 与 `PG_CONNECTION_STRING` 的语义差异 |
| | Prisma Client 单例 + 懒加载（避免连接数爆炸） |
| | 一把梭 CRUD：findUnique/findFirst/findMany/count/aggregate/create/update/upsert/delete |
| | aggregate + count 并发统计的真实 stats 实现 |
| | `prisma db push` vs `prisma migrate dev` 两种对齐方式 |
| | 与原生 `pg` 包共存：PostgresSaver 写入、$queryRaw 复杂 SQL、DDL 清理 |
| 流程图解 | schema → prisma generate → 业务 CRUD → PostgreSQL（documents vs checkpoint 两张独立写入路径） |
| 实战 | Docker PG 准备 → 安装依赖 + generate + push → 30 行 CRUD demo 脚本 → 调用项目真实的 ingest/stats/documents API |
| 进阶补充 | Prisma/LangChain `Document` 同名冲突的两种规避方案、CLI/Client 版本一致性、`$transaction` 事务、连接池、常见坑位速查 |

