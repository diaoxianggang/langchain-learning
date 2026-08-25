/**
 * ============================================================
 * 共享模型配置 (Shared Model Configuration)
 * ============================================================
 *
 * 本文件封装了 MIMO 模型的初始化逻辑，所有示例文件复用此配置。
 *
 * 【为什么需要这个文件？】
 * 每个示例都需要连接同一个 LLM，如果每个文件都写一遍配置会很冗余。
 * 抽成共享模块后，改一处就全局生效。
 *
 * 【LangChain TS v1.x 核心概念】
 * - initChatModel: 通用聊天模型初始化函数，支持多提供商和运行时配置
 * - 即使你用的不是 OpenAI 的模型（如 MIMO），只要 API 格式兼容就能用
 *
 * 【Python 对比】
 *   from langchain.chat_models import initChatModel
 *   llm = initChatModel("openai:mimo-v2.5-pro", temperature=0.7)
 */
import "dotenv/config"; // 自动加载 .env 文件中的环境变量到 process.env
import { initChatModel } from "langchain/chat_models/universal";

/**
 * 创建 MIMO 聊天模型实例
 *
 * @param temperature - 温度参数 (0~1)
 *   0 = 最确定性，适合代码生成、翻译等精确任务
 *   1 = 最随机，适合创意写作、头脑风暴
 * @param maxTokens - 最大输出 token 数（1 个中文约 1.5~2 个 token）
 * @returns ConfigurableModel 实例，可直接调用 .invoke() / .stream()
 *
 * 【重要说明】
 * initChatModel 会自动从环境变量读取：
 *   - OPENAI_API_KEY → 对应 .env 中配置的 MIMO API Key
 *   - OPENAI_BASE_URL → 对应 .env 中配置的 MIMO API 地址
 * 所以不需要在代码中硬编码密钥！
 */
export async function createMimoModel(
  temperature = 0.7,
  maxTokens = 2048
) {
  return await initChatModel(process.env.MIMO_MODEL || "mimo-v2.5-pro", {
  modelProvider: "openai",
  // return await initChatModel('qwen3.5', {
  //   modelProvider: "ollama",
    temperature,
    maxTokens,
    // apiKey 和 baseURL 已通过 .env 自动注入，无需手动指定
  });
}
