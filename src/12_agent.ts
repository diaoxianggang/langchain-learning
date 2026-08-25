/**
 * ============================================================
 * 示例 12: 智能代理 (Agent) 完整实战
 * ============================================================
 *
 * Agent（智能代理）是 LangChain 中最强大的应用模式之一。
 * 它让 LLM 不再只是"问答机器"，而是能自主规划、调用工具、
 * 多步推理、最终完成复杂任务的"智能助手"。
 *
 * 【你将学到】
 * 1. Agent 的本质：模型 + 工具 + 循环控制 = 自主决策系统
 * 2. 用系统提示词塑造 Agent 的"人格"和行为规范
 * 3. 完整的 ReAct Agent 实现（推理-行动-观察循环）
 * 4. Agent 带对话记忆：多轮交互中保持上下文
 * 5. 多步骤任务分解：Agent 自动拆解复杂问题
 *
 * 【Agent vs 普通链 (Chain) 的区别】
 *   普通链：用户输入 → 固定流程处理 → 输出（流程是开发者预设的）
 *   Agent：  用户输入 → 模型自主决策 → 动态选择工具 → 输出（流程由模型决定）
 *
 * 【核心公式】
 *   Agent = LLM + Tools + Loop（循环控制） + System Prompt（行为规范）
 *
 * 【Python 对比】
 *   from langgraph.prebuilt import create_react_agent
 *   agent = create_react_agent(model, tools, prompt="...")
 *   result = agent.invoke({"messages": [...]})
 *
 * 【依赖说明】
 *   本示例使用现有依赖即可运行，无需安装额外包。
 *   生产环境推荐使用 @langchain/langgraph 构建 Agent。
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createMimoModel } from "./config.js";

// ============================================================
// 第一部分：定义 Agent 可用的工具集
// ============================================================
// 工具是 Agent 与外部世界交互的"手和脚"。
// 定义工具时需要考虑：
//   1. name：简洁明确，LLM 用它来引用工具
//   2. description：详细描述工具用途和适用场景，LLM 靠它决定何时使用
//   3. schema：用 Zod 定义参数类型和描述，帮助 LLM 正确填参数

/**
 * 工具 1：数学计算器
 * Agent 在遇到数学计算需求时会自动调用此工具
 */
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // 使用 Function 构造器安全地计算数学表达式
      // "use strict" 防止恶意代码执行
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

/**
 * 工具 2：天气查询（模拟数据）
 * 实际项目中替换为真实天气 API 调用
 */
const weatherTool = tool(
  async ({ city }) => {
    // 模拟天气数据 —— 实际项目中这里会调用 HTTP API
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

/**
 * 工具 3：日期时间查询
 * Agent 需要知道当前时间时会调用此工具
 */
const datetimeTool = tool(
  async () => {
    const now = new Date();
    return JSON.stringify({
      datetime: now.toISOString(),
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

/**
 * 工具 4：知识百科查询（模拟数据）
 * 实际项目中可对接维基百科 API 或知识库
 */
const knowledgeTool = tool(
  async ({ topic }) => {
    const knowledge: Record<string, string> = {
      闭包:
        "闭包（Closure）是指一个函数能够记住并访问其词法作用域中的变量，即使该函数在其词法作用域之外执行。" +
        "在 JavaScript 中，每当创建一个函数，就会创建一个闭包。",
      递归:
        "递归（Recursion）是一种编程技巧，指函数直接或间接调用自身。" +
        "递归必须有终止条件（基线条件），否则会导致无限循环。" +
        "经典应用包括：阶乘计算、斐波那契数列、树的遍历等。",
      微服务:
        "微服务架构（Microservices）是一种将应用拆分为一组小型、独立部署的服务的架构风格。" +
        "每个服务运行在自己的进程中，通过轻量级通信机制（通常是 HTTP API）交互。" +
        "优势：独立部署、技术栈灵活、可独立扩展。劣势：分布式复杂性、运维成本高。",
      Docker:
        "Docker 是一个开源的容器化平台，允许开发者将应用及其依赖打包到一个轻量级、" +
        "可移植的容器中。容器在任何支持 Docker 的环境中都能以相同方式运行，" +
        "解决了'在我机器上能跑'的问题。",
    };
    const result = knowledge[topic];
    if (result) {
      return JSON.stringify({ topic, content: result });
    }
    return JSON.stringify({
      topic,
      content: `暂无关于"${topic}"的百科条目，建议使用搜索引擎查询。`,
    });
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

/**
 * 工具 5：文本摘要工具
 * Agent 需要处理长文本时会调用此工具
 */
const textSummaryTool = tool(
  async ({ text, maxSentences }) => {
    // 简单的摘要逻辑：取前 N 句话
    // 实际项目中可用 LLM 做更智能的摘要
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

// 将所有工具收集到数组中，方便后续绑定到模型
const allTools = [calculatorTool, weatherTool, datetimeTool, knowledgeTool, textSummaryTool];

// ============================================================
// 第二部分：Agent 核心实现
// ============================================================

/**
 * 系统提示词 —— Agent 的"行为规范"
 *
 * 系统提示词决定了 Agent 的行为方式，包括：
 * - 角色定义：Agent 是谁，擅长什么
 * - 行为准则：如何思考、如何使用工具
 * - 输出规范：回复的格式和风格
 *
 * 好的系统提示词能让 Agent 更准确地理解任务、更合理地使用工具。
 */
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

/**
 * ReAct Agent 的核心实现
 *
 * ReAct = Reasoning（推理）+ Acting（行动）
 * 每次循环中：
 *   1. 模型分析当前消息历史，决定下一步行动
 *   2. 如果需要调用工具 → 执行工具 → 将结果反馈 → 继续循环
 *   3. 如果不需要工具 → 直接输出最终回答 → 结束循环
 *
 * @param messages - 消息历史（包含系统提示、用户消息、AI回复、工具结果等）
 * @param maxIterations - 最大循环次数，防止 Agent 陷入无限循环
 * @returns Agent 的最终文本回答
 */
async function runReActLoop(
  messages: BaseMessage[],
  maxIterations: number = 8
): Promise<string> {
  // 创建模型并绑定工具
  // temperature 设为 0.3：Agent 场景需要较低随机性，确保决策稳定
  const model = await createMimoModel(0.3);
  const modelWithTools = model.bindTools(allTools);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // 调用模型，传入完整的消息历史
    // 模型会基于历史上下文决定：调用工具 or 直接回答
    const response = await modelWithTools.invoke(messages);

    if (response.tool_calls && response.tool_calls.length > 0) {
      // ---- 模型决定调用工具 ----
      console.log(`  [第 ${iteration + 1} 轮] 模型请求调用 ${response.tool_calls.length} 个工具`);

      // 将模型的回复（含 tool_calls）加入消息列表
      // 这一步很重要：模型需要看到自己的"决策记录"
      messages.push(response);

      // 逐个执行工具
      for (const tc of response.tool_calls) {
        console.log(`    → 调用 ${tc.name}(${JSON.stringify(tc.args)})`);

        // 在已注册的工具中查找目标工具
        const targetTool = allTools.find((t) => t.name === tc.name);

        if (targetTool) {
          try {
            // 执行工具，获取结果
            const result = await (targetTool as any).invoke(tc.args);
            console.log(`    ✓ 结果: ${result}`);

            // 将工具结果包装为 ToolMessage，关联到对应的 tool_call
            // tc.id 是工具调用的唯一标识，用于将结果和调用请求配对
            messages.push(new ToolMessage(result, tc.id!));
          } catch (err) {
            // 工具执行失败时，将错误信息反馈给模型
            // 模型可以理解错误并尝试其他方式回答
            const errorMsg = `工具执行失败: ${err}`;
            console.log(`    ✗ ${errorMsg}`);
            messages.push(new ToolMessage(errorMsg, tc.id!));
          }
        } else {
          // 模型请求了一个不存在的工具
          const errorMsg = `未知工具: ${tc.name}`;
          console.log(`    ✗ ${errorMsg}`);
          messages.push(new ToolMessage(errorMsg, tc.id!));
        }
      }
      // 继续下一轮循环，让模型看到工具结果后继续决策
    } else {
      // ---- 模型不再调用工具，返回最终回答 ----
      console.log(`  [第 ${iteration + 1} 轮] 模型生成最终回答`);
      return typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    }
  }

  // 达到最大循环次数，安全退出
  console.log("  ⚠ 达到最大循环次数，强制结束");
  return "抱歉，我无法在限定步骤内完成这个任务。请尝试简化问题。";
}

/**
 * Agent 主函数 —— 单次问答模式
 *
 * 流程：用户提问 → Agent 自主规划和执行 → 返回最终回答
 *
 * @param question - 用户的问题
 * @returns Agent 的回答
 */
async function agentAsk(question: string): Promise<string> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📝 用户提问: ${question}`);
  console.log(`${"=".repeat(60)}`);

  // 构建消息列表：系统提示 + 用户问题
  const messages: BaseMessage[] = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    new HumanMessage(question),
  ];

  // 运行 ReAct 循环
  const answer = await runReActLoop(messages);

  console.log(`\n💬 Agent 回答: ${answer}`);
  return answer;
}

/**
 * 带对话记忆的 Agent —— 多轮交互模式
 *
 * 与 agentAsk 的区别：
 * - agentAsk：每次调用都是独立的，不保留历史
 * - AgentWithMemory：维护一个持久的消息列表，支持多轮对话
 *
 * 这是构建聊天机器人、客服系统等的基础模式。
 */
class AgentWithMemory {
  private messages: BaseMessage[];
  private maxHistoryLength: number;

  /**
   * @param systemPrompt - 系统提示词
   * @param maxHistoryLength - 保留的最大历史消息数（防止 token 超限）
   */
  constructor(
    systemPrompt: string = AGENT_SYSTEM_PROMPT,
    maxHistoryLength: number = 20
  ) {
    this.messages = [new SystemMessage(systemPrompt)];
    this.maxHistoryLength = maxHistoryLength;
  }

  /**
   * 发送消息并获取 Agent 回复
   *
   * 每次调用时：
   * 1. 将用户消息追加到历史
   * 2. 运行 ReAct 循环（模型能看到完整历史）
   * 3. 将 Agent 回复追加到历史
   * 4. 如果历史过长，裁剪旧消息（保留系统提示）
   */
  async chat(question: string): Promise<string> {
    console.log(`\n📝 用户: ${question}`);

    // 追加用户消息到历史
    this.messages.push(new HumanMessage(question));

    // 运行 ReAct 循环（复用同一个消息列表）
    const answer = await runReActLoop([...this.messages]);

    // 将 Agent 回复追加到历史
    this.messages.push(new AIMessage(answer));

    // 裁剪历史，防止 token 超限
    // 保留第一条（系统提示）+ 最近的 N 条消息
    if (this.messages.length > this.maxHistoryLength + 1) {
      this.messages = [
        this.messages[0], // 系统提示
        ...this.messages.slice(-this.maxHistoryLength), // 最近的消息
      ];
    }

    console.log(`💬 Agent: ${answer}`);
    return answer;
  }

  /** 获取当前对话历史（用于调试或持久化） */
  getHistory(): BaseMessage[] {
    return [...this.messages];
  }

  /** 清空对话历史（保留系统提示） */
  clearHistory(): void {
    this.messages = [this.messages[0]];
  }
}

// ============================================================
// 第三部分：运行示例
// ============================================================

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     示例 12: 智能代理 (Agent) 完整实战          ║");
  console.log("╚══════════════════════════════════════════════════╝");

  // ===========================
  // 示例 12.1：单次 Agent 问答
  // ===========================
  // 简单问题 —— Agent 直接回答，不调用工具
  console.log("\n\n=== 示例 12.1: 单次 Agent 问答 ===");
  await agentAsk("你好，你能做什么？");

  // 需要调用单个工具的问题
  console.log("\n---");
  await agentAsk("北京今天天气怎么样？");

  // 需要数学计算的问题
  console.log("\n---");
  await agentAsk("如果一个长方形的长是 12.5 米，宽是 8.3 米，面积和周长分别是多少？");

  // 需要查询知识的问题
  console.log("\n---");
  await agentAsk("什么是闭包？能用简单的话解释一下吗？");

  // ===========================
  // 示例 12.2：多步骤任务（Agent 自动分解）
  // ===========================
  // 这个问题需要 Agent：
  //   1. 先查天气获取温度
  //   2. 再用计算器做单位换算
  //   3. 最后整合信息回答
  console.log("\n\n=== 示例 12.2: 多步骤任务 ===");
  await agentAsk(
    "上海今天多少度？如果温度升高 5 度，换算成华氏度是多少？"
  );

  // 需要同时查天气和查时间的复合问题
  console.log("\n---");
  await agentAsk("现在几点了？北京和深圳的天气分别怎么样？帮我总结一下。");

  // ===========================
  // 示例 12.3：带对话记忆的 Agent
  // ===========================
  console.log("\n\n=== 示例 12.3: 带对话记忆的 Agent ===");
  console.log("（Agent 能记住之前的对话内容，实现连贯的多轮交互）\n");

  const agent = new AgentWithMemory();

  // 第 1 轮：问天气
  await agent.chat("北京今天天气怎么样？");

  // 第 2 轮：基于上一轮的回答追问
  // Agent 能从历史中知道"北京"的天气信息，无需重复说明
  await agent.chat("湿度是多少？");

  // 第 3 轮：切换话题，但 Agent 仍然记住之前的对话
  await agent.chat("那深圳呢？帮我对比一下两个城市的天气。");

  // 第 4 轮：结合天气和计算的复合问题
  await agent.chat("如果我想从北京飞到深圳，飞行时间大约 3 小时，到达时大概几点？");

  // 查看对话历史
  console.log("\n--- 对话历史统计 ---");
  const history = agent.getHistory();
  console.log(`总消息数: ${history.length}`);
  history.forEach((msg, i) => {
    const type = msg.constructor.name;
    const content =
      typeof msg.content === "string"
        ? msg.content.slice(0, 50)
        : JSON.stringify(msg.content).slice(0, 50);
    console.log(`  ${i}. [${type}] ${content}...`);
  });

  // ===========================
  // 示例 12.4：自定义 Agent 行为
  // ===========================
  // 通过自定义系统提示词，可以创建不同"性格"的 Agent
  console.log("\n\n=== 示例 12.4: 自定义 Agent 行为 ===");

  // 创建一个"严谨的数据分析师"Agent
  const analystPrompt = `你是一个严谨的数据分析师 Agent。

## 行为准则
1. 所有涉及数字的回答必须使用计算器工具，不要心算
2. 回答必须包含具体的数据来源
3. 如果数据不足，明确说明"数据不足，无法得出结论"
4. 使用表格或结构化格式展示数据

## 可用工具
- calculator: 数学计算
- get_weather: 天气数据查询`;

  const analystMessages: BaseMessage[] = [
    new SystemMessage(analystPrompt),
    new HumanMessage("对比北京和上海的温度差，如果温差超过 3 度就提醒我带外套。"),
  ];

  console.log("\n📊 数据分析师 Agent:");
  const analystAnswer = await runReActLoop(analystMessages);
  console.log(`\n💬 分析结果: ${analystAnswer}`);

  console.log("\n\n✅ 所有示例运行完毕！");
}

main().catch(console.error);
