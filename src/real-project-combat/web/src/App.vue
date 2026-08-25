<script setup lang="ts">
import { ref } from "vue";
import ChatView from "./views/ChatView.vue";
import KnowledgeView from "./views/KnowledgeView.vue";

const activeTab = ref<"chat" | "knowledge">("chat");
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">个人知识库</h1>
      <nav class="app-nav">
        <button
          class="nav-btn"
          :class="{ active: activeTab === 'chat' }"
          @click="activeTab = 'chat'"
        >
          智能问答
        </button>
        <button
          class="nav-btn"
          :class="{ active: activeTab === 'knowledge' }"
          @click="activeTab = 'knowledge'"
        >
          知识库管理
        </button>
      </nav>
    </header>
    <main class="app-main">
      <ChatView v-if="activeTab === 'chat'" />
      <KnowledgeView v-else />
    </main>
  </div>
</template>
