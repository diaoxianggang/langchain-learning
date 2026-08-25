/**
 * ============================================================
 * 示例 04: 输出解析器 (Output Parsers)
 * ============================================================
 *
 * LLM 默认返回纯文本，输出解析器帮你把文本转成结构化数据。
 *
 * 【你将学到】
 * 1. StringOutputParser - 提取纯文本字符串
 * 2. CommaSeparatedListOutputParser - 输出为数组
 * 3. JsonOutputParser - 输出为 JSON 对象
 *
 * 【为什么需要解析器？】
 * LLM 返回的是 AIMessage 对象（包含文本 + 元数据），
 * 我们通常只需要文本部分，或者需要把文本转成程序可用的数据结构。
 * 解析器就是做这个转换的。
 *
 * 【Python 对比】
 *   from langchain.output_parsers import CommaSeparatedListOutputParser
 *   parser = CommaSeparatedListOutputParser()
 *   result = parser.parse(text)
 */
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  StringOutputParser,
  CommaSeparatedListOutputParser,
  JsonOutputParser,
} from "@langchain/core/output_parsers";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.3); // 低温度 = 更确定性的输出（适合结构化任务）

  // ===========================
  // 1. StringOutputParser - 最常用
  // ===========================
  // 从 AIMessage 对象中提取 .content 字符串
  console.log("=== 示例 4.1: StringOutputParser ===");

  const stringParser = new StringOutputParser();
  const stringChain = ChatPromptTemplate.fromTemplate("用一句话解释{concept}")
    .pipe(model)
    .pipe(stringParser);

  const textResult = await stringChain.invoke({ concept: "闭包" });
  console.log("结果:", textResult);
  console.log("类型:", typeof textResult); // "string"

  // ===========================
  // 2. CommaSeparatedListOutputParser - 输出列表
  // ===========================
  // 解析器会自动在 prompt 中注入格式指令
  // 告诉 LLM "请用逗号分隔输出"
  // 所以你不需要在模板里写格式要求！
  console.log("\n=== 示例 4.2: CommaSeparatedListOutputParser ===");

  const listParser = new CommaSeparatedListOutputParser();
  const listChain = ChatPromptTemplate.fromTemplate(
    "列出3个{category}的代表性技术，用逗号分隔"
  )
    .pipe(model)
    .pipe(listParser);

  const listResult = await listChain.invoke({ category: "前端框架" });
  console.log("结果:", listResult);
  console.log("是数组?", Array.isArray(listResult)); // true

  // ===========================
  // 3. JsonOutputParser - 输出 JSON
  // ===========================
  // JsonOutputParser 会让 LLM 输出合法的 JSON
  // 并自动解析为 JS 对象
  // getFormatInstructions() 返回格式说明，注入到 prompt 中
  console.log("\n=== 示例 4.3: JsonOutputParser ===");

  const jsonParser = new JsonOutputParser();
  const jsonChain = ChatPromptTemplate.fromTemplate(
    `分析以下编程语言，返回 JSON 格式。
语言: {language}

{format}`
  )
    .pipe(model)
    .pipe(jsonParser);

  const jsonResult = await jsonChain.invoke({
    language: "TypeScript",
    format: jsonParser.getFormatInstructions(), // 自动注入 JSON 格式要求
  });
  console.log("结果:", JSON.stringify(jsonResult, null, 2));
  console.log("是对象?", typeof jsonResult === "object"); // true
}

main().catch(console.error);
