/**
 * ============================================================
 * 示例 05: 流式输出 (Streaming)
 * ============================================================
 *
 * 流式输出让用户能逐步看到生成内容，而不是等全部生成完。
 * 这就是 ChatGPT 那种"打字机"效果的实现方式！
 *
 * 【你将学到】
 * 1. model.stream() - 模型级别流式
 * 2. chain.stream() - 链级别流式（推荐）
 * 3. 如何收集所有 chunk 合并为完整结果
 *
 * 【为什么用流式？】
 * - 用户体验好：不用等 10 秒才看到第一个字
 * - 感知延迟低：第一个 token 几百毫秒就出现
 * - 适合实时展示：聊天界面、实时翻译等
 *
 * 【Python 对比】
 *   for chunk in model.stream(messages):
 *       print(chunk.content, end="")
 */
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.7);

  // ===========================
  // 1. 模型级别流式输出
  // ===========================
  // .stream() 返回 AsyncIterable，用 for await...of 遍历
  // 每个 chunk 是一个 AIMessageChunk，.content 是当前批次的文本片段
  console.log("=== 示例 5.1: 模型流式输出 ===");
  console.log("逐 token 输出: ");

  const stream = await model.stream("用5句话介绍 TypeScript，每句一行");
  for await (const chunk of stream) {
    // process.stdout.write 不换行，模拟打字机效果
    process.stdout.write(chunk.content as string);
  }
  console.log("\n");

  // ===========================
  // 2. 链级别流式输出（推荐！）
  // ===========================
  // chain.stream() 直接输出解析后的字符串（不再是 AIMessageChunk）
  // 因为经过了 StringOutputParser，所以直接是纯文本
  console.log("=== 示例 5.2: 链式流式输出 ===");
  console.log("逐 token 输出: ");

  const prompt = ChatPromptTemplate.fromTemplate(
    "写一首关于{topic}的短诗，不超过4行"
  );
  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const chainStream = await chain.stream({ topic: "编程" });
  for await (const chunk of chainStream) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  // ===========================
  // 3. 收集所有 chunk 合并为完整结果
  // ===========================
  // 有时候你既想要流式体验，又需要完整结果
  // 可以先逐个收集 chunk，最后 join 成完整文本
  console.log("=== 示例 5.3: 收集流式结果 ===");

  const chunks: string[] = [];
  const fullStream = await chain.stream({ topic: "AI 未来" });
  for await (const chunk of fullStream) {
    chunks.push(chunk);
  }
  const fullText = chunks.join("");
  console.log("完整结果:", fullText);
  console.log("总共收到", chunks.length, "个 chunk");
}

main().catch(console.error);
