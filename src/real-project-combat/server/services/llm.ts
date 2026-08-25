/**
 * 个人知识库 - Mimo 在线模型封装
 * 通过 initChatModel + modelProvider:"openai" 接入小米 Mimo 在线模型，
 * 密钥与地址复用项目根 .env（OPENAI_API_KEY / OPENAI_BASE_URL）。
 */
import { initChatModel } from "langchain/chat_models/universal";
import { config } from "./config.js";

/**
 * 创建 Mimo 聊天模型实例（用于 Agent 问答生成）
 */
export async function createMimoModel(temperature = 0.3, maxTokens = 2048) {
  return await initChatModel(config.mimoModel, {
    modelProvider: "openai",
    temperature,
    maxTokens,
  });
}
