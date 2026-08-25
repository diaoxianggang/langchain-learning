/**
 * ============================================================
 * 示例 10: 进阶工具调用 (Advanced Tool Calling)
 * ============================================================
 *
 * 在示例 07 的基础上，展示工具在实际应用中的进阶用法：
 * 工具自动循环、多工具协作、错误处理、工具结果反馈。
 *
 * 【你将学到】
 * 1. ReAct 循环：模型 → 工具 → 结果反馈 → 模型 → 最终回答
 * 2. 多工具协作：模型根据问题自动选择不同工具
 * 3. 工具错误处理：工具失败时的优雅降级
 * 4. 工具结果组装为 ToolMessage 反馈给模型
 *
 * 【与示例 07 的区别】
 *   07: 模型调用一次工具就结束了（手动执行）
 *   10: 完整的 自动循环，模型可以多次调用工具直到完成任务
 *
 * 【Python 对比】
 *   Python 中用 create_react_agent() 自动完成循环
 *   TypeScript 中目前需要手动实现循环逻辑（或使用 @langchain/langgraph）
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createMimoModel } from "./config.js";

async function main() {
  // ===========================
  // 1. 定义多个工具
  // ===========================
  console.log("=== 示例 10.1: 定义工具集 ===\n");

  // 数学计算器
  const calculatorTool = tool(
    async ({ expression }) => {
      try {
        // 安全的数学表达式求值
        const result = Function(`"use strict"; return (${expression})`)();
        return JSON.stringify({ result, expression });
      } catch {
        return JSON.stringify({ error: `无法计算: ${expression}` });
      }
    },
    {
      name: "calculator",
      description: "数学计算器，输入数学表达式返回结果。适用于加减乘除、幂运算等。",
      schema: z.object({
        expression: z.string().describe("数学表达式，如 2+3*4, 100/3, 2**10"),
      }),
    }
  );

  // 单位换算工具
  const unitConverterTool = tool(
    async ({ value, from, to }) => {
      const conversions: Record<string, string> = {
        "km-miles": `${value} km = ${(value * 0.621371).toFixed(2)} miles`,
        "miles-km": `${value} miles = ${(value * 1.60934).toFixed(2)} km`,
        "kg-lbs": `${value} kg = ${(value * 2.20462).toFixed(2)} lbs`,
        "lbs-kg": `${value} lbs = ${(value * 0.453592).toFixed(2)} kg`,
        "c-f": `${value}°C = ${(value * 9 / 5 + 32).toFixed(1)}°F`,
        "f-c": `${value}°F = ${((value - 32) * 5 / 9).toFixed(1)}°C`,
      };
      const key = `${from}-${to}`;
      const conv = conversions[key];
      if (conv) return conv;
      return `暂不支持 ${from} 到 ${to} 的换算`;
    },
    {
      name: "unit_converter",
      description: "单位换算工具。支持: km↔miles, kg↔lbs, c↔f（温度）。",
      schema: z.object({
        value: z.number().describe("要换算的数值"),
        from: z.string().describe("原始单位，如 km, miles, kg, lbs, c, f"),
        to: z.string().describe("目标单位，如 km, miles, kg, lbs, c, f"),
      }),
    }
  );

  // 文本统计工具
  const textStatsTool = tool(
    async ({ text }) => {
      const chars = text.length;
      const words = text.trim().split(/\s+/).length;
      const lines = text.split("\n").length;
      return JSON.stringify({ characters: chars, words, lines });
    },
    {
      name: "text_stats",
      description: "统计文本的字符数、单词数和行数。",
      schema: z.object({
        text: z.string().describe("要统计的文本内容"),
      }),
    }
  );

  const tools = [calculatorTool, unitConverterTool, textStatsTool];
  tools.forEach((t) => console.log(`  ✓ ${t.name}: ${t.description}`));

  // ===========================
  // 2. ReAct 循环：自动工具调用
  // ===========================
  // 核心思路：
  //   1) 用户消息 + 系统提示 → 模型（绑定工具）
  //   2) 如果模型返回 tool_calls → 执行工具 → 将结果作为 ToolMessage 追加到消息列表
  //   3) 再次调用模型，直到模型不再调用工具 → 返回最终文本回答
  console.log("\n=== 示例 10.2: ReAct 自动循环 ===\n");

  /**
   * ReAct Agent 循环
   * @param userQuestion 用户的问题
   * @param maxIterations 最大循环次数（防止无限循环）
   */
  async function reactAgent(userQuestion: string, maxIterations = 5) {
    const model = await createMimoModel(0.3);
    const modelWithTools = model.bindTools(tools);

    // 构建消息列表：系统提示 + 用户问题
    const messages: (HumanMessage | AIMessage | ToolMessage)[] = [
      new HumanMessage(userQuestion),
    ];

    console.log(`📝 用户: ${userQuestion}\n`);

    for (let i = 0; i < maxIterations; i++) {
      // 调用模型
      const response = await modelWithTools.invoke(messages);

      if (response.tool_calls && response.tool_calls.length > 0) {
        // 模型决定调用工具
        console.log(`🔄 第 ${i + 1} 轮 - 模型请求调用工具:`);
        // 将模型的回复（含 tool_calls）加入消息列表
        messages.push(response);

        // 逐个执行工具
        for (const tc of response.tool_calls) {
          console.log(`   🔧 调用 ${tc.name}(${JSON.stringify(tc.args)})`);

          const targetTool = tools.find((t) => t.name === tc.name);
          if (targetTool) {
            try {
              const result = await (targetTool as any).invoke(tc.args);
              console.log(`   ✅ 结果: ${result}`);
              // 将工具结果作为 ToolMessage 追加
              messages.push(new ToolMessage(result, tc.id!));
            } catch (err) {
              const errorMsg = `工具执行失败: ${err}`;
              console.log(`   ❌ ${errorMsg}`);
              messages.push(new ToolMessage(errorMsg, tc.id!));
            }
          } else {
            const errorMsg = `未知工具: ${tc.name}`;
            console.log(`   ❌ ${errorMsg}`);
            messages.push(new ToolMessage(errorMsg, tc.id!));
          }
        }
      } else {
        // 模型不再调用工具，返回最终回答
        console.log(`💬 最终回答: ${response.content}`);
        return response.content;
      }
    }

    console.log("⚠️ 达到最大循环次数");
    return "无法在限定步骤内完成任务";
  }

  // 测试 1: 需要计算的问题
  await reactAgent("如果一辆车以 120 km/h 的速度行驶 2.5 小时，总距离是多少公里？换算成英里是多少？");

  console.log("\n---\n");

  // 测试 2: 需要单位换算的问题
  await reactAgent("今天北京 35°C，换算成华氏度是多少？");

  // ===========================
  // 3. 工具错误处理
  // ===========================
  console.log("\n=== 示例 10.3: 工具错误处理 ===\n");

  // 带错误处理的工具调用
  const fragileTool = tool(
    async ({ url }) => {
      // 模拟一个可能失败的网络请求
      if (!url.startsWith("https://")) {
        throw new Error("仅支持 HTTPS 协议");
      }
      return `成功访问 ${url}`;
    },
    {
      name: "fetch_url",
      description: "访问指定 URL 并返回内容",
      schema: z.object({
        url: z.string().describe("要访问的 URL"),
      }),
    }
  );

  // 直接调用测试错误处理
  try {
    const result = await fragileTool.invoke({ url: "http://example.com" });
    console.log("结果:", result);
  } catch (err) {
    console.log("捕获错误:", (err as Error).message);
  }

  // 正常调用
  const result = await fragileTool.invoke({ url: "https://example.com" });
  console.log("正常结果:", result);

  // ===========================
  // 4. LCEL 链中的工具集成
  // ===========================
  // 将工具调用能力嵌入 LCEL 链，实现更复杂的数据处理管道
  console.log("\n=== 示例 10.4: LCEL 链中的工具集成 ===\n");

  // 创建一个带工具的分析链
  const analysisPrompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个数据分析师。用计算器工具完成计算，然后用文字总结结果。"],
    ["human", "{question}"],
  ]);

  // 构建链：prompt → model(带工具)
  const baseModel = await createMimoModel(0.3);
  const analysisModel = baseModel.bindTools([calculatorTool]);
  const analysisChain = analysisPrompt.pipe(analysisModel);

  const analysisResult = await analysisChain.invoke({
    question: "如果一个产品单价 99 元，卖出 1500 件，总营收是多少？",
  });

  console.log("分析链结果:", analysisResult.content);
  if (analysisResult.tool_calls && analysisResult.tool_calls.length > 0) {
    for (const tc of analysisResult.tool_calls) {
      console.log(`  工具调用: ${tc.name}(${JSON.stringify(tc.args)})`);
      const toolResult = await calculatorTool.invoke(tc.args as any);
      console.log(`  计算结果: ${toolResult}`);
    }
  }
}

main().catch(console.error);
