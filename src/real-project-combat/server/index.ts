/**
 * 个人知识库 - 服务入口（bun）
 * 启动 Hono 服务：bun run src/real-project-combat/server/index.ts
 */
import { app } from "./app.js";
import { config } from "./services/config.js";

const server = Bun.serve({
  port: config.serverPort,
  // 入库/问答等长请求可能超过默认 10s，放宽空闲超时（Bun 上限 255s）
  idleTimeout: 255,
  fetch: app.fetch,
});

console.log(`╔══════════════════════════════════════════╗`);
console.log(`║    个人知识库服务已启动                   ║`);
console.log(`╚══════════════════════════════════════════╝`);
console.log(`  服务地址 : http://localhost:${server.port}`);
console.log(`  健康检查 : http://localhost:${server.port}/api/health`);
console.log(`  知识库   : ${config.knowledgeSourceDir}`);
console.log(`  Qdrant   : ${config.qdrantUrl} (集合 ${config.qdrantCollection})`);
console.log(`  Embedding: ${config.embeddingModel} (Ollama)`);
console.log(`  LLM      : ${config.mimoModel} (Mimo 在线模型)`);
