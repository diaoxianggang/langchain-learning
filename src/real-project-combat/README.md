# 个人知识库项目（LangChain createAgent + Vue3.5 + Hono + Bun + Prisma）

基于 LangChain `createAgent` 实现的功能完整的个人知识库项目。支持文档解析、文本向量化、向量存储、智能检索与自然语言问答。
PostgreSQL 侧的**文档注册表 CRUD** 与**聚合统计**现已由 **Prisma ORM** 统一管理（对话记忆仍通过 `@langchain/langgraph-checkpoint-postgres` 使用 pg 直连）。

## 技术栈

| 组件 | 说明 |
|------|------|
| 前端 | Vue 3.5 + Vite（`web/` 目录，独立工程） |
| 后端 | Hono + TypeScript，运行于 Bun（`server/` 目录） |
| 语言模型 | 小米 Mimo 在线模型（`mimo-v2.5-pro`，复用根目录 `.env` 配置） |
| 向量化 | 本地 Ollama `qwen3-embedding:4b`（2560 维） |
| 向量数据库 | Docker Qdrant（容器 `qdrant-vector`，端口 6333/6334） |
| 关系数据库 | Docker PostgreSQL（容器 `postgres-db`，端口 5432，文档注册表 + 对话记忆） |
| ORM | **Prisma 6.x**（文档注册表 CRUD/聚合；schema 在 `prisma/schema.prisma`） |
| Agent | LangChain `createAgent` + 检索工具 + `PostgresSaver` 持久化记忆 |

## 架构

```
┌────────────┐   HTTP(5173, /api 代理)   ┌───────────────────────────────────┐
│ Vue 3.5 前端 │ ────────────────────────> │  Hono 后端 (bun, :3001)            │
│ 问答/知识库 │                           │  createAgent(检索工具)              │
└────────────┘                            └───────────┬───────────────────────┘
                                                      │
        ┌─────────────────┬───────────────────────────┼──────────────────────────┐
        ▼                 ▼                           ▼                          ▼
  Mimo 在线模型    Ollama qwen3-embedding:4b   Docker Qdrant(:6333)      Docker PostgreSQL(:5432)
  (LLM 生成回答)    (文档/查询向量化)             (向量存储/检索)           (文档注册表：Prisma；对话记忆：pg)
```

数据流：
- **入库**：资料源目录 → 递归扫描(md/txt) → 内容 md5 哈希 → 查文档注册表（增量/去重/变更检测，由 **Prisma** 提供 CRUD）→ `TextLoader` 解析 → `RecursiveCharacterTextSplitter` 分块 → Ollama 向量化 → 写入 Qdrant（metadata 含 source/chunk_index）→ Prisma 更新注册表
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
│       ├── postgres.ts       # pg 连接 + 兜底建表（供 PostgresSaver 对话记忆使用）
│       ├── prisma.ts         # ★ PrismaClient 单例（文档注册表入口）
│       ├── documentRegistry.ts # ★ 注册表 CRUD / 统计（Prisma 实现）
│       ├── ingest.ts         # 入库流水线（增量同步，通过 Prisma 更新注册表）
│       ├── retriever.ts      # 语义检索
│       └── agent.ts          # createAgent + PostgresSaver + 检索工具
├── scripts/ingest.ts         # 命令行入库脚本
├── web/                      # Vue 3.5 前端（独立工程）
└── .env.example              # 环境变量样例

项目根目录新增：
  prisma/
    └── schema.prisma         # ★ Prisma schema，映射 PostgreSQL 的 documents 与 checkpoint_* 五张表
```

## Prisma 与 PostgreSQL 映射关系

`prisma/schema.prisma` 准确映射了 PostgreSQL 中 5 张**已存在**的表（**保留表结构不动**）：

| Prisma 模型 | PG 表 | 用途 | 维护方 |
|---|---|---|---|
| `Document` | `documents` | 文档注册表（增量同步元数据） | **Prisma ORM**（`documentRegistry.ts` / `ingest.ts`） |
| `Checkpoints` | `checkpoints` | LangGraph 对话 checkpoint | `PostgresSaver`（pg 直连） |
| `CheckpointBlobs` | `checkpoint_blobs` | checkpoint blob | `PostgresSaver`（pg 直连） |
| `CheckpointWrites` | `checkpoint_writes` | checkpoint writes | `PostgresSaver`（pg 直连） |
| `CheckpointMigrations` | `checkpoint_migrations` | LangGraph 迁移记录 | `PostgresSaver`（pg 直连） |

> 说明：`PostgresSaver` 是 LangGraph 的内置 checkpoint 存储（它内部直接用 `pg` 包操作），Prisma 对这四张 checkpoint 表只做**结构映射**与可选的辅助管理（例如数据清理时可通过 Prisma 统一 `truncate`），**不接管写入逻辑**。

## 快速开始

### 1. 前置依赖

- **Node.js ≥ 22 或 Bun**（项目使用 Bun 运行后端）
- **Ollama** 已启动并拉取向量模型：`ollama pull qwen3-embedding:4b`
- **Docker** 已拉起 PostgreSQL 与 Qdrant（使用根目录已存在的 `docker-compose.yml`）：

```bash
docker compose up -d   # 启动 postgres-db 与 qdrant-vector
```

### 2. 安装依赖

> 💡 如果 bun 的临时目录权限受限（Windows 沙箱常见 `AccessDenied accessing temporary directory`），改用 `npm install --legacy-peer-deps` 安装根依赖即可。

```bash
# 项目根目录（后端依赖 + Prisma CLI + @prisma/client）
bun install
# 前端工程
cd src/real-project-combat/web && bun install && cd ../..
```

### 3. 配置环境变量

将根目录 `.env` 中的知识库配置项按需修改，**关键项**（均有默认值）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `KB_SERVER_PORT` | `3001` | 后端端口 |
| `KB_SOURCE_DIR` | `f:\project\langchain-learning\docs` | 知识库资料来源目录（可配置） |
| `KB_CHUNK_SIZE` / `KB_CHUNK_OVERLAP` | `500` / `80` | 文本分块参数 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 地址 |
| `OLLAMA_EMBEDDING_MODEL` | `qwen3-embedding:4b` | 向量化模型 |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST 地址 |
| `QDRANT_COLLECTION` | `kb_docs` | Qdrant 集合名 |
| `PG_CONNECTION_STRING` | `postgres://admin:Admin@123@localhost:5432/my_db` | PostgreSQL 连接串（PostgresSaver + postgres.ts 兜底建表使用） |
| **`DATABASE_URL`** | `postgres://admin:Admin@123@localhost:5432/my_db` | ★ Prisma 专用连接串（**新增必填**，通常与 `PG_CONNECTION_STRING` 值相同） |

`src/real-project-combat/.env.example` 也同步提供了这些变量的样例参考。

### 4. 初始化 Prisma（只需首次/改动 schema 后执行）

```bash
# 生成 Prisma Client（每次切换/更新 schema.prisma 后必跑一次）
npm run prisma:generate
# 或 npx prisma generate

# 同步 schema 到 PG（初次建表/新增字段时；若表已存在则无破坏性）
npm run prisma:push
# 或 npx prisma db push --skip-generate
```

> `prisma db push` 执行时会把 `prisma/schema.prisma` 的表结构对齐到 PostgreSQL。
> 因为目前表已存在（`postgres.ts` 兜底建表 + `PostgresSaver.setup()` 已建 checkpoint 表），
> 所以首次 push 通常"无变化"；若将来在 schema 中增删字段，再跑此命令即可。

### 5. 启动

```bash
# 启动后端（bun）
npm run kb:server    # 或: bun run src/real-project-combat/server/index.ts

# 启动前端（Vite dev, :5173）
npm run kb:web       # 或: cd src/real-project-combat/web && bun run dev
```

打开浏览器访问 `http://localhost:5173`。

### 6. 首次使用

1. 进入「知识库管理」页，点击「同步知识库」导入 docs 文档（或命令行：`npm run kb:ingest`）
2. 切换到「智能问答」页，例如提问 `RAG 的工作原理是什么？`，即可获得基于知识库的流式回答

## 常用脚本（根 package.json）

| 脚本 | 说明 |
|------|------|
| `npm run kb:server` | 启动 Hono 后端（Bun，端口 3001） |
| `npm run kb:web` | 启动 Vite 前端（端口 5173，代理 /api 到 3001） |
| `npm run kb:ingest` | 命令行触发文档入库（增量同步） |
| `npm run prisma:generate` | 基于 prisma/schema.prisma 生成 Prisma Client |
| `npm run prisma:push` | 将 schema 结构对齐到 PostgreSQL（等价 `prisma db push --skip-generate`） |

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/knowledge/stats` | 知识库统计（`totalDocs / totalChunks / indexed / failed`，底层走 Prisma `count + aggregate`） |
| GET | `/api/knowledge/documents` | 已入库文档列表（字段：`id / source_path / file_hash / chunk_count / status / last_ingested_at / created_at`，对外保持 snake_case，底层由 Prisma camelCase 字段转换而来） |
| POST | `/api/knowledge/ingest` | 触发文档入库（增量同步），返回 `{ ingested[], skipped[], failed[], total }` |
| POST | `/api/chat` | 流式问答（SSE，body: `{ message, sessionId? }`） |
| GET | `/api/chat/history?sessionId=xxx` | 查询会话历史（通过 PostgresSaver 从 PG 读取） |

## 核心特性

- **文档解析**：递归扫描资料源目录，支持 `.md` / `.mdx` / `.txt`
- **文本向量化**：本地 Ollama `qwen3-embedding:4b`，隐私安全、无需联网
- **向量存储与智能检索**：Docker Qdrant 语义检索，返回相关分块及来源
- **Prisma ORM 统一管理文档注册表**：所有增删改查 / 聚合统计通过 Prisma Client（单例见 `services/prisma.ts`），类型安全可自动随 schema 变更
- **自然语言问答**：`createAgent` + `retrieve_knowledge` 工具，Agent 自主决定是否检索
- **持久化记忆**：`PostgresSaver` 将对话历史写入 PostgreSQL，重启后按 sessionId 可恢复
- **增量入库**：基于内容 md5 哈希，新增/变更/未变更文档智能处理，变更时自动清理 Qdrant 旧分块

## 数据清理指引

当需要将数据库与向量库"恢复初始状态（表结构不动）"时，可执行如下等价逻辑（示例脚本逻辑，按需替换）：

- **PostgreSQL**：对 5 张表（`documents / checkpoints / checkpoint_blobs / checkpoint_writes / checkpoint_migrations`）执行 `TRUNCATE TABLE ... RESTART IDENTITY CASCADE`，保留表结构、清空数据、重置序列
- **Qdrant**：列出所有集合后对每个集合调用 `deleteCollection(name)`，恢复为初始空集合状态

清理完成后，重新执行一次 `npm run kb:ingest` 或在知识库管理页点击「同步知识库」即可重建数据。

## 注意事项

- 不直接从 `@prisma/client` 导入**裸名** `Document` 类型，因为它与 LangChain 的核心 `Document` 类型同名，TypeScript 可能会错误解析为"模块无该导出成员"。工程中统一通过 `services/documentRegistry.ts` 导出的 `DocumentRecord` 类型（基于 Prisma 查询返回值反向推导）来引用文档记录类型，避免同名冲突。
- Prisma Client 与 Prisma CLI 版本建议保持一致（`package.json` 中 `prisma` 与 `@prisma/client` 版本已对齐），若手动升级其中一个，请同步升级另一个并重新 `prisma generate`。
- 本项目的 docker-compose 文件位于**仓库根目录**（`/f:/project/langchain-learning/docker-compose.yml`），已定义 `postgres-db` 与 `qdrant-vector` 两个服务，子项目不重复创建 compose 文件。
