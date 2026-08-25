/**
 * 个人知识库 - 知识库管理路由
 * /api/knowledge/* ：统计、文档列表、入库同步
 *
 * 注意：文档注册表数据层现已迁移到 Prisma（字段采用 camelCase）。
 * 为保持对外 API 字段稳定（snake_case），返回给前端前统一做一次字段重命名。
 *
 * 模型类型不直接从 "@prisma/client" 导入裸 `Document`，因为它与
 * LangChain 导出的 `Document` 同名，会触发符号解析冲突（IDE 表现为
 * "模块没有导出成员 Document"）。这里复用 documentRegistry 中从 Prisma
 * 查询返回值反向推导出来的等价类型 DocumentRecord。
 */
import { Hono } from "hono";
import { config } from "../services/config.js";
import { ingestAll } from "../services/ingest.js";
import {
  listAll,
  stats,
  type DocumentRecord,
} from "../services/documentRegistry.js";

export const knowledgeRoutes = new Hono();

function toSnakeRecord(d: DocumentRecord) {
  return {
    id: d.id,
    source_path: d.sourcePath,
    file_hash: d.fileHash,
    chunk_count: d.chunkCount,
    status: d.status,
    last_ingested_at: d.lastIngestedAt,
    created_at: d.createdAt,
  };
}

/** 知识库统计 */
knowledgeRoutes.get("/stats", async (c) => {
  const s = await stats();
  return c.json({ sourceDir: config.knowledgeSourceDir, ...s });
});

/** 已入库文档列表 */
knowledgeRoutes.get("/documents", async (c) => {
  const documents = (await listAll()).map(toSnakeRecord);
  return c.json({ documents });
});

/** 触发文档入库同步（增量） */
knowledgeRoutes.post("/ingest", async (c) => {
  const result = await ingestAll();
  return c.json(result);
});
