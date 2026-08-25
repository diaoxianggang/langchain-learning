/**
 * 个人知识库 - 问答路由
 * POST /api/chat           ：流式问答（SSE，多轮记忆按 sessionId 持久化）
 * GET  /api/chat/history   ：查询指定会话的历史消息
 */
import crypto from "node:crypto";
import { Hono } from "hono";
import { HumanMessage } from "@langchain/core/messages";
import { getAgent } from "../services/agent.js";

export const chatRoutes = new Hono();

chatRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    sessionId?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) return c.json({ error: "message 不能为空" }, 400);

  const threadId = body.sessionId || crypto.randomUUID();
  const { agent } = await getAgent();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        send({ type: "session", sessionId: threadId });

        // 逐 token 流式输出（streamMode: "messages"）
        const aiStream = await agent.stream(
          { messages: [new HumanMessage(message)] },
          { configurable: { thread_id: threadId }, streamMode: "messages" }
        );

        for await (const item of aiStream) {
          const chunk = Array.isArray(item) ? item[0] : item;
          // 仅输出 AI 消息分块；跳过工具调用/工具结果（ToolMessage）等非回答内容
          const isAi =
            typeof chunk?.type === "string" &&
            chunk.type.toLowerCase().includes("ai");
          const content = chunk?.content;
          if (isAi && typeof content === "string" && content.trim()) {
            send({ type: "token", content });
          }
        }
        send({ type: "done", sessionId: threadId });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

/** 查询会话历史（来自 PostgreSQL checkpointer） */
chatRoutes.get("/history", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) return c.json({ messages: [] });

  const { checkpointer } = await getAgent();
  const tuple = await checkpointer.getTuple({
    configurable: { thread_id: sessionId },
  });
  const messages = (tuple?.checkpoint?.channel_values?.messages ??
    []) as Array<{ type: string; content: unknown }>;

  const formatted = messages.map((m) => {
    const isHuman = m.type.includes("human");
    const isAi = m.type.includes("ai");
    return {
      role: isHuman ? "user" : isAi ? "assistant" : "system",
      content:
        typeof m.content === "string"
          ? m.content
          : JSON.stringify(m.content),
    };
  });

  return c.json({ messages: formatted });
});
