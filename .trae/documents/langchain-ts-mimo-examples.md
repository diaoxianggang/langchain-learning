# LangChain TypeScript 示例代码生成计划

## Summary

在空目录 `e:\other\langchain-ts` 中从零搭建一个 TypeScript 项目，使用 MIMO 模型（OpenAI 兼容 API）生成 LangChain TS 常用模块的带注释可运行示例代码。

**MIMO API 配置：**
- Base URL: `https://token-plan-cn.xiaomimimo.com/v1`
- Model: `mimo-v2.5-pro`
- API Key: `tp-c0amcl56bk4edwythiyizj3wd4zaec1bdbnsaaxng3zatghv`

## Current State

- `e:\other\langchain-ts` 目录完全为空
- 需要从零初始化 TypeScript 项目
- LangChain TS 最新核心包版本: `@langchain/core@^1.2.8`, `@langchain/openai@^1.5.7`
- MIMO API 兼容 OpenAI Chat Completions API，可直接使用 `ChatOpenAI` 类

## 项目结构

```
langchain-ts/
├── package.json
├── tsconfig.json
├── .env                    # API Key 环境变量
├── src/
│   ├── config.ts           # 共享模型配置（MIMO API）
│   ├── 01_chat_model.ts    # 基础聊天模型调用
│   ├── 02_prompt_template.ts # 提示词模板
│   ├── 03_lcel_chain.ts    # LCEL 链式调用
│   ├── 04_output_parser.ts # 输出解析器
│   ├── 05_streaming.ts     # 流式输出
│   ├── 06_structured_output.ts # 结构化输出（Zod）
│   ├── 07_tools_and_agent.ts   # 工具定义与 Agent
│   ├── 08_memory.ts        # 对话记忆
│   └── 09_rag.ts           # RAG 检索增强生成
└── ts-node.mjs             # tsx 运行辅助（可选）
```

## 实施步骤

### Step 1: 初始化项目
- 创建 `package.json`，安装依赖：
  - `langchain`, `@langchain/core`, `@langchain/openai` — 核心包
  - `@langchain/community` — 社区工具/加载器
  - `zod` — 结构化输出 schema
  - `dotenv` — 环境变量
  - `tsx` — 直接运行 TS 文件
  - `typescript`, `@types/node` — 类型支持
- 创建 `tsconfig.json`（ESM 模式，NodeNext 模块解析）
- 创建 `.env` 存放 MIMO API Key

### Step 2: 创建共享配置 `src/config.ts`
- 封装 MIMO 模型初始化，方便所有示例复用
- 使用 `ChatOpenAI` 配置 custom `baseURL` 和 `apiKey`

### Step 3: 基础聊天模型 `src/01_chat_model.ts`
- 演示 `ChatOpenAI` 基本调用（`invoke`）
- 演示 `HumanMessage` / `SystemMessage` / `AIMessage` 消息类型
- 对应 Python: `ChatOpenAI().invoke()`

### Step 4: 提示词模板 `src/02_prompt_template.ts`
- `ChatPromptTemplate.fromMessages()` — 对话模板
- `PromptTemplate.fromTemplate()` — 简单字符串模板
- 变量占位符 `{variable}` 的使用

### Step 5: LCEL 链式调用 `src/03_lcel_chain.ts`
- `.pipe()` 构建 prompt → model → parser 链
- `StringOutputParser` 提取纯文本
- 对应 Python: LCEL `|` 管道语法

### Step 6: 输出解析器 `src/04_output_parser.ts`
- `StringOutputParser` — 字符串
- `CommaSeparatedListOutputParser` — 逗号分隔列表
- `JsonOutputParser` — JSON 输出

### Step 7: 流式输出 `src/05_streaming.ts`
- `model.stream()` 逐 token 流式返回
- `chain.stream()` 链式流式
- 对应 Python: `model.stream()` / `chain.stream()`

### Step 8: 结构化输出 `src/06_structured_output.ts`
- 使用 `zod` 定义输出 schema
- `model.withStructuredOutput(schema)` 强制模型返回结构化 JSON

### Step 9: 工具与 Agent `src/07_tools_and_agent.ts`
- `tool()` 定义自定义工具（Zod schema）
- `createAgent()` 创建 ReAct Agent
- Agent 自动调用工具完成任务
- 对应 Python: `create_react_agent()`

### Step 10: 对话记忆 `src/08_memory.ts`
- 手动管理消息历史（`HumanMessage` / `AIMessage` 数组）
- 在多轮对话中传递历史消息
- 对应 Python: `ConversationBufferMemory`

### Step 11: RAG 检索增强生成 `src/09_rag.ts`
- `Document` 类手动创建文档
- `RecursiveCharacterTextSplitter` 文本分割
- `MemoryVectorStore` 内存向量存储（无需外部数据库）
- `ChatPromptTemplate` + 检索器构建 RAG 链
- 对应 Python: `RetrievalQA` chain

### Step 12: 配置 npm scripts
在 `package.json` 中添加便捷运行脚本：
```json
{
  "scripts": {
    "01": "tsx src/01_chat_model.ts",
    "02": "tsx src/02_prompt_template.ts",
    ...
    "09": "tsx src/09_rag.ts"
  }
}
```

## Key Design Decisions

1. **使用 `ChatOpenAI` 而非自定义 LLM 类** — MIMO API 兼容 OpenAI 格式，直接用 `ChatOpenAI` + 自定义 `baseURL` 最简洁
2. **ESM 模块** — LangChain TS 官方推荐 ESM，使用 `"type": "module"` + `tsx` 运行
3. **每文件独立可运行** — 每个示例自包含，`tsx src/xx_xxx.ts` 即可运行
4. **中英文注释** — 关键概念用中文注释，API 名称保留英文方便对照文档
5. **MemoryVectorStore** — RAG 示例使用内存向量存储，无需额外部署数据库

## Assumptions

- MIMO API 完全兼容 OpenAI Chat Completions API（包括 function calling / tool use）
- 用户本地已安装 Node.js 18+
- API Key 已在 `.env` 中配置

## Verification

1. `npm install` 安装依赖无报错
2. 逐个运行 `npx tsx src/01_chat_model.ts` ~ `src/09_rag.ts`，确认输出正确
3. 如 MIMO 不支持 tool calling，Step 9 (Agent) 可能需要降级为纯链式调用
