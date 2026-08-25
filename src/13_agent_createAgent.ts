/**
 * ============================================================
 * 示例 13: 用 createAgent 一键创建生产级 Agent
 * ============================================================
 *
 * 示例 12 用 for 循环手写了 ReAct Agent，那是为了"看懂原理"。
 * 本示例改用 LangChain 官方提供的 `createAgent()`，一行代码
 * 就能创建生产级 ReAct Agent，实现与示例 12 完全相同的功能：
 * 同样的工具集 + 同样的多轮对话记忆。
 *
 * 【你将学到】
 * 1. createAgent() 的正确用法：model + tools + systemPrompt + checkpointer
 * 2. 手写循环没有的"免费"能力：checkpoint 持久化、thread_id 会话隔离、
 *    stream 流式、structured output、middleware 等
 * 3. createAgent 的 invoke 输入/输出结构与手写循环的对比
 *
 * 【与示例 12 对照】
 *   12: 手动维护 messages 数组 + for 循环 = 看原理
 *   13: createAgent + LangGraph checkpoint = 生产用法
 *
 * 【依赖说明】
 *   - createAgent 来自 "langchain"（已安装）
 *   - MemorySaver 来自 "@langchain/langgraph"（已安装，作为 langchain 的
 *     传递依赖随项目安装；为清晰起见在 package.json 中也显式声明）
 *
 * 【Python 对比】
 *   from langgraph.prebuilt import create_react_agent
 *   agent = create_react_agent(model, tools, prompt="...", checkpointer=MemorySaver())
 *   result = await agent.ainvoke({"messages": [...]}, {"configurable": {"thread_id": "1"}})
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createMimoModel } from "./config.js";

// ============================================================
// 第一部分：工具集 —— 与示例 12 完全一致
// ============================================================
// 说明：createAgent 的 tools 参数直接接受用 tool() 定义的工具，
//       与示例 12 中手动 bindTools 用的是同一批工具。

/** 工具 1：数学计算器 */
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return JSON.stringify({ expression, result });
    } catch {
      return JSON.stringify({ error: `无法计算表达式: ${expression}` });
    }
  },
  {
    name: "calculator",
    description:
      "数学计算器。输入数学表达式（如 '2+3*4'、'100/3'、'2**10'），返回计算结果。" +
      "适用于所有需要数值计算的场景。",
    schema: z.object({
      expression: z
        .string()
        .describe("数学表达式，如 2+3*4, 100/3.14, 2**10"),
    }),
  }
);

/** 工具 2：天气查询（模拟数据） */
const weatherTool = tool(
  async ({ city }) => {
    const mockWeather: Record<string, { temp: number; condition: string; humidity: number }> = {
      北京: { temp: 25, condition: "晴", humidity: 40 },
      上海: { temp: 28, condition: "多云", humidity: 65 },
      深圳: { temp: 30, condition: "阵雨", humidity: 80 },
      广州: { temp: 31, condition: "雷阵雨", humidity: 85 },
      成都: { temp: 22, condition: "阴", humidity: 70 },
      杭州: { temp: 27, condition: "晴转多云", humidity: 55 },
    };
    const data = mockWeather[city];
    if (data) {
      return JSON.stringify({
        city,
        temperature: `${data.temp}°C`,
        condition: data.condition,
        humidity: `${data.humidity}%`,
      });
    }
    return JSON.stringify({ city, error: `暂无 ${city} 的天气数据` });
  },
  {
    name: "get_weather",
    description: "查询指定城市的实时天气信息，包括温度、天气状况和湿度。",
    schema: z.object({
      city: z.string().describe("城市名称，如 北京、上海、深圳"),
    }),
  }
);

/** 工具 3：日期时间查询 */
const datetimeTool = tool(
  async () => {
    const now = new Date();
    return JSON.stringify({
      date: now.toLocaleDateString("zh-CN"),
      time: now.toLocaleTimeString("zh-CN"),
      weekday: ["日", "一", "二", "三", "四", "五", "六"][now.getDay()],
    });
  },
  {
    name: "get_datetime",
    description: "获取当前的日期、时间和星期几。当用户问到'今天'、'现在'等时间相关问题时使用。",
    schema: z.object({}),
  }
);

/** 工具 4：知识百科查询（模拟数据） */
const knowledgeTool = tool(
  async ({ topic }) => {
    const knowledge: Record<string, string> = {
      闭包:
        "闭包（Closure）是指一个函数能够记住并访问其词法作用域中的变量，即使该函数在其词法作用域之外执行。" +
        "在 JavaScript 中，每当创建一个函数，就会创建一个闭包。",
      递归:
        "递归（Recursion）是一种编程技巧，指函数直接或间接调用自身。" +
        "递归必须有终止条件（基线条件），否则会导致无限循环。",
      微服务:
        "微服务架构（Microservices）是一种将应用拆分为一组小型、独立部署的服务的架构风格。",
    };
    const result = knowledge[topic];
    if (result) {
      return JSON.stringify({ topic, content: result });
    }
    return JSON.stringify({ topic, content: `暂无关于"${topic}"的百科条目` });
  },
  {
    name: "knowledge_lookup",
    description:
      "查询技术概念和知识百科。适用于解释编程概念、技术术语、框架原理等。",
    schema: z.object({
      topic: z.string().describe("要查询的主题或概念，如 闭包、递归、微服务"),
    }),
  }
);

/** 工具 5：文本摘要工具 */
const textSummaryTool = tool(
  async ({ text, maxSentences }) => {
    const sentences = text
      .split(/[。！？.!?]/)
      .filter((s: string) => s.trim().length > 0);
    const summary = sentences.slice(0, maxSentences).join("。") + "。";
    return JSON.stringify({
      originalLength: text.length,
      summaryLength: summary.length,
      summary,
    });
  },
  {
    name: "text_summary",
    description: "对长文本进行摘要提取。输入文本和最大句数，返回精简摘要。",
    schema: z.object({
      text: z.string().describe("需要摘要的原文"),
      maxSentences: z
        .number()
        .default(3)
        .describe("摘要保留的最大句子数量，默认 3"),
    }),
  }
);

const allTools = [calculatorTool, weatherTool, datetimeTool, knowledgeTool, textSummaryTool];

// ============================================================
// 第二部分：系统提示词 —— 与示例 12 保持一致，方便对照
// ============================================================
const AGENT_SYSTEM_PROMPT = `你是一个智能助手 Agent，擅长利用各种工具帮助用户解决问题。

## 行为准则
1. **先思考再行动**：收到问题后，先分析是否需要调用工具，不要盲目调用
2. **按需调用**：只在确实需要时才调用工具，简单问题直接回答
3. **准确选工具**：根据问题类型选择最合适的工具
4. **组合使用**：复杂问题可能需要多次调用不同工具，逐步获取信息
5. **总结回答**：工具执行完毕后，用自然语言总结结果，不要直接输出 JSON

## 工具使用指南
- 计算器：数学计算、数值推理
- 天气查询：实时天气信息
- 日期时间：当前时间、日期计算
- 知识百科：技术概念解释
- 文本摘要：长文本精简

## 回复风格
- 使用中文回答
- 语言简洁明了
- 涉及数据时给出具体数字
- 不确定的信息要明确说明`;

// 从消息历史中提取最后一条 AI（Agent）回复的纯文本，用于显示
function extractLastText(messages: { type: string; content: any }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    // 跳过工具调用类消息（LANGGRAPH_AI_TYPE 中以 tool_calls 结尾的消息）
    const msg = messages[i];
    if (!msg.type.startsWith("ai") && !msg.type.includes("ai")) continue;
    if (typeof msg.content === "string" && msg.content.trim()) {
      return msg.content;
    }
  }
  return "(无文本回复)";
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     示例 13: createAgent 一键创建 Agent          ║");
  console.log("╚══════════════════════════════════════════════════╝");

  // 创建模型实例（与示例 12 相同）
  const model = await createMimoModel(0.3);

  // ===========================
  // 示例 13.2：一次性问答（无记忆）
  // ===========================
  // createAgent 最简用法：model + tools + systemPrompt
  // 每次 invoke 都是独立的，不保留对话历史 —— 与示例 12 的 agentAsk 等价
  console.log("\n\n=== 示例 13.1: createAgent 基本问答 ===");

  const agentBasic = createAgent({
    model,                                // 语言模型（也可传模型名字符串，如 "openai:gpt-4o"）
    tools: allTools,                      // 工具集 —— 与示例 12 相同
    systemPrompt: AGENT_SYSTEM_PROMPT,    // 行为规范
  });

  // invoke 的输入是 { messages: [...] }，返回合并后的完整 state（含 messages）
  // 这与手写循环第 12 节"把消息列表发给模型"是同一套思路
  const result1 = await agentBasic.invoke({
    messages: [new HumanMessage("北京今天天气怎么样？")],
  });
  console.log("\n📝 用户: 北京今天天气怎么样？");
  console.log(`💬 Agent: ${extractLastText(result1.messages)}`);

  console.log("\n---");
  const result2 = await agentBasic.invoke({
    messages: [new HumanMessage("如果一个长方形的长是 12.5 米，宽是 8.3 米，面积和周长分别是多少？")],
  });
  console.log("📝 用户: 如果一个长方形的长是 12.5 米，宽是 8.3 米，面积和周长分别是多少？");
  console.log(`💬 Agent: ${extractLastText(result2.messages)}`);

  // ===========================
  // 示例 13.2：多步骤任务（Agent 自动分解）
  // ===========================
  console.log("\n\n=== 示例 13.2: 多步骤任务 ===");
  const result3 = await agentBasic.invoke({
    messages: [new HumanMessage("上海今天多少度？如果温度升高 5 度，换算成华氏度是多少？")],
  });
  console.log("📝 用户: 上海今天多少度？如果温度升高 5 度，换算成华氏度是多少？");
  console.log(`💬 Agent: ${extractLastText(result3.messages)}`);

  // ===========================
  // 示例 13.3：带记忆的 Agent —— 区别最大的一处
  // ===========================
  // 手写循环（示例 12）：在内存里手动维护 messages 数组 = 会话结束即丢失
  // createAgent + checkpointer：状态写入 checkpoint + 按 thread_id 隔离会话
  //   → 同一个 thread_id 下的多轮 invoke 会自动拼接历史消息
  //   → 服务重启后仍可通过 checkpointer 恢复，实现真正的持久化记忆
  console.log("\n\n=== 示例 13.3: 带记忆的 Agent（checkpoint + thread_id）===");

  // MemorySaver 是 LangGraph 提供的内存版 checkpoint 存储
  const checkpointer = new MemorySaver();

  // 传入 checkpointer 后，Agent 才能"记住"跨 invoke 的状态
  const agentWithMemory = createAgent({
    model,
    tools: allTools,
    systemPrompt: AGENT_SYSTEM_PROMPT,
    checkpointer, // 关键：开启状态持久化
  });

  // thread_id 是会话的唯一标识。同一个 id 的多轮调用共享历史，不同 id 互不干扰。
  const threadId = "study-mimo-session-001";

  // 第 1 轮：问天气
  const turn1 = await agentWithMemory.invoke(
    { messages: [new HumanMessage("北京今天天气怎么样？")] },
    { configurable: { thread_id: threadId } } // 指定会话 id
  );
  console.log(`\n📝 用户(第1轮): 北京今天天气怎么样？`);
  console.log(`💬 Agent: ${extractLastText(turn1.messages)}`);

  // 第 2 轮：基于上一轮追问 —— Agent 从 checkpoint 中读到了第 1 轮的天气数据
  const turn2 = await agentWithMemory.invoke(
    { messages: [new HumanMessage("湿度是多少？")] },
    { configurable: { thread_id: threadId } }
  );
  console.log(`\n📝 用户(第2轮): 湿度是多少？`);
  console.log(`💬 Agent: ${extractLastText(turn2.messages)}`);

  // 第 3 轮：继续追问 —— 历史不断累积，但全程无需手动维护 messages
  const turn3 = await agentWithMemory.invoke(
    { messages: [new HumanMessage("那深圳呢？对比一下。")] },
    { configurable: { thread_id: threadId } }
  );
  console.log(`\n📝 用户(第3轮): 那深圳呢？对比一下。`);
  console.log(`💬 Agent: ${extractLastText(turn3.messages)}`);

  // 展示回到本轮的完整消息历史（createAgent 自动拼接，无需手工管理）
  console.log(`\n--- 会话 ${threadId} 的完整消息历史 ---`);
  turn3.messages.forEach((msg, i) => {
    const type = msg.type;
    const content =
      typeof msg.content === "string"
        ? msg.content.slice(0, 60)
        : JSON.stringify(msg.content).slice(0, 60);
    console.log(`  [${i}] ${type}: ${content}...`);
  });

  // ===========================
  // 示例 13.4：自定义 Agent 行为（不同的 systemPrompt = 不同的 Agent）
  // ===========================
  console.log("\n\n=== 示例 13.4: 自定义 Agent 行为 ===");
  const analystPrompt = `你是一个严谨的数据分析师 Agent。

## 行为准则
1. 所有涉及数字的回答必须使用计算器工具，不要心算
2. 回答必须包含具体的数据来源
3. 如果数据不足，明确说明"数据不足，无法得出结论"
4. 使用表格或结构化格式展示数据`;

  const analystAgent = createAgent({
    model,
    tools: allTools,
    systemPrompt: analystPrompt,
  });

  const analysis = await analystAgent.invoke({
    messages: [new HumanMessage("对比北京和上海的温度差。")],
  });
  console.log(`💬 分析结果: ${extractLastText(analysis.messages)}`);

  // ===========================
  // 示例 13.5：createAgent 的"免费"增强能力演示
  // ===========================
  console.log("\n\n=== 示例 13.5: createAgent 带来的额外能力 ===");

  // 1) stream()：开箱即用的流式输出，无需手写
  console.log("\n1) 流式输出 agent.stream()（实时订阅每一步状态）：");
  const stream = await agentBasic.stream(
    { messages: [new HumanMessage("什么是闭包？")] },
    { streamMode: "values" } // values 模式：每一轮节点完成后输出当前 state
  );
  for await (const chunk of stream) {
    // chunk 是某个节点执行完后的快照，可从中读到最新的消息
    const msgs = (chunk as unknown as { messages: { type: string; content: any }[] }).messages;
    if (msgs?.length) {
      const last = msgs[msgs.length - 1];
      if (typeof last.content === "string" && last.content.trim() && last.type.includes("ai")) {
        console.log(`    AI: ${last.content.slice(0, 80)}...`);
      } else if (last.type.startsWith("tool")) {
        console.log(`    🔧 工具调用/结果: ${last.type}`);
      } else {
        console.log(`    ${last.type}: ${JSON.stringify(last.content).slice(0, 60)}`);
      }
    }
  }

  // 2) 结构化输出 responseFormat：Zod schema 转 typing，返回强类型结果
  console.log("\n2) 结构化输出 responseFormat（可用场景示例说明）：");
  console.log("   createAgent({ responseFormat: z.object({...}) })");
  console.log("   → result.structuredResponse 即返回符合 schema 的强类型对象");
  console.log("   （手写循环若要实现结构化输出，需额外接 withStructuredOutput）");

  // 3) 中间件 middleware：工具重试、人工介入、敏感信息脱敏等
  console.log("\n3) 中间件 middleware（可选）：");
  console.log("   createAgent({ middleware: [toolRetry, hitl, piiRedaction...] })");
  console.log("   → 手写循环若想实现重试/人工审核，需要自己写大量样板代码");

  console.log("\n\n✅ 所有示例运行完毕！");
}

main().catch((err) => {
  console.error("运行出错:", err);
  console.error("提示：创建带记忆的 Agent 需要 @langchain/langgraph（已随 langchain 安装）。");
  process.exitCode = 1;
});