/**
 * 个人知识库 - 前端 API 封装
 * 所有请求经 Vite dev proxy 转发到 Hono 后端（:3001）。
 */

export interface Stats {
  sourceDir: string;
  totalDocs: number;
  totalChunks: number;
  indexed: number;
  failed: number;
}

export interface DocumentRecord {
  id: number;
  source_path: string;
  file_hash: string;
  chunk_count: number;
  status: string;
  last_ingested_at: string | null;
  created_at: string;
}

export interface IngestResult {
  total: number;
  ingested: string[];
  skipped: string[];
  failed: string[];
}

export type ChatEvent = {
  type: "session" | "token" | "done" | "error";
  content?: string;
  sessionId?: string;
  message?: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const getStats = () => request<Stats>("/api/knowledge/stats");

export const getDocuments = () =>
  request<{ documents: DocumentRecord[] }>("/api/knowledge/documents");

export const ingest = () =>
  request<IngestResult>("/api/knowledge/ingest", { method: "POST" });

/**
 * 流式问答：POST /api/chat，逐事件回调 SSE 解析结果
 */
export async function sendChat(
  message: string,
  sessionId: string,
  onEvent: (event: ChatEvent) => void
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`请求失败: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as ChatEvent);
      } catch {
        // 忽略无法解析的事件
      }
    }
  }
}
