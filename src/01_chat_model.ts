/**
 * ============================================================
 * 示例 01: 基础聊天模型 (Chat Model Basics)
 * ============================================================
 *
 * 这是最基础的示例，教你如何调用 LLM 获取回复。
 *
 * 【你将学到】
 * 1. 如何创建模型实例并调用 .invoke()
 * 2. LangChain 的三种消息类型：SystemMessage / HumanMessage / AIMessage
 * 3. 如何传入多轮对话上下文
 * 4. 如何查看 token 使用量
 *
 * 【Python 对比】
 *   from langchain_openai import ChatOpenAI
 *   from langchain.schema import HumanMessage, SystemMessage
 *   model = ChatOpenAI(model="xxx")
 *   response = model.invoke([SystemMessage("..."), HumanMessage("...")])
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createMimoModel } from "./config.js";

async function main() {
  // 创建模型实例（temperature=0.7 表示适度随机）
  const model = await createMimoModel(0.7);

  // ===========================
  // 1. 最简单的调用方式
  // ===========================
  // .invoke() 是 LangChain 的标准调用方法
  // 传入字符串时，LangChain 会自动包装成 HumanMessage
  console.log("=== 示例 1.1: 简单调用 ===");
  const response1 = await model.invoke("你好，请用一句话介绍自己");
  // response1 是一个 AIMessage 对象，.content 是文本内容
  console.log("回复:", response1.content);

  // ===========================
  // 2. 使用消息数组控制对话
  // ===========================
  // LangChain 用消息对象区分不同角色：
  //   SystemMessage - 系统指令，设定 AI 的行为和角色
  //   HumanMessage  - 用户消息（你对 AI 说的话）
  //   AIMessage     - AI 的回复（通常用于历史对话记录）
  console.log("\n=== 示例 1.2: 使用 SystemMessage 控制角色 ===");
  const response2 = await model.invoke([
    new SystemMessage("你是一位资深的 TypeScript 开发专家，回答要简洁专业"),
    new HumanMessage("什么是泛型？"),
  ]);
  console.log("回复:", response2.content);

  // ===========================
  // 3. 多轮对话上下文
  // ===========================
  // 把历史消息放在数组中一起传入，模型就能"记住"之前的对话
  // 注意：这不是真正的"记忆"，只是把历史消息全部发给模型
  // 真正的持久化记忆需要额外实现（见示例 08）
  console.log("\n=== 示例 1.3: 多轮对话上下文 ===");
  const response3 = await model.invoke([
    new SystemMessage("你是一个友好的助手"),
    new HumanMessage("我叫小明"),
    // 注意：这里没有 AIMessage 回复，模型会根据上下文推断
    new HumanMessage("你还记得我叫什么吗？"),
  ]);
  console.log("回复:", response3.content);

  // ===========================
  // 4. 查看 token 使用量
  // ===========================
  // token 是 LLM 计费的基本单位
  // 1 个中文字符 ≈ 1.5~2 个 token，1 个英文单词 ≈ 1 个 token
  console.log("\n=== Token 使用情况 ===");
  console.log("输入 tokens:", response3.usage_metadata?.input_tokens);
  console.log("输出 tokens:", response3.usage_metadata?.output_tokens);
  console.log("总 tokens:", response3.usage_metadata?.total_tokens);
}

main().catch(console.error);
