/**
 * 个人知识库 - 智能检索
 * 将用户查询向量化后在 Qdrant 中做相似度检索，返回相关文档分块及来源。
 */
import { getVectorStore } from "./vectorStore.js";

export interface RetrievedDoc {
  pageContent: string;
  source: string;
  chunkIndex: number;
  score: number;
}

/**
 * 语义检索：返回与 query 最相关的 k 个文档分块
 */
export async function retrieve(
  query: string,
  k = 4
): Promise<RetrievedDoc[]> {
  const results = await getVectorStore().similaritySearchWithScore(query, k);
  return results.map(([doc, score]) => ({
    pageContent: doc.pageContent,
    source: (doc.metadata.source as string) ?? "",
    chunkIndex: (doc.metadata.chunk_index as number) ?? -1,
    score,
  }));
}
