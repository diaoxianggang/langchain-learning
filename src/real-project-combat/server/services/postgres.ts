/**
 * 个人知识库 - PostgreSQL 连接
 * Docker 部署的 PostgreSQL（容器 postgres-db，端口 5432）。
 * 职责一：文档注册表（记录已入库文档的元数据，支持增量同步）。
 * 说明：Agent 对话记忆使用 @langchain/langgraph-checkpoint-postgres 的
 * PostgresSaver，复用同一连接串，见 agent.ts。
 */
import { Client } from "pg";
import { config } from "./config.js";

let client: Client | undefined;

/**
 * 获取 pg 客户端单例（首次连接时自动建表）
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
 * 初始化文档注册表表结构
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
