/**
 * ============================================================
 * 示例 06: 结构化输出 (Structured Output)
 * ============================================================
 *
 * 让 LLM 返回符合特定 schema 的 JSON 对象，而不是自由文本。
 * 这在实际项目中非常常用！比如让 AI 返回评分、分类、表单数据等。
 *
 * 【你将学到】
 * 1. 用 Zod 定义输出 schema（类似 Python 的 Pydantic）
 * 2. JsonOutputParser + Zod 校验（通用方案，兼容所有模型）
 * 3. withStructuredOutput()（OpenAI 原生方案，对比参考）
 *
 * 【为什么需要结构化输出？】
 * LLM 默认返回自由文本，你无法保证格式一致。
 * 结构化输出强制模型返回固定格式的数据，方便后续程序处理。
 *
 * 【Python 对比】
 *   from pydantic import BaseModel
 *   class MovieReview(BaseModel):
 *       title: str
 *       rating: float
 *   model.with_structured_output(MovieReview)
 */
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.3); // 低温度 = 更遵循 schema

  // ===========================
  // 1. 用 Zod 定义数据结构
  // ===========================
  // Zod 是 TypeScript 生态最流行的 schema 验证库
  // 类似 Python 的 Pydantic，用于定义和验证数据结构
  // .describe() 给每个字段加说明，帮助 LLM 理解该填什么
  const movieReviewSchema = z.object({
    title: z.string().describe("电影名称"),
    year: z.number().describe("上映年份"),
    rating: z.number().min(1).max(10).describe("评分，1-10"),
    pros: z.array(z.string()).describe("优点列表，至少2项"),
    cons: z.array(z.string()).describe("缺点列表，至少1项"),
    summary: z.string().describe("一句话总结"),
  });

  // ===========================
  // 2. JsonOutputParser + Zod 校验（通用方案，推荐！）
  // ===========================
  // 这种方式不依赖模型的 function calling 能力
  // 而是在 prompt 中告诉模型"请输出 JSON"，然后手动解析和校验
  console.log("=== 示例 6.1: JsonOutputParser 结构化输出 ===\n");

  const jsonParser = new JsonOutputParser();

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个影评专家。请评价以下电影，返回 JSON 格式。

电影: {movie}

要求返回如下 JSON 结构（不要输出其他内容，只输出 JSON）:
{{
  "title": "电影名称",
  "year": 上映年份(数字),
  "rating": 评分1-10(数字),
  "pros": ["优点1", "优点2"],
  "cons": ["缺点1"],
  "summary": "一句话总结"
}}`
  );

  const chain = prompt.pipe(model).pipe(jsonParser);

  const result = await chain.invoke({ movie: "星际穿越 (Interstellar)" });

  // .parse() 会校验数据是否符合 schema，不符合会抛出错误
  const parsed = movieReviewSchema.parse(result);

  console.log("类型安全的输出:");
  console.log("  标题:", parsed.title);
  console.log("  年份:", parsed.year);
  console.log("  评分:", parsed.rating + "/10");
  console.log("  优点:", parsed.pros);
  console.log("  缺点:", parsed.cons);
  console.log("  总结:", parsed.summary);

  // ===========================
  // 3. withStructuredOutput()（OpenAI 原生方案）
  // ===========================
  // 这是更"高级"的方式，利用模型的 function calling 能力
  // 但需要模型支持此功能，MIMO 目前不支持
  console.log("\n=== 示例 6.2: withStructuredOutput()（如果模型支持）===\n");

  try {
    const techSchema = z.object({
      name: z.string().describe("技术名称"),
      language: z.string().describe("主要编程语言"),
      useCases: z.array(z.string()).describe("使用场景"),
      difficulty: z.enum(["入门", "中级", "高级"]).describe("学习难度"),
      recommendation: z.string().describe("一句话推荐理由"),
    });

    const structuredModel = model.withStructuredOutput(techSchema);
    const techResult = await structuredModel.invoke("分析技术栈: Next.js");
    console.log("技术分析:", JSON.stringify(techResult, null, 2));
  } catch (error) {
    console.log("withStructuredOutput() 失败（MIMO 可能不支持 function calling）");
    console.log("解决方案: 使用上面的 JsonOutputParser 方案，兼容所有模型。");
  }
}

main().catch(console.error);
