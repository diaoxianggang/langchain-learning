/**
 * 个人知识库 - Hono 应用
 * 挂载 CORS 与各业务路由。
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { knowledgeRoutes } from "./routes/knowledge.js";
import { chatRoutes } from "./routes/chat.js";

export const app = new Hono();

app.use("*", cors());

app.get("/api/health", (c) =>
  c.json({ status: "ok", time: new Date().toISOString() })
);

app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/chat", chatRoutes);
