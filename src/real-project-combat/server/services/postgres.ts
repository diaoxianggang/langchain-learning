/**
 * 个人知识库 - PostgreSQL 连接 / 文档注册表建表
 * —— 已迁移至 Prisma：
 *   - 客户端单例见 ./prisma.ts
 *   - 表结构（documents + checkpoint_*）在 prisma/schema.prisma 中声明
 * 该模块保留两个目的：
 *   1) 保持向后兼容（原有 PostgresSaver 仍使用 pg 连接）
 *   2) 首次启动时，若 documents 表不存在（例如未 db push），仍能兜底建表
 */
import { Client } from "pg";
import { config } from "./config.js";

let client: Client | undefined;

/**
 * 获取 pg Client 单例（供 PostgresSaver / 兜底建表使用）
 * 文档注册表的 CRUD 请走 prisma.ts，不要直接用此客户端查询 documents。
 */
export async function getPg(): Promise<Client> {
  if (!client) {
    client = new Client({ connectionString: config.pgConnectionString });
    await client.connect();
    await initSchema(client);
  }
  return client;
}

/**
 * 兜底建表：只在 documents 表不存在时执行一次，防止 Prisma db push 未执行时服务无法启动。
 * 推荐使用 `npx prisma db push` 以 schema.prisma 为准创建表。
 */
async function initSchema(db: Client): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      source_path TEXT NOT NULL UNIQUE,
      file_hash TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      last_ingested_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}
