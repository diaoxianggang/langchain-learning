/**
 * ============================================================
 * 示例 09: RAG 检索增强生成 (Retrieval-Augmented Generation)
 * ============================================================
 *
 * RAG 是 LLM 应用最重要的模式之一！
 * 让 LLM 基于你的私有文档来回答问题，而不是仅靠训练数据。
 *
 * 【你将学到】
 * 1. Document 对象的创建
 * 2. RecursiveCharacterTextSplitter 文本分割
 * 3. 简单关键词检索实现（适合入门理解原理）
 * 4. 使用 Ollama 本地向量模型进行语义检索（生产级方案）
 * 5. 构建完整的 RAG 链
 *
 * 【RAG 的工作流程】
 *   文档 → 分块 → 向量化 → 存储
 *   用户提问 → 检索相关块 → 拼接到 prompt → LLM 生成回答
 *
 * 【向量化是什么？为什么需要？】
 *   关键词检索只能匹配字面相同的词，比如搜"好处"匹配不到"优势"。
 *   向量化（Embedding）把文本转换成一串数字（向量），语义相近的文本向量也相近。
 *   这样"好处"和"优势"就能被正确匹配了！
 *
 * 【Python 对比】
 *   from langchain.document_loaders import TextLoader
 *   from langchain.text_splitter import RecursiveCharacterTextSplitter
 *   from langchain.chains import RetrievalQA
 *   from langchain.embeddings import OllamaEmbeddings
 *
 * 【v1.x 变化】
 * RAG 的核心 API 没有变化，但推荐使用 LangGraph 构建更复杂的 RAG Agent。
 */
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.3);

  // ===========================
  // 1. 准备知识库文档
  // ===========================
  // 实际项目中，文档通常从文件/网页/数据库加载
  // 这里用 Document 对象手动创建示例文档
  // Document 的 pageContent 是文本内容，metadata 是元数据
  console.log("=== 示例 9.1: 准备知识库文档 ===\n");

  const documents = [
    new Document({
      pageContent: `TypeScript 是 JavaScript 的超集，添加了静态类型系统。
TypeScript 由微软开发和维护，最新稳定版本是 5.x。
TypeScript 代码需要编译为 JavaScript 才能在浏览器或 Node.js 中运行。
TypeScript 的主要优势包括：类型安全、更好的 IDE 支持、重构友好。`,
      metadata: { source: "typescript-intro.md", topic: "TypeScript基础" },
    }),
    new Document({
      pageContent: `LangChain 是一个用于构建 LLM 应用的框架。
LangChain 的核心概念包括：Chains（链）、Agents（代理）、Memory（记忆）、Retrieval（检索）。
LangChain 支持 Python 和 TypeScript 两个版本。
LangChain 使用 LCEL（LangChain Expression Language）来组合不同的组件。`,
      metadata: { source: "langchain-intro.md", topic: "LangChain基础" },
    }),
    new Document({
      pageContent: `RAG（Retrieval-Augmented Generation）是一种结合检索和生成的 AI 技术。
RAG 的工作流程：文档分块 → 向量化 → 存储 → 检索 → 生成回答。
RAG 的优势：减少幻觉、知识可更新、来源可追溯。
常用的向量数据库包括：Pinecone、Chroma、FAISS、pgvector。`,
      metadata: { source: "rag-intro.md", topic: "RAG技术" },
    }),
    new Document({
      pageContent: `Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时。
Node.js 使用事件驱动、非阻塞 I/O 模型，适合高并发场景。
Node.js 的包管理器有 npm、yarn、pnpm。
Node.js 18+ 支持原生 Fetch API，Node.js 20+ 支持稳定版。`,
      metadata: { source: "nodejs-intro.md", topic: "Node.js基础" },
    }),
  ];

  console.log(`知识库包含 ${documents.length} 个文档:`);
  documents.forEach((d) => {
    console.log(`  - ${d.metadata.source}: ${d.pageContent.slice(0, 40)}...`);
  });

  // ===========================
  // 2. 文本分割 (Text Splitting)
  // ===========================
  // 为什么要分割？因为：
  // 1) LLM 有上下文长度限制，不能把整本书塞进去
  // 2) 检索时需要精确匹配，小块比大块更精准
  // chunkOverlap 让相邻块有重叠，避免重要信息被切断
  console.log("\n=== 示例 9.2: 文本分割 ===\n");

  const { RecursiveCharacterTextSplitter } = await import("@langchain/textsplitters");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,      // 每个块最大 200 字符
    chunkOverlap: 50,    // 相邻块重叠 50 字符（保持上下文连贯）
  });

  const splitDocs = await splitter.splitDocuments(documents);
  console.log(`分割前: ${documents.length} 个文档`);
  console.log(`分割后: ${splitDocs.length} 个文档块`);
  splitDocs.forEach((d, i) => {
    console.log(`  [${i}] (${d.pageContent.length}字符) ${d.pageContent.slice(0, 50)}...`);
  });

  // ===========================
  // 3. 简单关键词检索（入门版）
  // ===========================
  // 这是最简单的检索方式，通过关键词匹配来找相关文档
  // 优点：简单易懂，不需要额外模型
  // 缺点：只能匹配字面相同的词，无法理解语义
  //       比如搜"好处"匹配不到"优势"，搜"TS"匹配不到"TypeScript"
  console.log("\n=== 示例 9.3: 简单关键词检索 + RAG ===\n");

  function simpleRetriever(query: string, topK = 2): Document[] {
    // 把用户问题拆成单词，逐个匹配文档内容
    const scored = splitDocs.map((doc) => {
      const words = query.toLowerCase().split(/\s+/);
      let score = 0;
      for (const word of words) {
        if (doc.pageContent.toLowerCase().includes(word)) {
          score += 1;  // 匹配到一个关键词就加 1 分
        }
      }
      return { doc, score };
    });
    // 按分数排序，取 topK 个最相关的文档
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.doc);
  }

  // ===========================
  // 4. 向量检索（生产级方案）
  // ===========================
  // 向量检索的优势：
  // 1. 语义理解："好处"能匹配到"优势"，"TS"能匹配到"TypeScript"
  // 2. 多语言支持：中文问题能匹配英文文档
  // 3. 更精准：理解句子含义，而不是简单关键词匹配
  //
  // 工作原理：
  // 1. Embedding 模型把文本转换成向量（一串数字，比如 1024 维）
  // 2. 语义相近的文本，向量距离也相近
  // 3. 检索时，把用户问题也转成向量，找最相近的文档向量
  console.log("\n=== 示例 9.4: 向量检索 + RAG ===\n");

  // 创建 Ollama Embedding 模型
  // 前提：确保 Ollama 已启动，且已拉取 qwen3-embedding:4b 模型
  // 命令：ollama pull qwen3-embedding:4b
  const embeddings = new OllamaEmbeddings({
    model: "qwen3-embedding:4b",  // 使用本地的向量模型
    baseUrl: "http://localhost:11434",  // Ollama 默认地址
  });

  console.log("正在创建向量存储（需要调用 Ollama 生成向量）...");
  console.log("首次运行可能需要几分钟，取决于文档数量和模型大小\n");

  // MemoryVectorStore 是内存向量数据库，适合学习和小规模数据
  // 生产环境可以用 Pinecone、Chroma、FAISS 等专业向量数据库
  const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);

  // 创建向量检索器
  // k=2 表示每次检索返回最相似的 2 个文档
  const vectorRetriever = vectorStore.asRetriever({ k: 2 });

  // 测试向量检索
  console.log("测试向量检索：");
  const testQuery = "TypeScript 有什么好处？";  // 注意：用"好处"而不是"优势"
  const relevantDocs = await vectorRetriever.invoke(testQuery);
  console.log(`问题: "${testQuery}"`);
  console.log(`检索到 ${relevantDocs.length} 个相关文档:`);
  relevantDocs.forEach((doc: Document, i: number) => {
    console.log(`  [${i+1}] ${doc.metadata.source}: ${doc.pageContent.slice(0, 60)}...`);
  });

  // ===========================
  // 5. 构建 RAG 链（使用向量检索）
  // ===========================
  // RAG Prompt 的关键：{context} 放检索到的文档，{question} 放用户问题
  // LLM 会根据 context 来回答，而不是靠自己的"记忆"
  console.log("\n=== 示例 9.5: 向量 RAG 链 ===\n");

  const ragPrompt = ChatPromptTemplate.fromTemplate(
    `你是一个知识问答助手。根据以下参考文档回答问题。
如果文档中没有相关信息，请说明你不确定。
回答要简洁准确。

参考文档:
{context}

用户问题: {question}

回答:`
  );

  // 使用向量检索器的 RAG 链
  // 这次用 vectorRetriever 替代 simpleRetriever，检索更智能
  const vectorRagChain = RunnableSequence.from([
    async (input: { question: string }) => {
      const docs = await vectorRetriever.invoke(input.question);
      return {
        context: docs.map((d: Document) => d.pageContent).join("\n\n---\n\n"),
        question: input.question,
      };
    },
    ragPrompt,
    model,
    new StringOutputParser(),
  ]);

  // 测试向量 RAG 链
  // 注意这些问题故意用了不同的表述方式，展示向量检索的优势
  const questions = [
    "TypeScript 有什么好处？",           // "好处"能匹配到文档中的"优势"
    "RAG 技术的原理是什么？",              // 测试语义理解
    "LangChain 有哪些核心组件？",          // "组件"能匹配到"概念"
    "Python 和 JavaScript 哪个更好？",     // 知识库中没有相关信息
  ];

  console.log("向量 RAG 回答结果：\n");
  for (const question of questions) {
    console.log(`Q: ${question}`);
    const answer = await vectorRagChain.invoke({ question });
    console.log(`A: ${answer}\n`);
  }

  // ===========================
  // 6. 对比：关键词检索 vs 向量检索
  // ===========================
  console.log("\n=== 示例 9.6: 关键词检索 vs 向量检索对比 ===\n");

  // 使用同样的问题测试两种检索方式
  const compareQuery = "TS 有什么好处？";  // 使用缩写"TS"而不是"TypeScript"
  console.log(`测试问题: "${compareQuery}"\n`);

  console.log("【关键词检索结果】");
  const keywordDocs = simpleRetriever(compareQuery);
  if (keywordDocs.length === 0) {
    console.log("  未找到相关文档（因为关键词\"TS\"无法匹配\"TypeScript\"）");
  } else {
    keywordDocs.forEach((doc, i) => {
      console.log(`  [${i+1}] ${doc.metadata.source}: ${doc.pageContent.slice(0, 50)}...`);
    });
  }

  console.log("\n【向量检索结果】");
  const semanticDocs = await vectorRetriever.invoke(compareQuery);
  semanticDocs.forEach((doc: Document, i: number) => {
    console.log(`  [${i+1}] ${doc.metadata.source}: ${doc.pageContent.slice(0, 50)}...`);
  });

  console.log("\n结论：向量检索能理解\"TS\"是\"TypeScript\"的缩写，而关键词检索不行。");
  console.log("这就是为什么生产环境都使用向量检索！\n");
}

main().catch(console.error);
