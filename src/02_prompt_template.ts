/**
 * ============================================================
 * 示例 02: 提示词模板 (Prompt Templates)
 * ============================================================
 *
 * 提示词模板让你可以复用和参数化提示词，避免每次手动拼接字符串。
 *
 * 【你将学到】
 * 1. PromptTemplate - 简单字符串模板
 * 2. ChatPromptTemplate - 对话格式模板（推荐！）
 * 3. 如何用 .pipe() 将模板和模型串联
 *
 * 【为什么要用模板？】
 * - 避免字符串拼接的错误和混乱
 * - 统一管理提示词格式
 * - 便于动态替换变量
 *
 * 【Python 对比】
 *   from langchain.prompts import PromptTemplate, ChatPromptTemplate
 *   prompt = PromptTemplate.from_template("翻译{input}为{language}")
 *   chat_prompt = ChatPromptTemplate.from_messages([("system", "..."), ("human", "{question}")])
 */
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.7);

  // ===========================
  // 1. PromptTemplate - 简单字符串模板
  // ===========================
  // {input} 和 {language} 是占位符，调用时用实际值替换
  // 类似 Python 的 f-string 或 str.format()
  console.log("=== 示例 2.1: PromptTemplate（字符串模板）===");

  const translatePrompt = PromptTemplate.fromTemplate(
    "请将以下文本翻译成{language}，只返回翻译结果，不要解释：\n\n{input}"
  );

  // format() 返回纯字符串（不是消息对象）
  const formatted = await translatePrompt.format({
    input: "LangChain makes it easy to build LLM applications",
    language: "中文",
  });

  
  console.log("格式化后的提示词:\n", formatted);

  // ===========================
  // 2. ChatPromptTemplate - 对话格式模板（更常用！）
  // ===========================
  // fromMessages() 接受消息数组，每条消息是 [角色, 模板] 元组
  // 角色可以是: "system" / "human" / "ai"（用于 few-shot 示例）
  console.log("\n=== 示例 2.2: ChatPromptTemplate（对话模板）===");

  const chatPrompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一位{role}，请用{style}的风格回答问题"],
    ["human", "{question}"],
  ]);

  // formatMessages() 返回消息对象数组（不是纯字符串）
  // 这些消息对象可以直接传给模型
  const messages = await chatPrompt.formatMessages({
    role: "Python 转 TypeScript 的迁移专家",
    style: "简洁明了、带代码示例",
    question: "Python 的列表推导式在 TypeScript 中怎么写？",
  });
  console.log("格式化后的消息:");
  messages.forEach((m) => {
    const content = m.content.toString();
    const preview = content.length > 60 ? content.slice(0, 60) + "..." : content;
    console.log(`  [${m.type}]`, preview);
  });

  // ===========================
  // 3. 模板 + 模型 = 完整调用
  // ===========================
  // .pipe() 是 LCEL 的核心方法，将两个组件串联
  // 数据从左边流向右边：prompt → model
  console.log("\n=== 示例 2.3: 模板 + 模型调用 ===");

  const chain = chatPrompt.pipe(model);

  const result = await chain.invoke({
    role: "TypeScript 教师",
    style: "通俗易懂",
    question: "interface 和 type 有什么区别？",
  });
  console.log("回复:", result.content);

  
  console.log("\n=== Token 使用情况 ===");
  console.log("输入 tokens:", result.usage_metadata?.input_tokens);
  console.log("输出 tokens:", result.usage_metadata?.output_tokens);
  console.log("总 tokens:", result.usage_metadata?.total_tokens);
}

main().catch(console.error);
