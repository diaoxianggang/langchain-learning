/**
 * 个人知识库 - 入库流水线
 * 文档解析 → 分块 → 向量化 → 写入 Qdrant → 更新 PostgreSQL 注册表。
 * 支持增量同步：基于内容 md5 判断新增 / 未变更 / 已变更。
 */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { config } from "./config.js";
import {
  listSourceFiles,
  loadFile,
  hashText,
} from "./documentLoader.js";
import { getVectorStore } from "./vectorStore.js";
import { getByPath, upsert } from "./documentRegistry.js";

export interface IngestResult {
  total: number;
  ingested: string[];
  skipped: string[];
  failed: string[];
}

const BATCH_SIZE = 100;

/**
 * 执行完整入库流水线
 */
export async function ingestAll(): Promise<IngestResult> {
  const files = await listSourceFiles(config.knowledgeSourceDir);
  const vectorStore = getVectorStore();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });

  const result: IngestResult = {
    total: files.length,
    ingested: [],
    skipped: [],
    failed: [],
  };

  for (const file of files) {
    try {
      const doc = await loadFile(file, config.knowledgeSourceDir);
      const source = doc.metadata.source as string;
      const fileHash = hashText(doc.pageContent);
      const existing = await getByPath(source);

      // 增量：内容未变化则跳过
      if (existing && existing.fileHash === fileHash) {
        result.skipped.push(source);
        continue;
      }

      // 增量：文件已变更 → 先从 Qdrant 删除该文件的旧分块
      if (existing) {
        await vectorStore.delete({
          filter: {
            must: [{ key: "source", match: { value: source } }],
          },
        });
      }

      // 文本分块
      const splitDocs = await splitter.splitDocuments([doc]);
      splitDocs.forEach((d, i) => {
        d.metadata = { ...d.metadata, source, chunk_index: i };
      });

      // 分批向量化并写入 Qdrant
      for (let i = 0; i < splitDocs.length; i += BATCH_SIZE) {
        await vectorStore.addDocuments(splitDocs.slice(i, i + BATCH_SIZE));
      }

      // 更新文档注册表
      await upsert({
        source_path: source,
        file_hash: fileHash,
        chunk_count: splitDocs.length,
        status: "indexed",
      });

      result.ingested.push(source);
      console.log(`[ingest] ✓ ${source} (${splitDocs.length} 分块)`);
    } catch (err) {
      result.failed.push(file);
      console.error(`[ingest] ✗ 处理失败: ${file}`, err);
    }
  }

  return result;
}
