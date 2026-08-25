# 个人知识库项目（LangChain createAgent + Vue3.5 + Hono + Bun）

基于 LangChain `createAgent` 实现的功能完整的个人知识库项目。支持文档解析、文本向量化、向量存储、智能检索与自然语言问答。

## 技术栈

| 组件 | 说明 |
|------|------|
| 前端 | Vue 3.5 + Vite（`web/` 目录，独立工程） |
| 后端 | Hono + TypeScript，运行于 Bun（`server/` 目录） |
| 语言模型 | 小米 Mimo 在线模型（`mimo-v2.5-pro`，复用根目录 `.env` 配置） |
| 向量化 | 本地 Ollama `qwen3-embedding:4b`（2560 维） |
| 向量数据库 | Docker Qdrant（容器 `qdrant-vector`，端口 6333/6334） |
| 关系数据库 | Docker PostgreSQL（容器 `postgres-db`，端口 5432，文档注册表 + 对话记忆） |
| Agent | LangChain `createAgent` + 检索工具 + `PostgresSaver` 持久化记忆 |

## 架构

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
- **入库**：资料源目录 → 递归扫描(md/txt) → 内容 md5 哈希 → 查文档注册表（增量/去重/变更检测）→ `TextLoader` 解析 → `RecursiveCharacterTextSplitter` 分块 → Ollama 向量化 → 写入 Qdrant（metadata 含 source/chunk_index）→ 更新 PostgreSQL 注册表
- **问答**：用户提问 → `createAgent`(Mimo) 判断需检索 → 调用 `retrieve_knowledge` 工具 → Qdrant 相似度检索 → 依据上下文生成回答（SSE 流式返回）；多轮记忆经 `PostgresSaver` 按 `sessionId`(=thread_id) 持久化到 PostgreSQL

## 目录结构

```
src/real-project-combat/
├── server/
│   ├── index.ts              # Hono 入口（bun serve）
│   ├── app.ts                # Hono 应用 + 路由 + CORS
│   ├── routes/
│   │   ├── knowledge.ts      # /api/knowledge/*（stats/documents/ingest）
│   │   └── chat.ts           # /api/chat（SSE 流式问答）、/api/chat/history
│   └── services/
│       ├── config.ts         # 环境配置（带默认值）
│       ├── llm.ts            # Mimo 模型
│       ├── embeddings.ts     # OllamaEmbeddings(qwen3-embedding:4b)
│       ├── documentLoader.ts # 目录扫描 + TextLoader 解析 + 哈希
│       ├── vectorStore.ts    # QdrantVectorStore 单例
│       ├── postgres.ts       # pg 连接 + 建表（文档注册表）
│       ├── documentRegistry.ts # 注册表 CRUD / 统计
│       ├── ingest.ts         # 入库流水线（增量同步）
│       ├── retriever.ts      # 语义检索
│       └── agent.ts          # createAgent + PostgresSaver + 检索工具
├── scripts/ingest.ts         # 命令行入库脚本
├── web/                      # Vue 3.5 前端（独立工程）
└── .env.example              # 环境变量样例
```

## 快速开始

### 1. 前置依赖

- **Node.js ≥ 22 或 Bun**（项目使用 Bun 运行后端）
- **Ollama** 已启动并拉取向量模型：`ollama pull qwen3-embedding:4b`
- **Docker** 已拉起 PostgreSQL 与 Qdrant（见根目录 `docker-compose.yml`）：

```bash
docker compose up -d   # 启动 postgres-db 与 qdrant-vector
```

### 2. 安装依赖

```bash
# 项目根目录（后端依赖）
bun install
# 前端工程
cd src/real-project-combat/web && bun install && cd ../..
```

### 3. 配置环境变量

将根目录 `.env` 中的知识库配置项按需修改，关键项（均有默认值）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KB_SERVER_PORT` | `3001` | 后端端口 |
| `KB_SOURCE_DIR` | `f:\project\langchain-learning\docs` | 知识库资料来源目录（可配置） |
| `KB_CHUNK_SIZE` / `KB_CHUNK_OVERLAP` | `500` / `80` | 文本分块参数 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 地址 |
| `OLLAMA_EMBEDDING_MODEL` | `qwen3-embedding:4b` | 向量化模型 |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST 地址 |
| `QDRANT_COLLECTION` | `kb_docs` | Qdrant 集合名 |
| `PG_CONNECTION_STRING` | `postgres://admin:Admin@123@localhost:5432/my_db` | PostgreSQL 连接串 |

### 4. 启动

```bash
# 启动后端（bun）
npm run kb:server    # 或: bun run src/real-project-combat/server/index.ts

# 启动前端（Vite dev, :5173）
npm run kb:web       # 或: cd src/real-project-combat/web && bun run dev
```

打开浏览器访问 `http://localhost:5173`。

### 5. 首次使用

1. 进入「知识库管理」页，点击「同步知识库」导入 docs 文档（或命令行：`npm run kb:ingest`）
2. 切换到「智能问答」页，例如提问 `RAG 的工作原理是什么？`，即可获得基于知识库的流式回答

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/knowledge/stats` | 知识库统计 |
| GET | `/api/knowledge/documents` | 已入库文档列表 |
| POST | `/api/knowledge/ingest` | 触发文档入库（增量同步） |
| POST | `/api/chat` | 流式问答（SSE，body: `{ message, sessionId? }`） |
| GET | `/api/chat/history?sessionId=xxx` | 查询会话历史 |

## 核心特性

- **文档解析**：递归扫描资料源目录，支持 `.md` / `.mdx` / `.txt`
- **文本向量化**：本地 Ollama `qwen3-embedding:4b`，隐私安全、无需联网
- **向量存储与智能检索**：Docker Qdrant 语义检索，返回相关分块及来源
- **自然语言问答**：`createAgent` + `retrieve_knowledge` 工具，Agent 自主决定是否检索
- **持久化记忆**：`PostgresSaver` 将对话历史写入 PostgreSQL，重启后按 sessionId 可恢复
- **增量入库**：基于内容 md5 哈希，新增/变更/未变更文档智能处理，变更时自动清理 Qdrant 旧分块
