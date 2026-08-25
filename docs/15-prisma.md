# 第15节：Prisma — 让 PostgreSQL 的增删改查变成 TypeScript 的快乐

> 学完本节，你将能够用 Prisma 为 PostgreSQL 设计 schema、生成类型安全的 Client、完成日常的增删改查与统计聚合，并理解在 LangChain 个人知识库项目中 Prisma 与原生 `pg` 包各自承担的职责。本文所有示例都能在本项目的 `prisma/schema.prisma` 与 `src/real-project-combat/server/services/` 目录里找到真实实现。

## 简介

写后端最基础也最繁琐的工作，就是"和数据库打交道"：写 SQL、参数化查询、把返回的行数组转成对象、手动管理字段命名、拼错列名直到运行时才报错……这些事情做多了会怀疑人生。

**Prisma** 就是为了把这些繁琐工作拿走而诞生的"下一代 TypeScript ORM"。它的核心卖点只有一句话：**把你的数据库 schema 用一个声明式文件描述出来，然后自动生成一个 100% 类型安全的数据库客户端**。

在个人知识库项目中，我们用 Prisma 管理 PostgreSQL 里的 **Document（文档注册表）** 表；其余四张由 LangGraph 提供的对话 checkpoint 表（`checkpoints / checkpoint_blobs / checkpoint_writes / checkpoint_migrations`）也在 Prisma schema 里做了结构映射，方便后续清理与辅助查询，但写入仍然由 `PostgresSaver`（它内部用原生 `pg` 包）负责。

Prisma 的三步工作流可以记为：**声明 schema → generate client → 在业务代码里用 client 做 CRUD**。

```
 prisma/schema.prisma   —— 你写的声明式 schema
          │
          ▼
 npx prisma generate   —— Prisma CLI 生成 @prisma/client 类型
          │
          ▼
 业务代码（documentRegistry.ts / ingest.ts）
    prisma.document.findUnique / upsert / findMany / count / aggregate
```

---

## 核心概念

### 1. 什么是 Schema File（`prisma/schema.prisma`）

Prisma 的一切都从 `schema.prisma` 开始。它由三段构成：

- **generator**：指定输出什么客户端（默认 `prisma-client-js`，即 `@prisma/client`）。
- **datasource**：指定数据库类型（`postgresql` / `mysql` / `sqlite` / `mongodb` / `sqlserver`）和连接串。
- **model**：每个 model 对应数据库里的一张表，字段名、类型、默认值、主键、唯一键、索引等都在这里声明。

个人知识库的最简版本如下：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Document {
  id             Int       @id @default(autoincrement())
  sourcePath     String    @unique @map("source_path")
  fileHash       String    @map("file_hash")
  chunkCount     Int       @default(0) @map("chunk_count")
  status         String    @default("pending")
  lastIngestedAt DateTime? @map("last_ingested_at") @db.Timestamptz()
  createdAt      DateTime? @default(now()) @map("created_at") @db.Timestamptz()

  @@map("documents")
}
```

几个和数据库字段映射相关的重点：

- `@map("xxx")`：**单个字段**映射到数据库列名（例如把 TS 的 `sourcePath` 映射为 PG 的 `source_path`）。
- `@@map("xxx")`：**整张表**映射到数据库表名（model 名叫 `Document`，但实际表名叫 `documents`）。
- `@db.Timestamptz()`：让 Prisma 生成 PostgreSQL 原生的 `timestamptz` 类型，而不是默认的 `timestamp`。
- `env("DATABASE_URL")`：从 `.env` 读取连接串，**避免把账号密码硬编码在仓库里**。

### 2. Prisma 支持的常用字段类型

| Prisma 字段类型 | 对应的 PostgreSQL 类型 | 说明 |
|---|---|---|
| `Boolean` | `boolean` | 真/假 |
| `Int` | `integer` | 整数（自增用 `@id @default(autoincrement())`）|
| `BigInt` | `bigint` | 大整数（常用于雪花 ID）|
| `String` | `text` / `varchar` | 字符串 |
| `Float` | `double precision` | 浮点 |
| `DateTime` | `timestamp` / `timestamptz`（加修饰） | 时间戳，默认无时区 |
| `Json` | `jsonb` | JSON（PG 下强烈推荐） |
| `Bytes` | `bytea` | 二进制 |
| `?` | `NULL` 可空（写在类型后面，如 `DateTime?`） | 可空字段 |
| `@default(...)` | `DEFAULT` | 默认值：`@default(0)` / `@default(now())` / `@default(uuid())` |
| `@unique` | `UNIQUE` 约束 | 保证列值唯一 |

### 3. 连接 PostgreSQL：`DATABASE_URL` 怎么写

标准格式是：

```
postgresql://<用户>:<密码>@<主机>:<端口>/<数据库名>?schema=<schema>
```

本项目实际使用的是（Docker 容器 `postgres-db`，端口映射到宿主机 5432）：

```env
DATABASE_URL=postgres://admin:Admin@123@localhost:5432/my_db
PG_CONNECTION_STRING=postgres://admin:Admin@123@localhost:5432/my_db
```

> 为什么有两个变量？
> - `DATABASE_URL`：Prisma 专用（要求变量名就是这个，因为 schema 里写了 `env("DATABASE_URL")`）。
> - `PG_CONNECTION_STRING`：给 LangGraph 的 `PostgresSaver` 用（它内部使用原生 `pg` 包，不依赖 Prisma 的命名）。
> 两者值相同即可，语义不同是因为它们服务于两套独立软件。

### 4. Prisma Client 的生命周期：单例 + 懒加载

Prisma 官方**非常不推荐**每次请求都 `new PrismaClient()`。正确做法是写一个"单例模块"：

```ts
// server/services/prisma.ts
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      // 开发期可以打开日志：log: ["query", "error", "warn"]
    });
  }
  return prisma;
}
```

之后业务代码：

```ts
const prisma = getPrisma();
const doc = await prisma.document.findUnique({ where: { sourcePath: "xxx.md" } });
```

在热更新频繁（Vite/HMR）或 Bun 开发模式下，单例还能避免连接数爆炸。

### 5. CRUD 一把梭：最常用的 7 种方法

Prisma Client 上每个 model 都有一组同名方法。以 `prisma.document` 为例：

| 方法 | 用途 |
|---|---|
| `findUnique({ where: { 唯一键 } })` | 按主键 / 唯一键找一条，找不到返回 `null` |
| `findFirst({ where, orderBy, take, skip })` | 按条件找第一条 |
| `findMany({ where, orderBy, take, skip, cursor })` | 列表（分页 / 排序） |
| `count({ where })` / `aggregate({ _sum, _avg, _count, _min, _max })` | 聚合统计 |
| `create({ data })` | 插入一行 |
| `update({ where, data })` | 更新一行 |
| `upsert({ where, create, update })` | **存在就更新，不存在就插入**（原子操作，非常好用） |
| `delete({ where })` / `deleteMany({ where })` | 删除一行 / 多行 |

个人知识库项目在 `documentRegistry.ts` 里完整使用了这套组合：

- **`getByPath`**：`findUnique`，找不到返回 `undefined`
- **`upsert`**：核心入库动作——第一次同步一条文档时走 `create`，之后只要哈希未变化就走 `update`（更新哈希、分块数、状态、最后入库时间）
- **`listAll`**：`findMany({ orderBy: lastIngestedAt desc nulls last })`
- **`stats`**：`count()` + `aggregate({ _sum: { chunkCount: true } })` 并发查询

### 6. 一个聚合查询示例（documentRegistry.stats 的实现）

```ts
const prisma = getPrisma();
const [countRes, chunksRes, indexedRes, failedRes] = await Promise.all([
  prisma.document.count(),
  prisma.document.aggregate({ _sum: { chunkCount: true } }),
  prisma.document.count({ where: { status: "indexed" } }),
  prisma.document.count({ where: { status: "failed" } }),
]);

return {
  totalDocs: countRes,
  totalChunks: chunksRes._sum.chunkCount ?? 0,
  indexed: indexedRes,
  failed: failedRes,
};
```

`Promise.all` 并发发送 4 个查询到 PG，比串行快 3~4 倍，在统计接口里非常实用。

### 7. Schema 与数据库对齐：`db push` vs `migrate`

Prisma 提供两种方式把 schema 应用到数据库：

| 方式 | 命令 | 适用场景 | 特征 |
|---|---|---|---|
| `prisma db push` | `npx prisma db push` | 原型 / 小项目 / 个人项目 | 直接对齐，不产生迁移文件，**对已有数据的破坏性变更可能失败** |
| `prisma migrate dev` | `npx prisma migrate dev --name add_xxx_table` | 团队协作 / 生产 | 每次改动生成一个 `.sql` 迁移文件，可版本化、可回滚、可审计 |

个人知识库因为是个人项目 + 已有表结构先于 Prisma 存在，我们选择用 **`db push`** 即可：

```bash
npm run prisma:push
# 等价 npx prisma db push --skip-generate
```

如果后续加入"标签 / 用户 / 会话元数据"等新模型、需要团队协作，请切到 `migrate dev`。

### 8. 与原生 SQL / `pg` 包共存

Prisma 不是"要么全用要么不用"。在以下场景里非常适合**混用**：

- **LangGraph 的 PostgresSaver**：它内部就用原生 `pg` 包，不接受 Prisma 作为后端；你只需要在 schema.prisma 里把 checkpoint 表的**结构映射**出来，方便将来写清理脚本即可。
- **复杂 SQL**：多表 JOIN + CTE + 窗口函数等 Prisma 难以表达的查询，可以用 `prisma.$queryRaw` 直接执行 SQL。
- **DDL 清理操作**（TRUNCATE / RESET SEQUENCE）：Prisma 没有对应的方法，用原生 `pg` 或 `$executeRaw` 更方便。

---

## 流程图解

```
┌──────────────────────────────────────────────────────────────────────┐
│  1) prisma/schema.prisma 描述 5 张表                                  │
│     Document  Checkpoints  CheckpointBlobs  CheckpointWrites          │
│     CheckpointMigrations                                              │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ 2) npx prisma generate
                             ▼
               node_modules/@prisma/client（类型 + 运行时）
                             │
    ┌────────────────────────┴────────────────────────────┐
    │                     3) 业务代码                       │
    │  documentRegistry.ts / ingest.ts / routes/*          │
    │  prisma.document.upsert(...)                         │
    │  prisma.document.findMany(...)                       │
    │  prisma.document.count + aggregate 并发统计          │
    └────────────────────────┬────────────────────────────┘
                             │
                             ▼
                PostgreSQL (Docker postgres-db :5432)
                       ├ documents                （Prisma 读写）
                       ├ checkpoints / *_blobs / *_writes / *_migrations （PostgresSaver pg 直连写）
                       └ checkpoint_migrations     （LangGraph 迁移记录）
```

---

## 实战：从零在本项目中体验 Prisma

### 步骤 1：确认 Docker PostgreSQL 在运行

```bash
docker compose up -d
docker ps | grep postgres
# 应当看到 postgres-db，状态 healthy，端口 0.0.0.0:5432->5432
```

### 步骤 2：安装依赖 & 生成 Client

```bash
# 根目录
npm install prisma --save-dev
npm install @prisma/client

# 然后
npm run prisma:generate   # 等价 npx prisma generate
npm run prisma:push       # 可选，把 schema 对齐到数据库（表已存在则无破坏性）
```

> 💡 如果 bun 因为沙箱临时目录权限无法安装，就像本项目在 Windows 环境的处理方式一样，使用 `npm install --legacy-peer-deps`，它同样会把 `prisma` 和 `@prisma/client` 安装到 node_modules。

### 步骤 3：写一个 30 行的最小 CRUD 小脚本

```ts
// src/prisma-quick-demo.ts
import { getPrisma } from "./real-project-combat/server/services/prisma.js";

const prisma = getPrisma();

async function main() {
  // 1) upsert：不存在则插入，存在则更新
  const row = await prisma.document.upsert({
    where: { sourcePath: "hello-prisma.md" },
    create: {
      sourcePath: "hello-prisma.md",
      fileHash: "demo-hash",
      chunkCount: 2,
      status: "indexed",
      lastIngestedAt: new Date(),
    },
    update: { chunkCount: { increment: 1 }, status: "indexed" },
  });
  console.log("upsert 结果:", row.id, row.sourcePath, row.chunkCount);

  // 2) 列表
  const list = await prisma.document.findMany({
    where: { status: "indexed" },
    take: 5,
    orderBy: { lastIngestedAt: { sort: "desc", nulls: "last" } },
  });
  console.log("最近 5 条索引文档:", list.map(d => ({ id: d.id, source: d.sourcePath })));

  // 3) 统计
  const [total, totalChunks] = await Promise.all([
    prisma.document.count(),
    prisma.document.aggregate({ _sum: { chunkCount: true } }),
  ]);
  console.log(`共 ${total} 篇，总 ${totalChunks._sum.chunkCount ?? 0} 分块`);

  // 4) 清理 demo
  await prisma.document.delete({ where: { sourcePath: "hello-prisma.md" } });
  console.log("demo 清理完成");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
```

然后运行：

```bash
bun run src/prisma-quick-demo.ts
```

你应该能依次看到 upsert 结果、最近 5 条文档、统计数字，最后 demo 被清理掉。

### 步骤 4：在个人知识库后端里触发真实的 Prisma CRUD

启动后端（如果尚未启动）：

```bash
npm run kb:server
```

触发知识库同步（会调用 `ingest.ts`，通过 Prisma 批量对 13 篇文档做 `upsert`）：

```bash
curl -X POST http://localhost:3001/api/knowledge/ingest
# 期望返回：{ ingested: [...], skipped: [...], failed: [], total: 13 }
```

随后查看统计（通过 Prisma 的 `count + aggregate`）：

```bash
curl http://localhost:3001/api/knowledge/stats
# {"sourceDir":"...","totalDocs":13,"totalChunks":...,"indexed":13,"failed":0}
```

文档列表（通过 `findMany` + orderBy desc）：

```bash
curl http://localhost:3001/api/knowledge/documents
# 返回数组，每条都是 snake_case：id / source_path / file_hash / chunk_count / status / last_ingested_at / created_at
```

---

## 进阶补充

### 关于 `@prisma/client` 里模型类型的命名冲突

在一个"LangChain + Prisma"同仓的 TypeScript 工程里，**最容易踩的陷阱**是：Prisma 生成了 `Document` 类型（映射 `documents` 表），而 LangChain 的核心也导出了同名 `Document` 类型（表示"文档分块"：pageContent + metadata）。结果 TypeScript 的符号解析会冲突，IDE 会表现为：

> 模块 `@prisma/client` 没有导出的成员 `Document`

这个错误并不是 Prisma 真的没导出类型，而是 TS 在多个同名 namespace 中做了错误选择。解决办法有两个：

1. **（推荐）不要导入裸 `Document`，而是自己从 Prisma 查询返回值反向推导一个别名**。本项目的 `documentRegistry.ts` 就是这么做的：
   ```ts
   type PrismaDocFn = ReturnType<typeof getPrisma>["document"]["findUnique"];
   type PrismaDocAwait = Awaited<ReturnType<PrismaDocFn>>;
   export type DocumentRecord = Exclude<PrismaDocAwait, null>;
   ```
2. 用 **namespace import**：`import type * as P from "@prisma/client";`，再在代码里写 `P.Document`，避免和 LangChain 的同名撞车。

两种都能彻底解决问题，本项目选择方案 1，让调用方少打几个字（`DocumentRecord`）。

### Prisma CLI / Client 的版本一致性

`prisma`（CLI）和 `@prisma/client`（运行时）必须保持**同一版本**。

```diff
 "devDependencies": {
+  "prisma": "^6.19.3"
 },
 "dependencies": {
+  "@prisma/client": "^6.19.3"
 }
```

如果你升级了其中一个，务必同步升级另一个并重新 `prisma generate`，否则运行时会报"query engine 版本不匹配"。

### 事务：需要"要么全部成功要么全部失败"怎么办？

Prisma 提供 `$transaction` 两种模式：

```ts
// 模式 A：批量操作数组（简单）
await prisma.$transaction([
  prisma.document.create({ data: { /* ... */ } }),
  prisma.document.create({ data: { /* ... */ } }),
]);

// 模式 B：函数式（可加条件判断）
await prisma.$transaction(async (tx) => {
  const doc = await tx.document.findUnique({ where: { sourcePath: "a.md" } });
  if (doc) await tx.document.delete({ where: { id: doc.id } });
  // 中途任何异常都会自动 rollback
});
```

在个人知识库的 `ingest.ts` 里，"删除一个文档的旧 Qdrant 分块 → 插入新分块 → 更新注册表" 这三步并没有包在同一个 PG 事务里（因为 Qdrant 不参与 PG 事务），所以采用的是"失败标记 failed 状态"的最终一致性策略。将来如果你把注册表改成多表，就可以考虑用事务包起来。

### 性能与连接池

- Prisma Client 内置连接池，默认 9 个连接（和 Node.js 事件循环 1 主 + 8 工作线程对齐），小项目默认就够用。
- 可以在 `new PrismaClient({ datasources: { db: { url: "..." } } })` 里追加连接串参数（如 `?connection_limit=15&pool_timeout=10`）调整连接池。
- 生产环境里记得在**进程退出前调用 `await prisma.$disconnect()`**，避免 PG 连接泄露。

### 常见坑位速查

1. **`DATABASE_URL` 没配 / 写错**：IDE 里写 schema 时会高亮，`prisma generate` 也会显式报错"找不到 url"。
2. **`prisma generate` 之后 tsc 仍报找不到 `@prisma/client`**：多半是 Prisma 安装/生成目录不在预期路径，重新 `npm run prisma:generate` 一次基本解决；另外 Bun/TS 项目别忘了配置路径解析。
3. **用了 `@map` 但代码里还写 PG 列名**：一旦你写了 `sourcePath @map("source_path")`，**所有 Prisma 查询都必须用 TS 字段名**——`where: { sourcePath: "x" }`，`where: { source_path: "x" }` 会编译不过。
4. **找不到类型 `Document` / 其他模型类型**：见上面"命名冲突"章节，请用别名 `DocumentRecord` 或 namespace import。
5. **`prisma db push` 失败：有数据的表新增非空列无默认值**：要么给 schema 里补 `@default(...)`，要么先写迁移脚本手动回填，避免破坏已有数据。
6. **时间戳时区对不上**：一律使用 `@db.Timestamptz()`（timestamptz），避免 `timestamp without time zone` 的跨时区坑。

### 下一步建议

- 阅读 `prisma/schema.prisma` 看个人知识库是怎么映射 5 张表的；之后可以尝试给 `Document` 模型增加 `tags String[]` 或 `sizeBytes Int` 等字段，执行 `prisma db push` 观察结构变化。
- 在本项目 `documentRegistry.ts` 里尝试扩展一个"按状态筛选 + 分页"的方法（`listByStatus`），体会 Prisma 的 `where / orderBy / take / skip` 组合有多好用。
- 生产中如果需要迁移可追溯、可回滚，尝试切换到 `prisma migrate dev`，你会得到一个版本化的 SQL 迁移文件夹（`prisma/migrations/`）。
