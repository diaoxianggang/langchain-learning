<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getStats,
  getDocuments,
  ingest,
  type Stats,
  type DocumentRecord,
  type IngestResult,
} from "../api";

const stats = ref<Stats | null>(null);
const documents = ref<DocumentRecord[]>([]);
const syncing = ref(false);
const syncResult = ref("");
const error = ref("");

async function refresh() {
  const [s, d] = await Promise.all([getStats(), getDocuments()]);
  stats.value = s;
  documents.value = d.documents;
}

async function sync() {
  syncing.value = true;
  syncResult.value = "";
  error.value = "";
  try {
    const r: IngestResult = await ingest();
    syncResult.value = `入库完成：新增 ${r.ingested.length}，跳过(未变更) ${r.skipped.length}，失败 ${r.failed.length}（共扫描 ${r.total} 个文件）`;
    await refresh();
  } catch (e) {
    error.value = String(e);
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  refresh().catch((e) => (error.value = String(e)));
});
</script>

<template>
  <div class="kb-page">
    <div class="card kb-source">
      <div class="kb-source-label">知识库资料来源</div>
      <div class="kb-source-dir">{{ stats?.sourceDir ?? "加载中..." }}</div>
      <div class="kb-actions">
        <button class="btn btn-primary" :disabled="syncing" @click="sync">
          {{ syncing ? "同步中..." : "同步知识库" }}
        </button>
        <button class="btn btn-ghost" @click="refresh">刷新</button>
      </div>
      <div v-if="syncResult" class="kb-sync-result">{{ syncResult }}</div>
      <div v-if="error" class="kb-error">错误: {{ error }}</div>
    </div>

    <div class="kb-stats">
      <div class="card kb-stat">
        <div class="kb-stat-num">{{ stats?.totalDocs ?? 0 }}</div>
        <div class="kb-stat-label">已记录文档</div>
      </div>
      <div class="card kb-stat">
        <div class="kb-stat-num">{{ stats?.totalChunks ?? 0 }}</div>
        <div class="kb-stat-label">向量分块</div>
      </div>
      <div class="card kb-stat">
        <div class="kb-stat-num">{{ stats?.indexed ?? 0 }}</div>
        <div class="kb-stat-label">已索引</div>
      </div>
      <div class="card kb-stat">
        <div class="kb-stat-num">{{ stats?.failed ?? 0 }}</div>
        <div class="kb-stat-label">失败</div>
      </div>
    </div>

    <div class="card">
      <h3 class="kb-table-title">已入库文档</h3>
      <table class="kb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>源文件</th>
            <th>分块数</th>
            <th>状态</th>
            <th>最后入库时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="documents.length === 0">
            <td colspan="5" class="kb-empty">
              暂无入库记录，点击"同步知识库"开始导入。
            </td>
          </tr>
          <tr v-for="doc in documents" :key="doc.id">
            <td>{{ doc.id }}</td>
            <td class="kb-source-cell">{{ doc.source_path }}</td>
            <td>{{ doc.chunk_count }}</td>
            <td>
              <span class="kb-status" :class="doc.status">
                {{ doc.status === "indexed" ? "已索引" : doc.status }}
              </span>
            </td>
            <td>{{ doc.last_ingested_at ? new Date(doc.last_ingested_at).toLocaleString() : "-" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.kb-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kb-source {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-source-label {
  font-size: 12px;
  color: #9ca3af;
}

.kb-source-dir {
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}

.kb-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.kb-sync-result {
  color: #16a34a;
  font-size: 14px;
}

.kb-error {
  color: #dc2626;
  font-size: 14px;
}

.kb-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.kb-stat {
  text-align: center;
}

.kb-stat-num {
  font-size: 32px;
  font-weight: 700;
  color: #3b82f6;
}

.kb-stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: #6b7280;
}

.kb-table-title {
  margin-bottom: 12px;
  font-size: 16px;
}

.kb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.kb-table th,
.kb-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.kb-table th {
  color: #6b7280;
  font-weight: 500;
  background: #f8fafc;
}

.kb-source-cell {
  word-break: break-all;
}

.kb-status {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #eef2f7;
  color: #374151;
}

.kb-status.indexed {
  background: #dcfce7;
  color: #16a34a;
}

.kb-empty {
  text-align: center;
  color: #9ca3af;
  padding: 24px 0;
}
</style>
