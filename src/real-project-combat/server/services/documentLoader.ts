/**
 * 个人知识库 - 文档解析模块
 * 递归扫描资料源目录，使用 LangChain TextLoader 解析文档文本，
 * 并基于内容计算 md5 哈希用于增量同步。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import type { Document } from "@langchain/core/documents";

/** 支持的文档扩展名 */
const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);

/**
 * 递归列出目录下所有受支持的文档文件（绝对路径，已排序）
 */
export async function listSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // 跳过隐藏文件/目录
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (
        SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(full);
      }
    }
  }

  await walk(dir);
  return files.sort();
}

/**
 * 解析单个文档文件为 Document 对象
 * @param absPath 文件绝对路径
 * @param rootDir 资料源根目录（用于生成相对路径作为 source 元数据）
 */
export async function loadFile(
  absPath: string,
  rootDir: string
): Promise<Document> {
  const loader = new TextLoader(absPath);
  const [doc] = await loader.load();
  const relPath = path.relative(rootDir, absPath).replace(/\\/g, "/");
  doc.metadata = { ...doc.metadata, source: relPath };
  return doc;
}

/**
 * 计算文本内容的 md5 哈希（用于增量同步检测）
 */
export function hashText(text: string): string {
  return crypto.createHash("md5").update(text, "utf8").digest("hex");
}
