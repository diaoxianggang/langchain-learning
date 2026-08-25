/**
 * 个人知识库 - 智能问答 Agent
 * 使用 createAgent 构建 ReAct Agent：
 * - 模型：小米 Mimo 在线模型（生成回答）
 * - 工具：retrieve_knowledge（Qdrant 语义检索）
 * - 记忆：PostgresSaver（对话历史持久化到 PostgreSQL，按 thread_id 隔离会话）
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAgent } from "langchain";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { createMimoModel } from "./llm.js";
import { retrieve } from "./retriever.js";
import { config } from "./config.js";

const AGENT_SYSTEM_PROMPT = `你是一个个人知识库助手，负责基于本地知识库文档回答用户问题。

## 行为准则
1. 当问题涉及知识库内容（本仓库 docs 教程、技术概念、实现细节等）时，必须调用 retrieve_knowledge 工具检索相关资料
2. 优先依据检索到的上下文回答，不要凭记忆编造知识库中没有的内容
3. 回答时注明信息来源（对应源文件），方便用户溯源
4. 如果检索结果不足以回答，明确说明"知识库中未找到相关信息"
5. 普通闲聊或知识库之外的通用问题可直接回答，无需检索
6. 使用中文回答，语言简洁准确`;

/**
 * 构建知识库 Agent 与其 checkpointer
 */
async function buildAgent() {
  const model = await createMimoModel(0.3);

  // 检索工具：Agent 决定是否需要查知识库
  const retrieveKnowledgeTool = tool(
    async ({ query }) => {
      const docs = await retrieve(query, 4);
      return JSON.stringify(docs, null, 2);
    },
    {
      name: "retrieve_knowledge",
      description:
        "从个人知识库中检索与问题最相关的文档片段。当用户问题涉及知识库中的内容（如 docs 教程、技术概念、项目实现细节）时调用。输入为要检索的自然语言问题或关键词，返回相关片段及来源文件。",
      schema: z.object({
        query: z.string().describe("要检索的自然语言问题或关键词"),
      }),
    }
  );

  // PostgreSQL 持久化记忆（对话历史）
  const checkpointer = PostgresSaver.fromConnString(config.pgConnectionString);
  await checkpointer.setup();

  const agent = createAgent({
    model,
    tools: [retrieveKnowledgeTool],
    systemPrompt: AGENT_SYSTEM_PROMPT,
    checkpointer,
  });

  return { agent, checkpointer };
}

type BuiltAgent = Awaited<ReturnType<typeof buildAgent>>;

let cached: BuiltAgent | undefined;

/**
 * 获取知识库 Agent 单例
 */
export async function getAgent(): Promise<BuiltAgent> {
  if (!cached) {
    cached = await buildAgent();
  }
  return cached;
}
