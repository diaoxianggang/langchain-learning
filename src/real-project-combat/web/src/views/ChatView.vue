<script setup lang="ts">
import { ref, nextTick } from "vue";
import { sendChat } from "../api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const messages = ref<Message[]>([]);
const input = ref("");
const sending = ref(false);
const sessionId = ref(crypto.randomUUID());
const listEl = ref<HTMLElement | null>(null);

function newChat() {
  sessionId.value = crypto.randomUUID();
  messages.value = [];
}

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
  });
}

async function submit() {
  const text = input.value.trim();
  if (!text || sending.value) return;
  input.value = "";

  messages.value.push({ role: "user", content: text });
  const assistant: Message = { role: "assistant", content: "" };
  messages.value.push(assistant);
  sending.value = true;
  scrollToBottom();

  try {
    await sendChat(text, sessionId.value, (ev) => {
      if (ev.type === "token" && ev.content) {
        assistant.content += ev.content;
        scrollToBottom();
      } else if (ev.type === "error") {
        assistant.content = `出错了: ${ev.message ?? "未知错误"}`;
      }
    });
  } catch (err) {
    assistant.content = `请求失败: ${String(err)}`;
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}
</script>

<template>
  <div class="chat-page">
    <div class="chat-toolbar card">
      <span class="chat-session">会话 ID: {{ sessionId.slice(0, 8) }}...</span>
      <button class="btn btn-ghost" :disabled="sending" @click="newChat">
        新对话
      </button>
    </div>

    <div ref="listEl" class="chat-list">
      <div v-if="messages.length === 0" class="chat-empty">
        <p>你好！我是你的个人知识库助手。</p>
        <p>可以问我关于知识库文档（docs 教程）中的任何问题，例如：</p>
        <p class="chat-hint">"RAG 的工作原理是什么？"</p>
        <p class="chat-hint">"LangChain 有哪些核心组件？"</p>
      </div>

      <div
        v-for="(m, i) in messages"
        :key="i"
        class="chat-msg"
        :class="m.role"
      >
        <div class="chat-msg-label">
          {{ m.role === "user" ? "我" : "知识库助手" }}
        </div>
        <div class="chat-msg-content">
          <template v-if="m.role === 'assistant' && sending && i === messages.length - 1 && !m.content">
            <span class="typing-dots">正在思考中</span>
          </template>
          <template v-else>{{ m.content }}</template>
        </div>
      </div>
    </div>

    <div class="chat-inputbar">
      <input
        v-model="input"
        class="chat-input"
        placeholder="输入你的问题，Enter 发送"
        :disabled="sending"
        @keydown.enter.prevent="submit"
      />
      <button class="btn btn-primary" :disabled="sending || !input.trim()" @click="submit">
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  gap: 12px;
}

.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.chat-session {
  font-size: 12px;
  color: #6b7280;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  border-radius: 10px;
  padding: 16px;
}

.chat-empty {
  margin: auto;
  text-align: center;
  color: #6b7280;
  line-height: 2;
}

.chat-hint {
  color: #3b82f6;
}

.chat-msg {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.chat-msg.user {
  align-self: flex-end;
  align-items: flex-end;
}

.chat-msg.assistant {
  align-self: flex-start;
  align-items: flex-start;
}

.chat-msg-label {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.chat-msg-content {
  padding: 10px 14px;
  border-radius: 10px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-msg.user .chat-msg-content {
  background: #3b82f6;
  color: #fff;
  border-top-right-radius: 2px;
}

.chat-msg.assistant .chat-msg-content {
  background: #f3f4f6;
  border-top-left-radius: 2px;
}

.typing-dots::after {
  content: "";
  animation: dots 1.2s steps(4, end) infinite;
}

@keyframes dots {
  0% {
    content: "";
  }
  25% {
    content: ".";
  }
  50% {
    content: "..";
  }
  75% {
    content: "...";
  }
}

.chat-inputbar {
  display: flex;
  gap: 10px;
}

.chat-input {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #3b82f6;
}
</style>
