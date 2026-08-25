/**
 * 个人知识库 - 文本向量化模型
 * 使用本地 Ollama 部署的 qwen3-embedding:4b（2560 维），
 * 对文档分块与用户查询进行语义向量化。
 */
import { OllamaEmbeddings } from "@langchain/ollama";
import { config } from "./config.js";

export const embeddings = new OllamaEmbeddings({
  model: config.embeddingModel,
  baseUrl: config.ollamaBaseUrl,
});
