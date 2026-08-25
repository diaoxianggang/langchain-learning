/**
 * ============================================================
 * 示例 11: 中间件与回调 (Middleware & Callbacks)
 * ============================================================
 *
 * LangChain 的回调系统是实现"中间件"的核心机制。
 * 通过回调，你可以在链的生命周期中插入自定义逻辑：
 * 日志、监控、性能统计、输入校验等。
 *
 * 【你将学到】
 * 1. BaseCallbackHandler - 自定义回调处理器
 * 2. RunnableConfig - 通过配置注入回调
 * 3. RunnableLambda - 用函数包装链的前后处理逻辑
 * 4. 链执行耗时统计 - 用回调实现性能监控中间件
 *
 * 【中间件的核心思想】
 *   请求 → [中间件1] → [中间件2] → 核心逻辑 → [中间件2] → [中间件1] → 响应
 *
 * 【Python 对比】
 *   Python: from langchain.callbacks.base import BaseCallbackHandler
 *   TS:     import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
 */
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import type { Serialized } from "@langchain/core/load/serializable";
import type { ChainValues } from "@langchain/core/utils/types";
import type { LLMResult } from "@langchain/core/outputs";
import { createMimoModel } from "./config.js";

async function main() {
  // ===========================
  // 1. 自定义回调处理器（类继承方式）
  // ===========================
  console.log("=== 示例 11.1: 自定义回调处理器 ===\n");

  // 日志回调：记录链的每一步执行
  class LoggingCallbackHandler extends BaseCallbackHandler {
    name = "LoggingCallbackHandler";

    // 链开始时触发
    handleChainStart(chain: Serialized, inputs: ChainValues) {
      console.log(`  [日志] 🔗 链开始: ${chain.id?.join(".") || "unknown"}`);
      console.log(`  [日志]    输入:`, JSON.stringify(inputs).slice(0, 100));
    }

    // 链结束时触发
    handleChainEnd(outputs: ChainValues) {
      console.log(`  [日志] ✅ 链结束`);
      console.log(`  [日志]    输出:`, JSON.stringify(outputs).slice(0, 100));
    }

    // LLM 调用开始
    handleLLMStart(llm: Serialized) {
      console.log(`  [日志] 🤖 LLM 调用开始: ${llm.id?.join(".") || "unknown"}`);
    }

    // LLM 调用结束
    handleLLMEnd(output: LLMResult) {
      const tokenUsage = output.llmOutput?.tokenUsage;
      if (tokenUsage) {
        console.log(`  [日志] 🤖 LLM 调用结束 - tokens: ${tokenUsage.totalTokens}`);
      } else {
        console.log(`  [日志] 🤖 LLM 调用结束`);
      }
    }

    // 错误处理
    handleChainError(err: Error) {
      console.log(`  [日志] ❌ 链错误: ${err.message}`);
    }
  }

  const prompt = ChatPromptTemplate.fromTemplate("用一句话解释：{concept}");
  const model = await createMimoModel(0.5);
  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  // 通过 invoke 的第二个参数注入回调
  const result1 = await chain.invoke(
    { concept: "闭包（Closure）" },
    { callbacks: [new LoggingCallbackHandler()] }
  );
  console.log(`  结果: ${result1}\n`);

  // ===========================
  // 2. 用 fromMethods 快速创建回调（函数方式）
  // ===========================
  // 不想写类时，用 BaseCallbackHandler.fromMethods() 更简洁
  console.log("=== 示例 11.2: 函数式回调 ===\n");

  const timingHandler = BaseCallbackHandler.fromMethods({
    handleChainStart(_chain, _inputs, runId) {
      console.log(`  [计时] ⏱️ 开始 - runId: ${runId.slice(0, 8)}...`);
      // 用 globalThis 存储开始时间（简单演示）
      (globalThis as any).__chainStartTime = Date.now();
    },
    handleChainEnd(_outputs, runId) {
      const elapsed = Date.now() - ((globalThis as any).__chainStartTime || Date.now());
      console.log(`  [计时] ⏱️ 结束 - runId: ${runId.slice(0, 8)}... 耗时: ${elapsed}ms`);
    },
  });

  const result2 = await chain.invoke(
    { concept: "递归" },
    { callbacks: [timingHandler] }
  );
  console.log(`  结果: ${result2}\n`);

  // ===========================
  // 3. RunnableLambda - 函数式中间件
  // ===========================
  // RunnableLambda 让你把普通函数变成 LCEL 链的一环
  // 可以用来做：输入校验、输出转换、日志记录等
  console.log("=== 示例 11.3: RunnableLambda 中间件 ===\n");

  // 中间件 1: 输入预处理（添加上下文）
  const enrichInput = RunnableLambda.from((input: { question: string }) => {
    console.log(`  [中间件-预处理] 原始输入: "${input.question}"`);
    return {
      ...input,
      question: input.question.trim(),
      // 可以在这里添加额外字段
    };
  });

  // 中间件 2: 输出后处理（格式化）
  const formatOutput = RunnableLambda.from((output: string) => {
    console.log(`  [中间件-后处理] 原始输出长度: ${output.length} 字符`);
    return `📌 ${output.trim()}`;
  });

  // 组装带中间件的链：预处理 → prompt → model → parser → 后处理
  const middlewareModel = await createMimoModel(0.5);
  const middlewareChain = RunnableSequence.from([
    enrichInput,
    ChatPromptTemplate.fromTemplate("用一句话简洁回答：{question}"),
    middlewareModel,
    new StringOutputParser(),
    formatOutput,
  ]);

  const result3 = await middlewareChain.invoke({ question: "  什么是微服务架构？  " });
  console.log(`  最终结果: ${result3}\n`);

  // ===========================
  // 4. 性能监控中间件（综合示例）
  // ===========================
  // 将回调 + RunnableLambda 组合，实现一个完整的监控中间件
  console.log("=== 示例 11.4: 综合监控中间件 ===\n");

  // 通用性能回调
  class PerformanceMonitor extends BaseCallbackHandler {
    name = "PerformanceMonitor";
    private timings: Map<string, number> = new Map();
    private callCount = 0;

    handleChainStart(_chain: Serialized, _inputs: ChainValues, runId: string) {
      this.timings.set(runId, Date.now());
      this.callCount++;
    }

    handleChainEnd(_outputs: ChainValues, runId: string) {
      const start = this.timings.get(runId);
      if (start) {
        const elapsed = Date.now() - start;
        console.log(`  [监控] 链执行耗时: ${elapsed}ms`);
        this.timings.delete(runId);
      }
    }

    handleLLMStart() {
      this.callCount++;
    }

    getStats() {
      return { totalCalls: this.callCount };
    }
  }

  // 输入校验中间件
  const validateInput = RunnableLambda.from((input: { topic: string }) => {
    if (!input.topic || input.topic.trim().length === 0) {
      throw new Error("topic 不能为空");
    }
    if (input.topic.length > 200) {
      throw new Error("topic 过长，最多 200 字符");
    }
    return input;
  });

  // 响应包装中间件
  const wrapResponse = RunnableLambda.from((output: string) => {
    return {
      answer: output.trim(),
      timestamp: new Date().toISOString(),
      source: "mimo-v2.5-pro",
    };
  });

  const monitor = new PerformanceMonitor();

  const monitoredModel = await createMimoModel(0.5);
  const monitoredChain = RunnableSequence.from([
    validateInput,
    ChatPromptTemplate.fromTemplate("简要介绍：{topic}"),
    monitoredModel,
    new StringOutputParser(),
    wrapResponse,
  ]);

  const result4 = await monitoredChain.invoke(
    { topic: "Rust 语言的所有权机制" },
    { callbacks: [monitor] }
  );
  console.log("  监控结果:", JSON.stringify(result4, null, 2));
  console.log("  统计信息:", monitor.getStats());

  // ===========================
  // 5. 多回调同时使用
  // ===========================
  console.log("\n=== 示例 11.5: 多回调叠加 ===\n");

  // 可以同时注入多个回调，它们会按注册顺序执行
  const result5 = await chain.invoke(
    { concept: "依赖注入" },
    {
      callbacks: [
        new LoggingCallbackHandler(),
        timingHandler,
        monitor,
      ],
    }
  );
  console.log(`  结果: ${result5}`);
  console.log("  总调用次数:", monitor.getStats().totalCalls);
}

main().catch(console.error);
