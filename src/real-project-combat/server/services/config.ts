/**
 * ============================================================
 * 个人知识库 - 服务端配置 (Service Configuration)
 * ============================================================
 * 统一读取环境变量并提供默认值。所有配置均可通过环境变量覆盖，
 * 满足"可配置知识库资料来源"等需求。
 */
import "dotenv/config"; // 加载项目根目录 .env
import path from "node:path";

export const config = {
  /** Hono 服务监听端口 */
  serverPort: Number(process.env.KB_SERVER_PORT ?? 3001),
  /** 知识库资料来源目录（默认本仓库 docs 目录） */
  knowledgeSourceDir:
    process.env.KB_SOURCE_DIR ?? path.join(process.cwd(), "docs"),
  /** 文本分块大小与重叠 */
  chunkSize: Number(process.env.KB_CHUNK_SIZE ?? 500),
  chunkOverlap: Number(process.env.KB_CHUNK_OVERLAP ?? 80),

  /** Ollama（本地向量化模型） */
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? "qwen3-embedding:4b",

  /** Qdrant（Docker 向量数据库） */
  qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
  qdrantCollection: process.env.QDRANT_COLLECTION ?? "kb_docs",

  /** PostgreSQL（Docker，文档注册表 + 对话记忆） */
  pgConnectionString:
    process.env.PG_CONNECTION_STRING ??
    "postgres://admin:Admin@123@localhost:5432/my_db",

  /** Mimo 在线模型 */
  mimoModel: process.env.MIMO_MODEL ?? "mimo-v2.5-pro",
} as const;
