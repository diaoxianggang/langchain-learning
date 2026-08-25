/**
 * 个人知识库 - 文档注册表
 * 基于 PostgreSQL documents 表，管理文档入库元数据。
 */
import { getPg } from "./postgres.js";

export interface DocumentRecord {
  id: number;
  source_path: string;
  file_hash: string;
  chunk_count: number;
  status: string;
  last_ingested_at: Date | null;
  created_at: Date;
}

export interface UpsertInput {
  source_path: string;
  file_hash: string;
  chunk_count: number;
  status: string;
}

/**
 * 按相对路径查询文档记录
 */
export async function getByPath(
  sourcePath: string
): Promise<DocumentRecord | undefined> {
  const db = await getPg();
  const res = await db.query(
    "SELECT * FROM documents WHERE source_path = $1",
    [sourcePath]
  );
  return res.rows[0];
}

/**
 * 插入或更新文档记录（以 source_path 为唯一键）
 */
export async function upsert(input: UpsertInput): Promise<void> {
  const db = await getPg();
  await db.query(
    `INSERT INTO documents (source_path, file_hash, chunk_count, status, last_ingested_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (source_path)
     DO UPDATE SET file_hash = EXCLUDED.file_hash,
                   chunk_count = EXCLUDED.chunk_count,
                   status = EXCLUDED.status,
                   last_ingested_at = now()`,
    [input.source_path, input.file_hash, input.chunk_count, input.status]
  );
}

/**
 * 列出全部文档记录（按最后入库时间倒序）
 */
export async function listAll(): Promise<DocumentRecord[]> {
  const db = await getPg();
  const res = await db.query(
    "SELECT * FROM documents ORDER BY last_ingested_at DESC NULLS LAST"
  );
  return res.rows;
}

/**
 * 汇总统计
 */
export async function stats(): Promise<{
  totalDocs: number;
  totalChunks: number;
  indexed: number;
  failed: number;
}> {
  const db = await getPg();
  const res = await db.query(
    `SELECT COUNT(*)::int AS total,
            COALESCE(SUM(chunk_count), 0)::int AS chunks,
            COUNT(*) FILTER (WHERE status = 'indexed')::int AS indexed,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM documents`
  );
  return {
    totalDocs: res.rows[0].total,
    totalChunks: res.rows[0].chunks,
    indexed: res.rows[0].indexed,
    failed: res.rows[0].failed,
  };
}
