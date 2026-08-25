/**
 * 个人知识库 - 知识库管理路由
 * /api/knowledge/* ：统计、文档列表、入库同步
 */
import { Hono } from "hono";
import { config } from "../services/config.js";
import { ingestAll } from "../services/ingest.js";
import { listAll, stats } from "../services/documentRegistry.js";

export const knowledgeRoutes = new Hono();

/** 知识库统计 */
knowledgeRoutes.get("/stats", async (c) => {
  const s = await stats();
  return c.json({ sourceDir: config.knowledgeSourceDir, ...s });
});

/** 已入库文档列表 */
knowledgeRoutes.get("/documents", async (c) => {
  const documents = await listAll();
  return c.json({ documents });
});

/** 触发文档入库同步（增量） */
knowledgeRoutes.post("/ingest", async (c) => {
  const result = await ingestAll();
  return c.json(result);
});
