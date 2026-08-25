/**
 * 个人知识库 - Qdrant 向量数据库
 * 封装 QdrantVectorStore 单例，负责文档向量存储与语义检索。
 * Qdrant 通过 Docker 部署（容器 qdrant-vector，端口 6333/6334）。
 */
import { QdrantVectorStore } from "@langchain/qdrant";
import { embeddings } from "./embeddings.js";
import { config } from "./config.js";

let store: QdrantVectorStore | undefined;

/**
 * 获取 QdrantVectorStore 单例（首次 addDocuments 会自动创建集合，
 * 向量维度由 embedding 模型决定 = 2560）
 */
export function getVectorStore(): QdrantVectorStore {
  if (!store) {
    store = new QdrantVectorStore(embeddings, {
      url: config.qdrantUrl,
      collectionName: config.qdrantCollection,
    });
  }
  return store;
}
