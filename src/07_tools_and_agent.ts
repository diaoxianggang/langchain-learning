/**
 * ============================================================
 * 示例 07: 工具定义与调用 (Tools & Tool Calling)
 * ============================================================
 *
 * 工具让 LLM 能与外部世界交互：计算、查天气、调 API 等。
 * LLM 会根据用户问题，自主决定是否调用工具、调用哪个工具。
 *
 * 【你将学到】
 * 1. 用 tool() 定义自定义工具（Zod schema 描述参数）
 * 2. bindTools() 将工具绑定到模型
 * 3. 模型自动决定调用工具 + 手动执行工具结果
 *
 * 【工具调用的完整流程】
 *   用户提问 → 模型决定调用哪个工具 → 执行工具 → 将结果返回模型 → 模型生成最终回复
 *
 * 【Python 对比】
 *   from langchain.tools import tool
 *   @tool
 *   def calculator(expression: str) -> str: ...
 *
 * 【完整 Agent】
 * 本示例展示的是"单次工具调用"。
 * 完整的 ReAct Agent（自动循环调用工具直到完成任务）需要 @langchain/langgraph。
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.3);

  // ===========================
  // 1. 定义工具 (Tools)
  // ===========================
  // tool() 的参数：
  //   - 第一个参数：工具执行函数（异步）
  //   - 第二个参数：配置对象
  //     - name: 工具名称（LLM 用它来引用工具）
  //     - description: 工具描述（LLM 根据描述决定何时使用）
  //     - schema: Zod schema（告诉 LLM 需要什么参数）

  // 计算器工具：执行数学表达式
  const calculatorTool = tool(
    async ({ expression }) => {
      try {
        const result = Function(`"use strict"; return (${expression})`)();
        return `计算结果: ${expression} = ${result}`;
      } catch (e) {
        return `计算错误: 无法计算 "${expression}"`;
      }
    },
    {
      name: "calculator",
      description: "数学计算器。输入数学表达式（如 '2+3*4'），返回计算结果。",
      schema: z.object({
        expression: z.string().describe("数学表达式，如 2+3*4"),
      }),
    }
  );

  // 天气查询工具（模拟数据，实际项目中调用真实 API）
  const weatherTool = tool(
    async ({ city }) => {
      const mockWeather: Record<string, string> = {
        北京: "晴天，25°C",
        上海: "多云，28°C",
        深圳: "阵雨，30°C",
      };
      return mockWeather[city] || `${city}的天气数据暂不可用`;
    },
    {
      name: "get_weather",
      description: "查询指定城市的天气。返回天气状况和温度。",
      schema: z.object({
        city: z.string().describe("城市名称，如 北京、上海"),
      }),
    }
  );

  const tools = [calculatorTool, weatherTool];

  console.log("=== 已注册的工具 ===");
  tools.forEach((t) => console.log(`  - ${t.name}: ${t.description}`));

  // ===========================
  // 2. 绑定工具到模型
  // ===========================
  // bindTools() 让模型知道有哪些工具可用
  // 模型会根据用户问题自主决定是否调用工具
  console.log("\n=== 示例 7.1: 模型调用工具 ===\n");

  const modelWithTools = model.bindTools(tools);

  // 测试天气查询
  const response1 = await modelWithTools.invoke("北京今天天气怎么样？");
  console.log("用户: 北京今天天气怎么样？");
  console.log("模型回复:", response1.content);
  if (response1.tool_calls && response1.tool_calls.length > 0) {
    console.log("模型决定调用工具:");
    for (const tc of response1.tool_calls) {
      console.log(`  工具: ${tc.name}, 参数:`, tc.args);
      // 手动执行工具（实际项目中由 Agent 自动执行）
      const targetTool = tools.find((t) => t.name === tc.name) as any;
      const toolResult = await targetTool.invoke(tc.args);
      console.log(`  工具结果: ${toolResult}`);
    }
  }

  // 测试数学计算
  console.log("\n---");
  const response2 = await modelWithTools.invoke("帮我算一下 123 * 456 + 789");
  console.log("用户: 帮我算一下 123 * 456 + 789");
  console.log("模型回复:", response2.content);
  if (response2.tool_calls && response2.tool_calls.length > 0) {
    console.log("模型决定调用工具:");
    for (const tc of response2.tool_calls) {
      console.log(`  工具: ${tc.name}, 参数:`, tc.args);
      const toolResult = await calculatorTool.invoke(tc.args as any);
      console.log(`  工具结果: ${toolResult}`);
    }
  }

  // ===========================
  // 3. 直接调用工具（不经过模型）
  // ===========================
  // 工具也是 Runnable，可以直接调用
  console.log("\n=== 示例 7.2: 直接调用工具 ===\n");
  const calcResult = await calculatorTool.invoke({ expression: "100 * 3.14" });
  console.log("直接调用 calculator:", calcResult);

  const weatherResult = await weatherTool.invoke({ city: "深圳" });
  console.log("直接调用 get_weather:", weatherResult);

  // ===========================
  // 4. 完整 Agent 说明
  // ===========================
  console.log("\n=== 关于完整 Agent ===");
  console.log("上面演示了工具定义和模型调用工具的基本流程。");
  console.log("完整的 ReAct Agent（自动循环调用工具直到完成任务）需要:");
  console.log("  npm install @langchain/langgraph");
  console.log("然后使用:");
  console.log('  import { createAgent } from "langchain/agents";');
  console.log("  const agent = createAgent({ model, tools, systemPrompt: '...' });");
  console.log("  const result = await agent.invoke({ messages: [...] });");
}

main().catch(console.error);
