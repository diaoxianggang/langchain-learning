/**
 * ============================================================
 * 示例 03: LCEL 链式调用 (LangChain Expression Language)
 * ============================================================
 *
 * LCEL 是 LangChain 的核心编程范式！
 * 用 .pipe() 将组件串联成"管道"，数据从左到右流经每个组件。
 *
 * 【你将学到】
 * 1. 用 .pipe() 构建 prompt → model → parser 链
 * 2. StringOutputParser 提取纯文本
 * 3. batch() 批量并行调用
 * 4. 输入格式化：多变量模板
 * 5. 输出格式化：JSON 结构化输出
 * 6. 输出格式化：列表输出
 * 7. 链式格式化：组合多个输出处理步骤
 * 8. Zod schema 定义与验证
 * 9. Zod 与 JsonOutputParser 结合
 * 10. Zod 高级特性（可选字段、默认值、嵌套对象）
 *
 * 【Python vs TS 语法对比】
 *   Python: chain = prompt | model | parser    （用管道符 |）
 *   TS:     chain = prompt.pipe(model).pipe(parser)  （用 .pipe()）
 *
 * 【LCEL 的核心优势】
 *   - 统一接口：无论多复杂的链，都用 .invoke() / .stream() / .batch()
 *   - 自动并行：独立步骤可并行执行
 *   - 流式支持：每个组件的输出可流式传递
 */
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser, JsonOutputParser, CommaSeparatedListOutputParser, StructuredOutputParser } from "@langchain/core/output_parsers";
import { createMimoModel } from "./config.js";

async function main() {
  const model = await createMimoModel(0.7);

  // ===========================
  // 1. 最简单的链: prompt → model → parser
  // ===========================
  // StringOutputParser 从 AIMessage 中提取纯文本
  // 不加 parser 的话，invoke 返回的是 AIMessage 对象
  console.log("=== 示例 3.1: 基础 LCEL 链 ===");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "用一句话回答，不要多余内容"],
    ["human", "{topic}是什么？"],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const result = await chain.invoke({ topic: "TypeScript 泛型" });
  console.log("纯文本输出:", result);
  console.log("类型:", typeof result); // "string"（不是 AIMessage！）

  // ===========================
  // 2. 多步骤链：先生成，再翻译
  // ===========================
  console.log("\n=== 示例 3.2: 多步骤链（生成 → 翻译）===");

  // 第一步：生成英文内容
  const generatePrompt = ChatPromptTemplate.fromTemplate(
    "Write a one-sentence motivational quote about {topic}. Only output the quote."
  );
  const generateChain = generatePrompt.pipe(model).pipe(new StringOutputParser());

  // 第二步：翻译成中文
  const translatePrompt = ChatPromptTemplate.fromTemplate(
    "将以下英文翻译成中文，只返回翻译：\n\n{text}"
  );
  const translateChain = translatePrompt.pipe(model).pipe(new StringOutputParser());

  // 顺序调用：先生成英文，再翻译
  const english = await generateChain.invoke({ topic: "learning" });
  console.log("英文:", english);
  const chinese = await translateChain.invoke({ text: english });
  console.log("中文:", chinese);

  // ===========================
  // 3. 批量调用 (batch)
  // ===========================
  // batch() 可以并行处理多个输入，比逐个 invoke 更高效
  // 适合需要对多个输入做同样处理的场景
  console.log("\n=== 示例 3.3: 批量调用 ===");

  const results = await chain.batch([
    { topic: "闭包" },
    { topic: "装饰器" },
    { topic: "异步编程" },
  ]);
  results.forEach((r, i) => console.log(`  [${i + 1}]`, r));

  // ===========================
  // 4. 输入格式化：多变量模板
  // ===========================
  // 使用多个模板变量，演示如何格式化复杂的输入结构
  // 模板变量可以任意组合，灵活构建 prompt
  console.log("\n=== 示例 3.4: 输入格式化（多变量模板）===");

  const multiVarPrompt = ChatPromptTemplate.fromTemplate(
    "用{style}的方式，向{audience}解释{topic}的{concept}"
  );
  const multiVarChain = multiVarPrompt.pipe(model).pipe(new StringOutputParser());

  // 提供所有变量，演示完整的输入格式化
  const multiVarResult = await multiVarChain.invoke({
    style: "通俗易懂",
    audience: "初学者",
    topic: "JavaScript",
    concept: "闭包",
  });
  console.log("结果:", multiVarResult);

  // ===========================
  // 5. 输出格式化：结构化输出
  // ===========================
  // 使用 JsonOutputParser 让 LLM 返回结构化的 JSON 数据
  // 这在需要程序化处理输出时非常有用
  console.log("\n=== 示例 3.5: 输出格式化（JSON 结构化）===");

  const { JsonOutputParser } = await import("@langchain/core/output_parsers");

  const jsonPrompt = ChatPromptTemplate.fromTemplate(
    `分析以下技术的优缺点，返回 JSON 格式：
技术: {tech}

{format}`
  );

  const jsonParser = new JsonOutputParser();
  const jsonChain = jsonPrompt.pipe(model).pipe(jsonParser);

  const jsonResult = await jsonChain.invoke({
    tech: "TypeScript",
    format: jsonParser.getFormatInstructions(),
  });
  console.log("JSON 结果:", JSON.stringify(jsonResult, null, 2));
  console.log("是对象?", typeof jsonResult === "object");

  // ===========================
  // 6. 输出格式化：列表输出
  // ===========================
  // 使用 CommaSeparatedListOutputParser 将输出转为数组
  // 适合需要提取多个项目的场景
  console.log("\n=== 示例 3.6: 输出格式化（列表输出）===");

  const { CommaSeparatedListOutputParser } = await import("@langchain/core/output_parsers");

  const listPrompt = ChatPromptTemplate.fromTemplate(
    "列出3个{category}的代表性技术，用逗号分隔"
  );

  const listParser = new CommaSeparatedListOutputParser();
  const listChain = listPrompt.pipe(model).pipe(listParser);

  const listResult = await listChain.invoke({ category: "前端框架" });
  console.log("列表结果:", listResult);
  console.log("是数组?", Array.isArray(listResult));

  // ===========================
  // 7. 链式格式化：组合多个输出处理步骤
  // ===========================
  // 可以在链中串联多个输出处理器，实现复杂的格式化逻辑
  console.log("\n=== 示例 3.7: 链式格式化（多步骤处理）===");

  // 先让 LLM 生成内容，然后用字符串处理管道清理格式
  const cleanupChain = ChatPromptTemplate.fromTemplate(
    "写一个关于{topic}的笑话，包含 setup 和 punchline"
  )
    .pipe(model)
    .pipe(new StringOutputParser())
    .pipe(async (text: string) => {
      // 自定义后处理：清理格式、提取关键部分
      const lines = text.split('\n').filter(line => line.trim());
      return {
        joke: lines.join(' '),
        wordCount: text.length,
        hasSetup: text.toLowerCase().includes('setup'),
        hasPunchline: text.toLowerCase().includes('punchline'),
      };
    });

  const jokeResult = await cleanupChain.invoke({ topic: "编程" });
  console.log("笑话分析:", JSON.stringify(jokeResult, null, 2));

  // ===========================
  // 8. Zod schema 定义与验证
  // ===========================
  // Zod 是 TypeScript 生态最流行的 schema 验证库
  // 类似 Python 的 Pydantic，用于定义和验证数据结构
  // .describe() 给每个字段加说明，帮助 LLM 理解该填什么
  console.log("\n=== 示例 3.8: Zod schema 定义与验证 ===");

  const movieReviewSchema = z.object({
    title: z.string().describe("电影名称"),
    year: z.number().describe("上映年份"),
    rating: z.number().min(1).max(10).describe("评分，1-10"),
    pros: z.array(z.string()).describe("优点列表，至少2项"),
    cons: z.array(z.string()).describe("缺点列表，至少1项"),
    summary: z.string().describe("一句话总结"),
  });

  // 使用 Zod schema 验证 LLM 输出
  const validatePrompt = ChatPromptTemplate.fromTemplate(
    `你是一个影评专家。请评价以下电影，返回 JSON 格式。

电影: {movie}

要求返回如下 JSON 结构（不要输出其他内容，只输出 JSON）:
{{
  "title": "电影名称",
  "year": 上映年份(数字),
  "rating": 评分1-10(数字),
  "pros": ["优点1", "优点2"],
  "cons": ["缺点1"],
  "summary": "一句话总结"
}}`
  );

  const validateChain = validatePrompt.pipe(model).pipe(new JsonOutputParser());
  const movieResult = await validateChain.invoke({ movie: "星际穿越 (Interstellar)" });

  // .parse() 会校验数据是否符合 schema，不符合会抛出错误
  try {
    const parsedMovie = movieReviewSchema.parse(movieResult);
    console.log("Zod 验证通过:");
    console.log("  标题:", parsedMovie.title);
    console.log("  年份:", parsedMovie.year);
    console.log("  评分:", parsedMovie.rating + "/10");
    console.log("  优点:", parsedMovie.pros);
    console.log("  缺点:", parsedMovie.cons);
    console.log("  总结:", parsedMovie.summary);
  } catch (error) {
    console.log("Zod 验证失败:", error);
  }

  // ===========================
  // 9. Zod 与 JsonOutputParser 结合
  // ===========================
  // 可以将 Zod schema 传递给 JsonOutputParser，自动注入格式指令
  // 这样就不需要在 prompt 中手动写 JSON 结构了
  console.log("\n=== 示例 3.9: Zod 与 JsonOutputParser 结合 ===");

  const techSchema = z.object({
    name: z.string().describe("技术名称"),
    language: z.string().describe("主要编程语言"),
    useCases: z.array(z.string()).describe("使用场景"),
    difficulty: z.enum(["入门", "中级", "高级"]).describe("学习难度"),
    recommendation: z.string().describe("一句话推荐理由"),
  });

  const techPrompt = ChatPromptTemplate.fromTemplate(
    `分析以下技术栈，返回 JSON 格式：

技术: {tech}

{format}`
  );

  // 使用 getFormatInstructions() 自动注入 Zod schema 的格式要求
  const techParser = new JsonOutputParser();
  const techChain = techPrompt.pipe(model).pipe(techParser);

  const techResult = await techChain.invoke({
    tech: "Next.js",
    format: techParser.getFormatInstructions(),
  });

  try {
    const parsedTech = techSchema.parse(techResult);
    console.log("技术分析（Zod 验证通过）:");
    console.log("  名称:", parsedTech.name);
    console.log("  语言:", parsedTech.language);
    console.log("  场景:", parsedTech.useCases);
    console.log("  难度:", parsedTech.difficulty);
    console.log("  推荐:", parsedTech.recommendation);
  } catch (error) {
    console.log("Zod 验证失败:", error);
  }

  // ===========================
  // 10. Zod 高级特性：可选字段、默认值、嵌套对象
  // ===========================
  // Zod 支持丰富的数据结构定义，满足复杂场景需求
  console.log("\n=== 示例 3.10: Zod 高级特性 ===");

  const advancedSchema = z.object({
    // 基础字段
    name: z.string(),
    age: z.number().min(0).max(150),

    // 可选字段（可以不提供）
    email: z.string().email().optional(),
    phone: z.string().optional(),

    // 带默认值的字段
    status: z.enum(["active", "inactive"]).default("active"),
    createdAt: z.date().default(() => new Date()),

    // 嵌套对象
    address: z.object({
      street: z.string(),
      city: z.string(),
      country: z.string().default("中国"),
      zipCode: z.string().optional(),
    }),

    // 数组字段
    hobbies: z.array(z.string()).min(1).max(5),

    // 联合类型
    role: z.union([
      z.literal("admin"),
      z.literal("user"),
      z.literal("guest"),
    ]),
  });

  // 使用 Zod 的 safeParse 方法，不会抛出错误
  const sampleData = {
    name: "张三",
    age: 25,
    email: "zhangsan@example.com",
    address: {
      street: "中关村大街1号",
      city: "北京",
    },
    hobbies: ["编程", "阅读", "运动"],
    role: "user",
  };

  const validationResult = advancedSchema.safeParse(sampleData);
  if (validationResult.success) {
    console.log("高级 schema 验证通过:");
    console.log("  姓名:", validationResult.data.name);
    console.log("  年龄:", validationResult.data.age);
    console.log("  邮箱:", validationResult.data.email);
    console.log("  状态:", validationResult.data.status); // 使用默认值
    console.log("  地址:", validationResult.data.address);
    console.log("  爱好:", validationResult.data.hobbies);
    console.log("  角色:", validationResult.data.role);
  } else {
    console.log("验证失败:", validationResult.error.issues);
  }

  // 验证失败的情况
  const invalidData = {
    name: "李四",
    age: -5, // 无效年龄
    address: {
      street: "南京路",
      city: "上海",
    },
    hobbies: [], // 空数组，违反 min(1) 约束
    role: "superadmin", // 无效角色
  };

  const invalidResult = advancedSchema.safeParse(invalidData);
  if (!invalidResult.success) {
    console.log("\n预期验证失败:");
    invalidResult.error.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  // ===========================
  // 11. Zod 直接约束输出：StructuredOutputParser
  // ===========================
  // StructuredOutputParser 会自动将 Zod schema 转换为格式指令注入 prompt
  // 并在解析时自动校验，无需手动调用 .parse()
  console.log("\n=== 示例 3.11: StructuredOutputParser（Zod 直接约束输出）===");

  const bookSchema = z.object({
    title: z.string().describe("书名"),
    author: z.string().describe("作者"),
    year: z.number().describe("出版年份"),
    rating: z.number().min(1).max(5).describe("评分，1-5星"),
    tags: z.array(z.string()).describe("标签列表"),
    summary: z.string().describe("一句话推荐"),
  });

  // 从 Zod schema 创建 parser，自动生成格式指令
  const bookParser = StructuredOutputParser.fromZodSchema(bookSchema);

  const bookPrompt = ChatPromptTemplate.fromTemplate(
    `推荐一本关于{topic}的书，返回 JSON 格式。

{format}`
  );

  const bookChain = bookPrompt.pipe(model).pipe(bookParser);

  const bookResult = await bookChain.invoke({
    topic: "TypeScript",
    format: bookParser.getFormatInstructions(), // 自动注入 schema 说明
  });

  // 结果已经过 Zod 校验，类型安全
  console.log("书籍推荐（StructuredOutputParser）:");
  console.log("  书名:", bookResult.title);
  console.log("  作者:", bookResult.author);
  console.log("  年份:", bookResult.year);
  console.log("  评分:", bookResult.rating + "星");
  console.log("  标签:", bookResult.tags);
  console.log("  推荐:", bookResult.summary);

  // ===========================
  // 12. 三种方式对比总结
  // ===========================
  console.log("\n=== Zod 结构化输出方式对比 ===");
  console.log(`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Zod 结构化输出三种方式对比                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 方式                      │ 原理                     │ 特点                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. JsonOutputParser       │ prompt 中手动写 JSON      │ 兼容所有模型               │
│    + schema.parse()       │ 结构，输出后手动校验        │ 需自己维护 prompt 中的格式  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. StructuredOutputParser │ 自动从 Zod schema 生成     │ schema 变更自动同步         │
│    from Zod schema        │ 格式指令并注入 prompt       │ 输出自动校验，类型安全      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. withStructuredOutput() │ 利用模型的 function        │ 最可靠，由 API 层面保证     │
│                           │ calling 能力               │ 需要模型支持               │
└─────────────────────────────────────────────────────────────────────────────────┘

推荐选择：
- 模型支持 function calling → 用 withStructuredOutput()
- 模型不支持 → 用 StructuredOutputParser（自动同步 schema）
- 需要最大灵活性 → 用 JsonOutputParser + 手动 parse()
  `);
}

main().catch(console.error);
