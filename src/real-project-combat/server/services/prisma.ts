/**
 * 个人知识库 - Prisma Client 单例
 * 所有 PostgreSQL 文档注册表的增删改查统一走 Prisma。
 * 注：PostgresSaver（对话记忆）仍使用 pg Client 直接操作 checkpoint* 表，
 * 但也可以通过 prisma 辅助查询/清理。
 */
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;

/**
 * 获取 PrismaClient 单例
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      // 开发期可以打开查询日志：
      // log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }
  return prisma;
}
