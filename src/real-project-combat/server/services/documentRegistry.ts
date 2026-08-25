/**
 * 个人知识库 - 文档注册表（迁移至 Prisma ORM）
 * 完全替换原 pg 原生实现：所有增删改查 / 聚合统计统一走 Prisma。
 *
 * 模型类型不直接从 "@prisma/client" 导入裸 `Document`：
 *   - 本仓库的 LangChain 也导出了同名类型 `Document`（@langchain/core/documents），
 *     极易造成同名符号解析冲突，进而触发"@prisma/client 没有导出成员 Document"。
 *   - 这里通过 `getPrisma()` 的查询返回值反向推导 DocumentRecord，保证类型一致且
 *     与 Prisma Client 生成产物保持同步。
 */
import type { getPrisma as _getPrisma } from "./prisma.js";
import { getPrisma } from "./prisma.js";

/** 从 Prisma document.findUnique 的返回值推导 Document 记录类型 */
type PrismaDocFn = ReturnType<typeof _getPrisma>["document"]["findUnique"];
type PrismaDocAwait = Awaited<ReturnType<PrismaDocFn>>;
export type DocumentRecord = Exclude<PrismaDocAwait, null>;

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
  const doc = await getPrisma().document.findUnique({
    where: { sourcePath },
  });
  return doc ?? undefined;
}

/**
 * 插入或更新文档记录（以 source_path 为唯一键）
 */
export async function upsert(input: UpsertInput): Promise<void> {
  await getPrisma().document.upsert({
    where: { sourcePath: input.source_path },
    create: {
      sourcePath: input.source_path,
      fileHash: input.file_hash,
      chunkCount: input.chunk_count,
      status: input.status,
      lastIngestedAt: new Date(),
    },
    update: {
      fileHash: input.file_hash,
      chunkCount: input.chunk_count,
      status: input.status,
      lastIngestedAt: new Date(),
    },
  });
}

/**
 * 列出全部文档记录（按最后入库时间倒序）
 */
export async function listAll(): Promise<DocumentRecord[]> {
  return getPrisma().document.findMany({
    orderBy: { lastIngestedAt: { sort: "desc", nulls: "last" } },
  });
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
  const prisma = getPrisma();
  const [countRes, chunksRes, indexedRes, failedRes] = await Promise.all([
    prisma.document.count(),
    prisma.document.aggregate({
      _sum: { chunkCount: true },
    }),
    prisma.document.count({ where: { status: "indexed" } }),
    prisma.document.count({ where: { status: "failed" } }),
  ]);
  return {
    totalDocs: countRes,
    totalChunks: chunksRes._sum.chunkCount ?? 0,
    indexed: indexedRes,
    failed: failedRes,
  };
}
