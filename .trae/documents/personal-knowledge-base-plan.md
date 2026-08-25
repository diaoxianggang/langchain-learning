# 个人知识库项目实施方案（Vue3.5 + Hono + Bun + LangChain createAgent）

## 一、需求摘要

基于 LangChain `createAgent` 实现一个功能完整的个人知识库项目，位于 `src/real-project-combat/` 下。项目需实现：

- **文档解析**：从可配置的资料源目录加载文档（默认 `f:\project\langchain-learning\docs`，内含 md 教程）
- **文本向量化**：本地 Ollama `qwen3-embedding:4b`（已安装，2560 维）
- **向量存储**：Docker Qdrant（容器 `qdrant-vector` 已在运行，端口 6333/6334）
- **智能检索**：语义相似度检索
- **自然语言问答**：小米 Mimo 在线模型（`.env` 已配置）+ `createAgent` + 检索工具
- **交互形态（用户已确认）**：前端 Vue 3.5 + 后端 Hono + bun + TS
- **PostgreSQL 职责（用户已确认）**：文档注册表（入库元数据/增量同步）+ 对话记忆（`PostgresSaver` checkpointer）

## 二、现状分析（基于实际探索）

| 项 | 现状 |
|---|---|
| LangChain | `langchain@1.5.10`、`@langchain/core@1.2.9`、`@langchain/ollama@1.3.0`、`@langchain/openai@1.5.10`、`@langchain/langgraph@1.4.12`、`@langchain/classic@1.0.45`、`@langchain/textsplitters@0.1.0` 已安装；`bun.lock` 存在（用 bun 管理） |
| 模型 | 小米 Mimo：`.env` 中 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `MIMO_MODEL=mimo-v2.5-pro`，通过 `initChatModel` + `modelProvider:"openai"` 接入（见 [config.ts](file:///f:/project/langchain-learning/src/config.ts)） |
| Ollama | 正在运行，`qwen3-embedding:4b` 已就绪（capabilities: embedding，维度 2560） |
| Docker | `postgres-db`（PG16，`admin/Admin@123/my_db`，端口 5432，healthy）与 `qdrant-vector`（qdrant/qdrant:v1.12.0，端口 6333/6334）**已在运行** |
| docker-compose | 根目录 [docker-compose.yml](file:///f:/project/langchain-learning/docker-compose.yml) **已存在**，已定义 `postgres-db` 与 `qdrant-vector` 两个服务（含 volumes/healthcheck），与运行中容器一致；**无需新建** |
| 文档加载器 | v1.x 主包 `langchain` **不再包含** `document_loaders`；已装的 `@langchain/classic` 提供 `document_loaders/fs/text`（TextLoader），无 DirectoryLoader，需自行递归遍历目录 |
| 未安装依赖 | `@langchain/qdrant`（Qdrant 向量库）、`pg` + `@types/pg`（PostgreSQL 客户端）、`@langchain/langgraph-checkpoint-postgres`（PostgresSaver）、`hono`（后端框架）；前端 Vue3.5 生态依赖未安装 |
| 现有参照 | [09_rag.ts](file:///f:/project/langchain-learning/src/09_rag.ts)（OllamaEmbeddings + splitter + RAG 链）、[13_agent_createAgent.ts](file:///f:/project/langchain-learning/src/13_agent_createAgent.ts)（createAgent + MemorySaver 用法） |
| 根 tsconfig | `include: ["src/**/*"]`，需排除前端 web 目录以免与 Vue 的 TS 配置冲突 |

## 三、总体架构

```
┌────────────┐   HTTP(5173, /api 代理)   ┌─────────────────────────┐
│ Vue 3.5 前端 │ ────────────────────────> │  Hono 后端 (bun, :3001) │
│ 问答/知识库 │                           │  createAgent(检索工具)   │
└────────────┘                            └───────────┬─────────────┘
                                                      │
        ┌─────────────────┬───────────────────────────┼─────────────────────┐
        ▼                 ▼                           ▼                     ▼
  Mimo 在线模型    Ollama qwen3-embedding:4b   Docker Qdrant(:6333)   Docker PostgreSQL(:5432)
  (LLM 生成回答)    (文档/查询向量化)             (向量存储/检索)          (文档注册表+对话记忆)
```

数据流：
- **入库**：资料源目录 → 递归扫描(md/txt) → 计算内容哈希 → 查文档注册表(增量/去重/变更) → TextLoader 解析 → `RecursiveCharacterTextSplitter` 分块 → Ollama 向量化 → 写入 Qdrant（metadata 含 source/chunk_index）→ 更新注册表
- **问答**：用户提问 → `createAgent`(Mimo) 判断需检索 → 调 `retrieve_knowledge` 工具 → Qdrant 相似度检索 → 返回相关分块 → Agent 依据上下文生成回答（SSE 流式返回）；多轮记忆经 `PostgresSaver` 按 `thread_id`(=sessionId) 持久化

## 四、目标目录结构

```
src/real-project-combat/
├── server/
│   ├── index.ts              # Hono 入口（bun serve）
│   ├── app.ts                # Hono 应用 + 路由挂载 + CORS
│   ├── routes/
│   │   ├── knowledge.ts      # /api/knowledge/*（ingest/stats/documents）
│   │   └── chat.ts           # /api/chat（SSE 流式问答）、/api/chat/history
│   └── services/
│       ├── config.ts         # 环境配置（带默认值，全部可配置）
│       ├── llm.ts            # Mimo 模型（initChatModel）
│       ├── embeddings.ts     # OllamaEmbeddings(qwen3-embedding:4b)
│       ├── documentLoader.ts # 目录扫描 + TextLoader 解析 + 哈希
│       ├── vectorStore.ts    # QdrantVectorStore 单例
│       ├── postgres.ts       # pg 连接 + 建表
│       ├── documentRegistry.ts # 文档注册表 CRUD
│       ├── ingest.ts         # 入库流水线（增量同步）
│       ├── retriever.ts      # 语义检索
│       └── agent.ts          # createAgent + PostgresSaver + 检索工具
├── scripts/
│   └── ingest.ts             # 可选 CLI 入库脚本（便于无前端验证）
├── web/                      # Vue 3.5 前端（独立 bun 工程）
│   ├── package.json / vite.config.ts / tsconfig.json / index.html
│   └── src/
│       ├── main.ts
│       ├── App.vue           # 顶部导航（问答/知识库）
│       ├── api.ts            # fetch 封装
│       └── views/ChatView.vue      # 问答页（流式）
│       └── views/KnowledgeView.vue # 知识库页（同步/统计/文档列表）
├── .env.example              # 项目环境变量样例
└── README.md                 # 项目说明与运行指南
```

> 注：`docker-compose.yml` 已在项目根目录存在（定义了 postgres-db 与 qdrant-vector），本子项目内**不重复创建**，直接引用根目录文件。根目录改动：`package.json` 增加后端依赖与 `kb:*` scripts；`.env` 追加知识库配置项；根 `tsconfig.json` 的 `exclude` 增加 `src/real-project-combat/web`。

## 五、分步实施计划

### 步骤 1：安装依赖与环境配置

**1.1 后端依赖（根 `package.json`，用 bun 安装）**
```bash
bun add hono @langchain/qdrant pg @langchain/langgraph-checkpoint-postgres
bun add -d @types/pg
```

**1.2 前端依赖（`src/real-project-combat/web/`，独立 package.json）**
```json
{ "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "vite": "^7.0.0", "@vitejs/plugin-vue": "^6.0.0", "typescript": "^5.6.0" } }
```
```bash
cd src/real-project-combat/web && bun install
```

**1.3 根 `.env` 追加（含默认值注释）**，同时提供 `src/real-project-combat/.env.example`：
```
# 知识库服务
KB_SERVER_PORT=3001
KB_SOURCE_DIR=f:\project\langchain-learning\docs
KB_CHUNK_SIZE=500
KB_CHUNK_OVERLAP=80
# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=qwen3-embedding:4b
# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=kb_docs
# PostgreSQL
PG_CONNECTION_STRING=postgres://admin:Admin@123@localhost:5432/my_db
```

**1.4 根 `package.json` scripts 追加**
```json
"kb:server": "bun run src/real-project-combat/server/index.ts",
"kb:web": "cd src/real-project-combat/web && bun run dev",
"kb:ingest": "bun run src/real-project-combat/scripts/ingest.ts"
```

**1.5 根 `tsconfig.json`**：`exclude` 增加 `"src/real-project-combat/web"`。

### 步骤 2：后端核心服务模块

按目录逐一实现，要点如下（全部为决策性细节）：

**`services/config.ts`** — 读取 `process.env` 并提供默认值（默认值即上表实际运行值）。`KNOWLEDGE_SOURCE_DIR` 默认 `path.join(process.cwd(), "docs")`（脚本从根目录运行时即 `f:\project\langchain-learning\docs`），支持环境变量覆盖实现"可配置资料来源"。

**`services/llm.ts`** — 仿 [config.ts](file:///f:/project/langchain-learning/src/config.ts) 用 `initChatModel(config.mimoModel, { modelProvider: "openai", temperature, maxTokens })`，复用根 `.env` 的 MIMO 密钥，保证项目自包含。

**`services/embeddings.ts`** — `new OllamaEmbeddings({ model: config.embeddingModel, baseUrl: config.ollamaBaseUrl })`（与 [09_rag.ts](file:///f:/project/langchain-learning/src/09_rag.ts#L157-L160) 一致）。

**`services/documentLoader.ts`**
- `listSourceFiles(dir)`：`node:fs` 递归遍历，过滤 `.md/.mdx/.txt`
- `loadFile(abs, rel)`：`TextLoader` 来自 `@langchain/classic/document_loaders/fs/text`；返回 `Document`，`metadata.source = relPath`
- `hashContent(text)`：`node:crypto` md5，用于增量检测

**`services/vectorStore.ts`** — QdrantVectorStore 单例：
```ts
new QdrantVectorStore(embeddings, { url: config.qdrantUrl, collectionName: config.qdrantCollection })
```
首次 `addDocuments` 自动建集合（维度由 embedding 决定=2560）。

**`services/postgres.ts`** — `pg` Client 单例 + 建表：
```sql
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending/indexed/failed
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`services/documentRegistry.ts`** — `getByPath` / `upsert` / `listAll` / `stats`。

**`services/retriever.ts`** — `retrieve(query, k=4)` 调用 `vectorStore.similaritySearchWithScore(query, k)`，返回 `{ pageContent, metadata, score }[]`。

**`services/ingest.ts`** — 入库流水线（增量同步）：
1. `listSourceFiles` 扫描
2. 逐文件：读取文本 → 哈希
3. 查注册表：不存在→新入库；存在且哈希相同→跳过；哈希不同→从 Qdrant 按 `payload.source == relPath` 过滤删除旧块后重入库
4. 新/变更文件：`RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap })` 分块（每块 metadata 增加 `source` 与 `chunk_index`）→ 分批（每批 100）`vectorStore.addDocuments` → 更新注册表（chunk_count/status/hash/时间）
5. 返回 `{ ingested, skipped, failed }`

**`services/agent.ts`** — 核心：
- 检索工具：`tool(async ({ query }) => JSON.stringify(await retrieve(query, 4)), { name: "retrieve_knowledge", schema: z.object({ query: z.string() }) })`，description 明确"当问题涉及知识库内容时调用"
- `PostgresSaver.fromConnString(config.pgConnectionString)` + `await checkpointer.setup()`
- `createAgent({ model, tools: [retrieveTool], systemPrompt, checkpointer })`；systemPrompt 要求：优先基于检索上下文回答、引用来源、不确定时说明
- 提供 `getAgent()` 懒加载单例

### 步骤 3：后端 API（Hono）

**`app.ts` / `index.ts`** — `Hono()` + `hono/cors`（允许本地前端跨域，作兜底）+ 路由；`import { serve } from "hono/bun"`，监听 `config.serverPort`。

**`routes/knowledge.ts`**
- `GET /api/knowledge/stats` → `{ sourceDir, totalDocs, totalChunks, indexed/skipped, status }`
- `GET /api/knowledge/documents` → 注册表列表
- `POST /api/knowledge/ingest` → 调 `ingest()` 返回 `{ ingested, skipped, failed }`（同步执行）

**`routes/chat.ts`**
- `POST /api/chat`（body: `{ message, sessionId? }`）→ 生成/复用 sessionId；`agent.stream({ messages: [new HumanMessage(message)] }, { configurable: { thread_id: sessionId }, streamMode: "messages" })` 逐 token 流式返回，SSE 格式 `data: {"type":"token","content":"..."}\n\n`，结束发 `data: {"type":"done","sessionId"}\n\n`（Hono 返回 `Response` + `ReadableStream`）
- `GET /api/chat/history?sessionId=xxx` → `checkpointer.aget({ configurable: { thread_id } })` 取消息历史返回（若 API 不可用则前端本地维护消息，见假设）

### 步骤 4：前端 Vue 3.5

**`vite.config.ts`** — plugin-vue；`server: { port: 5173, proxy: { "/api": "http://localhost:3001" } }`（同源，无需处理 CORS）。

**`src/api.ts`** — `fetch` 封装：`getStats / getDocuments / ingest / sendChat(流式)`（POST + `response.body.getReader()` 读 SSE，逐 token 回调）。

**`App.vue`** — 顶部简单导航切换"问答 / 知识库"两视图。

**`ChatView.vue`** — 消息列表（用户/助手气泡）、输入框、`新对话` 按钮（生成新 sessionId 并本地清空展示）、流式渲染助手回复、展示引用来源；消息展示由前端本地维护，sessionId 存于组件内（新对话即换 id）。

**`KnowledgeView.vue`** — 显示资料源目录、统计卡片（文档数/分块数）、文档表格、`同步知识库` 按钮（调 ingest 后刷新 stats）。

样式用原生 CSS，不引入 UI 框架，避免过度设计。

### 步骤 5：基础设施与文档

**`docker-compose.yml`（已存在，引用根目录文件）**：根目录 [docker-compose.yml](file:///f:/project/langchain-learning/docker-compose.yml) 已定义 `postgres-db`（PG16，admin/Admin@123/my_db，5432）与 `qdrant-vector`（qdrant/qdrant:v1.12.0，6333/6334），与运行中容器一致。本子项目**不新建** compose 文件，仅需确认容器在运行（`docker ps`），无需任何操作。

**`README.md`** — 架构图、依赖、启动步骤（确认根目录 compose 已拉起容器（如未启动则 `docker compose up -d`）、`bun install`、`bun run kb:server`、`bun run kb:web`）、功能说明、配置项说明（含指向根目录 docker-compose.yml）。

## 六、假设与决策

1. **运行形态**：按用户确认采用 Vue3.5 + Hono + bun + TS 全栈；前端为纯展示层，业务全部在后端。
2. **PostgreSQL 职责**：文档注册表 + `PostgresSaver` 对话记忆（用户已确认）。
3. **对话历史展示**：前端本地维护消息列表为主；`/api/chat/history` 尽力实现（基于 `checkpointer.aget`），若版本 API 差异大则保留接口但前端不依赖。
4. **资料来源可配置**：通过 `KB_SOURCE_DIR` 环境变量，默认 `docs` 目录；UI 只读展示。
5. **增量策略**：基于文件内容 md5；Qdrant 按 `payload.source` 过滤删除变更文件的旧块。
6. **前端置于 `src/real-project-combat/web`**，独立 bun 工程；根 `tsconfig` 排除该目录避免类型配置冲突。
7. **会话标识**：`sessionId` 由前端生成（UUID），映射到 LangGraph `thread_id`；未传则后端生成并随 SSE 返回。
8. **不新增**：不引入鉴权、多用户、文件上传等超出"个人知识库"的范围；不在代码中硬编码密钥。

## 七、验证步骤

1. `bun install`（根）与 `cd src/real-project-combat/web && bun install` 成功，`bun run tsc --noEmit`（根，web 已排除）无类型错误。
2. `bun run kb:server` → `curl http://localhost:3001/api/health` 返回 ok。
3. `curl -X POST http://localhost:3001/api/knowledge/ingest` → 返回 `ingested/skipped/failed`；`GET /api/knowledge/stats` 显示文档数与分块数 > 0；Qdrant dashboard（:6333/dashboard）可见 `kb_docs` 集合；PG 查询 `documents` 表有记录。
4. 再次 ingest → 全部 `skipped`（验证增量去重）。
5. `bun run kb:web` → 浏览器打开 :5173；知识库页可同步并看统计；问答页提问"RAG 的工作原理是什么？"（docs 中的内容）→ 获得带来源的流式回答。
6. 重启后端后以相同 sessionId 追问"上面提到的分块大小是多少？"→ 能结合历史回答（验证 PostgresSaver 持久化记忆）。

## 八、风险与注意点

- `@langchain/qdrant` 首次建集合需 embedding 可用（Ollama 在线）；维度 2560 自动匹配。
- `PostgresSaver.fromConnString` 的返回值同步/异步随版本变化，实现时以类型提示为准（必要时 `await`）。
- Qdrant payload 过滤删除依赖 metadata 键 `source`，实现时确保 `addDocuments` 的 metadata 含该键且无保留字冲突（避免 `id`、`point_id` 等）。
- 流式 SSE 经 Vite proxy 需 `proxy` 配置正确；后端返回需显式 `Content-Type: text/event-stream`。
- 若 `docs` 目录存在非文本文件或编码问题，TextLoader 默认 utf-8 处理；文件过滤白名单已限制扩展名。
