/**
 * 个人知识库 - 命令行入库脚本
 * 运行：bun run src/real-project-combat/scripts/ingest.ts
 * 便于在无前端的情况下独立执行文档入库与增量同步。
 */
import { ingestAll } from "../server/services/ingest.js";
import { config } from "../server/services/config.js";

async function main() {
  console.log(`资料源目录: ${config.knowledgeSourceDir}`);
  console.log(`开始入库同步...\n`);
  const result = await ingestAll();
  console.log(`\n入库完成: 共扫描 ${result.total} 个文件`);
  console.log(`  新增入库: ${result.ingested.length} 个`);
  console.log(`  跳过(未变更): ${result.skipped.length} 个`);
  console.log(`  失败: ${result.failed.length} 个`);
}

main().catch((err) => {
  console.error("入库失败:", err);
  process.exit(1);
});
