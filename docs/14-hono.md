# 第14节：Hono — 为 LangChain 应用写一个轻量、超快的后端

> 学完本节，你将能够用 Hono 快速搭建一个 TypeScript 后端，并为 LangChain Agent/RAG 提供 REST API 与 SSE 流式问答接口。本文所有示例都能在本项目的 `src/real-project-combat/server/` 目录里直接找到真实实现。

## 简介

当我们用 LangChain 写完 Agent、RAG、记忆等能力之后，还需要把它们"暴露给前端或外部调用者"——这就是后端 Web 框架要做的事。在 Node.js / Bun 生态里，常见的选择有 Express、Fastify、Koa、NestJS 等；而 **Hono** 是近几年流行起来的"边缘原生"超轻量框架，特别适合搭配 Bun 使用，具备几个鲜明优势：

- **极快、极小**：Hono 的路由采用基数树（Trie）实现，启动快、包体积小；运行在 Bun 上甚至直接使用 Bun 自带的 HTTP Server，无需额外依赖。
- **跨运行时**：同一套代码可在 Bun / Node.js / Deno / Cloudflare Workers / Vercel Edge 等多种环境运行（通过 adapter）。
- **TypeScript 原生**：路由上下文（`Context`）的参数、响应体、Validator 都是类型安全的。
- **内置工具**：提供了 CORS、Validator、Body 解析、SSE、Cookie 等常用中间件，不需要额外装一堆包。
- **和 LangChain / Prisma 非常搭**：Hono 本身"只负责 HTTP 层"的定位，让你可以非常自然地把 LangChain 的 Agent、RAG 与 Prisma 的数据库操作都放进 service 层，再通过路由统一对外暴露。

在本项目中，后端的启动方式是：用 **Bun.serve** 作为底层服务器，HTTP 请求处理交给 Hono 构建的应用实例 `app.fetch`。

```
bun run src/real-project-combat/server/index.ts
   └─ Bun.serve({ fetch: app.fetch })
        └─ Hono app：路由 → service 层（LangChain / Prisma / Qdrant / PostgresSaver）
```

---

## 核心概念

### 1. Hono 的最小骨架：`new Hono()` 与 `app.fetch`

```ts
import { Hono } from "hono";

const app = new Hono();

app.get("/hello", (c) => {
  return c.json({ message: "Hello, Hono!" });
});

export default app;
```

- `new Hono()` 创建一个**可组合**的应用实例。它本身不会监听端口，只会暴露一个标准的 `fetch(request: Request): Promise<Response>` 函数（即 Fetch API 规范）。
- 路由处理函数的参数 `c` 是 **Context** 对象：你可以通过它读取请求、构造响应、拿到已解析的 body / params / query 等。

### 2. 在 Bun 上启动：`Bun.serve`

个人知识库项目并没有安装 Hono 的 Node/Bun adapter 启动器，而是直接使用 Bun 自带的 HTTP 服务器：

```ts
// server/index.ts
import app from "./app.js";
import { config } from "./services/config.js";

const server = Bun.serve({
  port: config.serverPort,
  idleTimeout: 255, // Bun 最大允许 255s，给长任务问答/入库足够时间
  fetch: app.fetch,
});

console.log(`KB server listening on http://localhost:${server.port}`);
```

这是 Hono 最推荐的部署思路之一：**你只需把处理逻辑交给 Hono 的 `fetch`**，底层监听、协议、TLS 都交给运行时。Node.js 环境下等价写法是：

```ts
import { serve } from "@hono/node-server";
serve({ fetch: app.fetch, port: 3001 });
```

### 3. 路由、参数与响应

Hono 的路由写法和 Express 非常相似：

| 语义 | Hono 示例 |
|---|---|
| GET 带 query | `app.get("/search", (c) => c.json({ q: c.req.query("q") }))` |
| GET 带路径参数 | `app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }))` |
| POST JSON body | `app.post("/chat", async (c) => { const body = await c.req.json<ChatRequest>(); ... })` |
| 返回 JSON | `return c.json({ ok: true })` |
| 返回 404 / 自定义状态码 | `return c.json({ error: "not found" }, 404)` |
| 返回 204 无内容 | `return c.body(null, 204)` |

Hono 所有方法都是**类型安全**的：当你调用 `c.req.json<MyBody>()` 时，返回值会被标注为 `MyBody`；推荐再搭配 Zod 做运行时校验（本项目在 Agent 工具层用了 Zod schema）。

### 4. 路由拆分（模块化）

大型项目一定需要按业务拆分路由。Hono 提供的方式是"每块路由自己 new 一个 Hono，再在顶层 mount"：

```ts
// server/routes/knowledge.ts
export const knowledgeRoutes = new Hono();
knowledgeRoutes.get("/stats", ...);
knowledgeRoutes.get("/documents", ...);
knowledgeRoutes.post("/ingest", ...);

// server/routes/chat.ts
export const chatRoutes = new Hono();
chatRoutes.post("/", ...);
chatRoutes.get("/history", ...);

// server/app.ts（顶层）
const app = new Hono();
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/chat", chatRoutes);
app.get("/api/health", (c) => c.json({ status: "ok", time: new Date() }));
```

最终对外 API 就被组合为：`/api/health`、`/api/knowledge/stats`、`/api/knowledge/documents`、`/api/knowledge/ingest`、`/api/chat`、`/api/chat/history`。

### 5. CORS（跨域）

如果你的前端和后端不在同一个端口上（例如前端 :5173、后端 :3001），浏览器会触发跨域校验。通过 Hono 自带的 `cors` 中间件可以一行开启：

```ts
import { cors } from "hono/cors";

app.use("*", cors({
  origin: ["http://localhost:5173"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
```

当然更省心的办法是在前端的 `vite.config.ts` 里把 `/api` 代理到 `http://localhost:3001`（本项目使用的就是这个方案，见 `src/real-project-combat/web/vite.config.ts`），从前端视角看就是同源请求，无需在后端关心 CORS。

### 6. SSE 流式输出（Server-Sent Events）

大语言模型最常用的交互形式就是"打字机流式回答"，因为它能把第一个可见 token 的延迟从几秒降到几百毫秒，显著提升体验。Hono 提供了非常友好的 SSE 返回方式：

```ts
app.post("/api/chat", async (c) => {
  const { message, sessionId } = await c.req.json();

  const body = new ReadableStream({
    async start(controller) {
      // 1) 先告诉前端一个 sessionId
      controller.enqueue(`data: ${JSON.stringify({ type: "session", sessionId })}\n\n`);
      // 2) 调用 LangChain Agent 的 stream()，逐 token 吐出
      for await (const item of agent.stream(...)) {
        const token = extractToken(item);
        if (token) {
          controller.enqueue(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
        }
      }
      // 3) 结束
      controller.enqueue(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      controller.close();
    },
  });

  return c.body(body, 200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
});
```

要点：
- `Content-Type` 必须是 `text/event-stream`
- 每一条消息的格式必须是 `data: <JSON>\n\n`（结尾空行不可省）
- 前端用 `EventSource` 或 `fetch + reader` 就能读取

### 7. 分层架构：Hono 只做 HTTP

在真实项目中，不建议把数据库操作、Agent 逻辑、向量化操作全部塞进路由函数里，否则会很快变成"大泥球"。个人知识库采用经典 3 层拆分：

```
Hono routes（/api/*）         — 只处理请求/响应、字段校验、SSE 协议
        │
        ▼
services/*                    — 业务逻辑与能力：
   config / llm / embeddings / documentLoader
   vectorStore / prisma / postgres / documentRegistry
   ingest / retriever / agent
        │
        ▼
基础设施：Prisma(PG) / pg(PostgresSaver) / Qdrant / Ollama / Mimo
```

这样做的好处是：**即使你想把 Hono 换成 Fastify 或别的框架，只要复用 service 层就行**；并且 service 层能被 CLI 脚本（如 `scripts/ingest.ts`）和 API 同时调用。

---

## 流程图解

```
                HTTP 请求（REST / SSE）
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│  Bun.serve / Node HTTP Server                             │
│   └─ Hono app.fetch                                        │
│        ├─ cors / body 解析 等中间件                         │
│        ├─ /api/health          → 返回 JSON                │
│        ├─ /api/knowledge/*    → knowledgeRoutes          │
│        │     ├─ /stats       → documentRegistry.stats()  │
│        │     ├─ /documents   → documentRegistry.listAll()│
│        │     └─ /ingest      → ingestAll() (Prisma+Qdrant)│
│        └─ /api/chat/*         → chatRoutes               │
│              ├─ POST /      → agent.stream() (SSE)       │
│              └─ GET /history→ checkpointer.aget()        │
└───────────────────────────────────────────────────────────┘
```

---

## 实战：从零跑通本项目的 Hono 后端

### 步骤 1：确认依赖

仓库根目录已安装 Hono；如果从一个空工程起手，安装命令是：

```bash
# 推荐：和本项目一致
npm install hono
# 或者
bun add hono
```

### 步骤 2：写一个 20 行的最小后端

新建文件 `src/my-hono-demo.ts`：

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

app.get("/api/health", (c) => c.json({ status: "ok", time: new Date() }));
app.get("/api/echo/:word", (c) => c.json({ echo: c.req.param("word").repeat(2) }));
app.post("/api/sum", async (c) => {
  const { a, b } = await c.req.json<{ a: number; b: number }>();
  return c.json({ sum: a + b });
});

export default app;

if (typeof Bun !== "undefined") {
  const port = Number(process.env.PORT ?? 3002);
  Bun.serve({ fetch: app.fetch, port });
  console.log(`demo server listening on http://localhost:${port}`);
}
```

然后运行：

```bash
bun run src/my-hono-demo.ts
```

用 `curl` 或者 Postman 验证三个接口，你应该能立刻看到返回 JSON。

### 步骤 3：调用知识库项目的真实接口

本项目的真实后端启动命令：

```bash
# 确保 Docker 两个容器已启动（postgres-db + qdrant-vector）
docker compose up -d

# 启动后端
npm run kb:server
# => 控制台打印：KB server listening on http://localhost:3001
```

健康检查：

```bash
curl http://localhost:3001/api/health
# => {"status":"ok","time":"..."}
```

知识库统计：

```bash
curl http://localhost:3001/api/knowledge/stats
# => {"sourceDir":"f:\\project\\langchain-learning\\docs","totalDocs":12,"totalChunks":...}
```

### 步骤 4：流式问答体验

```bash
curl -N -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hono 是什么？和 Express 有什么区别？","sessionId":"my-session-1"}'
```

你应该能看到一串 `data: {"type":"token","content":"..."}` 的事件被逐段返回——这就是 SSE 流式输出。

---

## 进阶补充

### 什么时候选 Hono，什么时候选 Express / Fastify / Nest？

| 维度 | Hono | Express | Fastify | NestJS |
|---|---|---|---|---|
| 定位 | 轻量、跨运行时、边缘原生 | 老牌社区最广 | 性能优先、插件生态完善 | 企业级架构、IoC/DI、装饰器 |
| 包体积 | 极小 | 中等 | 较大 | 很大 |
| TypeScript | 原生，类型安全 | 需 @types | 原生，类型安全 | 原生 |
| 跨运行时 | Bun/Node/Deno/Workers/Vercel | 仅 Node | 仅 Node | 仅 Node |
| 上手成本 | 低，接近 Express | 最低 | 中等 | 高 |
| 典型场景 | BFF、AI API、SSE、Serverless | 中后端混合工程 | 高并发 API | 复杂 DDD/企业后端 |

对于**个人知识库**这种"以 AI 流式 API 为核心、对跨运行时和轻量性有要求"的项目，Hono 是非常理想的选择；如果你有复杂的鉴权、团队规范、数据库事务管理、微服务，才考虑升级到 NestJS。

### 常见坑位

1. **长连接超时**：`Bun.serve` 默认 `idleTimeout` 很短（约 10s），流式问答 / 大文档入库可能会被超时切断。解决：显式设置 `idleTimeout: 255`（Bun 最大值）或用 Node adapter。
2. **SSE 经代理不流式**：如果前面有 Nginx / Vite proxy，需要确认它们正确转发了 `Content-Type: text/event-stream`，且不做响应缓冲；Vite 的代理默认就很好用。
3. **Body 未 await 直接读取**：`c.req.json()` 是 Promise，漏掉 `await` 会得到 `Promise` 对象而不是真实对象——务必写 `const body = await c.req.json<T>()`。
4. **IDE 提示找不到 `Bun` 全局类型**：安装 `@types/bun` 作为 devDependency，类型检查就能通过。
5. **路由重复挂两次**：`app.route('/api/x', routes)` 后就不要再 `routes.get('/api/x/a', ...)`，否则前缀会重复变成 `/api/x/api/x/a`。

### 下一步建议

- 继续阅读本项目 `src/real-project-combat/server/` 下的 `app.ts`、`index.ts`、`routes/*`，看路由是如何分层、如何调用 service 层的。
- 如果后续要加鉴权，可以试试 Hono 的 JWT 中间件 `hono/jwt`；要加请求 ID 或日志，可以写一个小的 `app.use('*', ...)` 中间件。
- 生产部署时把 Hono 挂到 Cloudflare Workers 或 Bun 原生的 `bun --hot` 自重启上，都只需要改入口，业务代码零改动。
