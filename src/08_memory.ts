/**
 * ============================================================
 * 示例 08: 对话记忆 (Conversation Memory)
 * ============================================================
 *
 * 让 LLM 在多轮对话中"记住"之前的交互。
 *
 * 【你将学到】
 * 1. 如何用消息数组手动管理对话历史
 * 2. 多轮对话的上下文传递
 * 3. 历史管理的注意事项
 *
 * 【LangChain 的记忆机制】
 * LLM 本身没有记忆！每次调用都是独立的。
 * "记忆"的本质是：把之前的对话消息一起发给模型。
 * 所以你需要自己管理消息历史，每次调用时拼接进去。
 *
 * 【Python 对比】
 *   from langchain.memory import ConversationBufferMemory
 *   memory = ConversationBufferMemory(return_messages=True)
 *   # Python v0.2+ 也推荐使用 LangGraph 的 MemorySaver
 *
 * 【v1.x 变化】
 * LangChain v1.x 推荐使用 LangGraph 的 MemorySaver 实现持久化记忆。
 * 本示例展示手动管理历史的方式，适合理解原理。
 */
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.7);

  console.log("=== 示例 8: 多轮对话记忆 ===\n");

  // 对话历史数组 —— 这就是"记忆"的载体
  // 每次对话后，把新的消息追加到这个数组中
  // 下次调用时，把整个数组传给模型，模型就能"看到"之前的对话
  const chatHistory: (HumanMessage | AIMessage | SystemMessage)[] = [
    new SystemMessage("你是一个友好的助手，会记住对话历史。回答要简洁。"),
  ];

  // 模拟三轮对话
  const conversations = [
    "我叫小明，我喜欢 TypeScript",
    "我的名字是什么？",
    "推荐一个我可能会喜欢的技术",
  ];

  for (const userMessage of conversations) {
    // 每次调用时，把完整的历史拼接到 prompt 中
    const prompt = ChatPromptTemplate.fromMessages(chatHistory);
    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    console.log(`用户: ${userMessage}`);
    const reply = await chain.invoke({});
    console.log(`助手: ${reply}\n`);

    // 将本轮对话追加到历史
    chatHistory.push(new HumanMessage(userMessage));
    chatHistory.push(new AIMessage(reply));
  }

  // 展示历史消息结构
  console.log("=== 当前对话历史 ===");
  chatHistory.forEach((msg, i) => {
    const type = msg.type;
    const content = msg.content.toString();
    const preview = content.length > 60 ? content.slice(0, 60) + "..." : content;
    console.log(`  [${i}] ${type}: ${preview}`);
  });

  console.log("\n=== 关键点 ===");
  console.log("1. 对话历史存储在 chatHistory 数组中");
  console.log("2. 每次调用时，完整历史会包含在 prompt 中发给模型");
  console.log("3. 实际应用中，历史通常存在数据库/缓存中");
  console.log("4. 历史越长 = token 消耗越大，需要考虑截断策略");
  console.log("5. LangGraph 的 MemorySaver 可以自动管理历史（推荐生产使用）");
}

main().catch(console.error);
