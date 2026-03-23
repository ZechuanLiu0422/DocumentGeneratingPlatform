import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AppError } from '@/lib/api';
import { ensureProviderEnabled, getProviderConfig, type Provider } from '@/lib/providers';

export type AnalyzeResult = {
  tone: string;
  structure: string;
  vocabulary: string;
  sentenceStyle: string;
  logicFlow: string;
};

export const DOC_TYPE_NAMES = {
  notice: '通知',
  letter: '函',
  request: '请示',
  report: '报告',
} as const;

export function sanitizeModelOutput(text: string) {
  return text.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim();
}

function splitTitleAndContent(text: string) {
  const cleaned = sanitizeModelOutput(text);
  const parts = cleaned.split('\n\n', 2);

  if (parts.length === 2) {
    return {
      title: parts[0].trim(),
      content: parts[1].trim(),
    };
  }

  const [title, ...rest] = cleaned.split('\n');
  return {
    title: title?.trim() || '未命名文档',
    content: rest.join('\n').trim() || cleaned,
  };
}

export async function callModel(provider: Provider, prompt: string) {
  ensureProviderEnabled(provider);
  const config = getProviderConfig(provider);

  try {
    if (provider === 'claude') {
      const client = new Anthropic({
        apiKey: config.apiKey,
        timeout: 30_000,
      });

      const response = await client.messages.create({
        model: config.model,
        max_tokens: 2_000,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content
        .map((item) => ('text' in item ? item.text : ''))
        .join('\n')
        .trim();
    }

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: 30_000,
    });

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2_000,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error: any) {
    if (error?.status === 401) {
      throw new AppError(502, `${config.label} 认证失败，请检查平台密钥配置`, 'AI_AUTH_FAILED');
    }
    if (error?.status === 429) {
      throw new AppError(429, `${config.label} 当前请求较多，请稍后重试`, 'AI_RATE_LIMITED');
    }
    if (error?.name === 'AbortError') {
      throw new AppError(504, `${config.label} 响应超时，请稍后重试`, 'AI_TIMEOUT');
    }

    throw new AppError(502, `${config.label} 当前不可用，请稍后重试`, 'AI_REQUEST_FAILED');
  }
}

function buildPrompt(docType: keyof typeof DOC_TYPE_NAMES, recipient: string, content: string) {
  const prompts = {
    notice: `资深公文写作专家，精通GB/T 9704-2012。

任务：将"${content}"转为规范通知正文（主送：${recipient}）

【行文规范】
根据"${recipient}"判断层级（省>市>区县），用恰当语气。
称谓：称呼对方统一用"贵单位"，称呼我方统一用"我单位"，自然融入正文，勿写"贵单位："格式。

【语言要求】
开头："根据...精神""现将...通知如下"
主体：用"一、二、三"序号，段落间双换行
分点格式：采用"标题+内容"形式，如"一、工作目标"后换行再写具体内容，不要写成"一、工作目标：内容..."
结尾："特此通知"
避免口语化，用规范书面语

直接输出正文，勿含标题、主送机关、落款。`,
    letter: `资深公文写作专家，精通GB/T 9704-2012。

任务：将"${content}"转为规范函正文（主送：${recipient}）

【行文规范】
根据"${recipient}"判断层级，用恰当语气。
称谓：称呼对方统一用"贵单位"，称呼我方统一用"我单位"，自然融入正文，勿写"贵单位："格式。

【语言要求】
开头："收悉""根据工作需要""现函告如下"
分点格式：采用"标题+内容"形式，如"一、基本情况"后换行再写具体内容，不要写成"一、基本情况：内容..."
结尾：对上级"恳请支持为盼"、对平级"请予支持为盼"、对下级"请予配合"
语气平等诚恳，段落间双换行

直接输出正文，勿含标题、主送机关、落款。`,
    request: `资深公文写作专家，精通GB/T 9704-2012。

任务：将"${content}"转为规范请示正文（主送：${recipient}）

【行文规范】
请示用于下级向上级，必须恭敬诚恳。
称谓：称呼对方统一用"贵单位"，称呼我方统一用"我单位"，自然融入正文，勿写"贵单位："格式。

【语言要求】
开头："根据...规定""现请示如下"
主体：一文一事，理由充分，用"一、二、三"序号
分点格式：采用"标题+内容"形式，如"一、请示事项"后换行再写具体内容，不要写成"一、请示事项：内容..."
结尾："妥否，请批示"或"当否，请批示"（必须）
段落间双换行

直接输出正文，勿含标题、主送机关、落款。`,
    report: `资深公文写作专家，精通GB/T 9704-2012。

任务：将"${content}"转为规范报告正文（主送：${recipient}）

【行文规范】
报告用于下级向上级汇报，语气客观恭敬。
称谓：称呼对方统一用"贵单位"，称呼我方统一用"我单位"，自然融入正文，勿写"贵单位："格式。

【语言要求】
开头："根据...要求""现将...报告如下"
主体：情况详实，分析深入，用"一、二、三"序号
分点格式：采用"标题+内容"形式，如"一、工作进展"后换行再写具体内容，不要写成"一、工作进展：内容..."
结尾："特此报告"（必须）
段落间双换行

直接输出正文，勿含标题、主送机关、落款。`,
  };

  return prompts[docType];
}

export async function generateDocument(params: {
  docType: keyof typeof DOC_TYPE_NAMES;
  recipient: string;
  content: string;
  provider: Provider;
  title?: string;
  attachments?: string[];
  referenceAnalysis?: AnalyzeResult | null;
  imitationStrength?: 'strict' | 'moderate' | 'loose';
}) {
  const { docType, recipient, content, provider, title, attachments = [], referenceAnalysis, imitationStrength = 'moderate' } = params;

  if (referenceAnalysis) {
    const strengthDesc = {
      strict: '严格：高度贴合参考风格，保持相似的句式和用词习惯',
      moderate: '适中：学习核心特征，但允许自然变化',
      loose: '宽松：仅参考整体风格，具体表达灵活处理',
    };

    let prompt = `你是一位资深公文写作专家。请根据以下参考风格特征，生成一份新的${DOC_TYPE_NAMES[docType]}。

【风格特征】（从参考公文中学习）
- 语气：${referenceAnalysis.tone}
- 结构：${referenceAnalysis.structure}
- 用词：${referenceAnalysis.vocabulary}
- 句式：${referenceAnalysis.sentenceStyle}
- 逻辑：${referenceAnalysis.logicFlow}

【仿写强度】：${imitationStrength}
${strengthDesc[imitationStrength]}

【新公文信息】
主送机关：${recipient}
主要内容：${content}

关键约束：
1. 只学习风格特征，不复制具体内容、事实、数据
2. 标题、发文机关、日期等由系统填充，正文中不要提及
3. 不要生硬套用参考语句，保持逻辑自洽

【行文规范】
根据"${recipient}"判断层级（省/市/区县、委/厅/局/办），用恰当语气。
称谓：称呼对方统一用"贵单位"，称呼我方统一用"我单位"，自然融入正文。
主送机关已由系统单独显示，正文直接从内容开始，勿写"贵单位："这样的格式。
分点格式：采用"标题+内容"形式，如"一、工作目标"后换行再写具体内容，不要写成"一、工作目标：内容..."`;

    if (attachments.length > 0) {
      prompt += `\n\n附件${attachments.length}个：`;
      attachments.forEach((attachment, index) => {
        prompt += `\n${index + 1}. ${attachment}`;
      });
      prompt += `\n正文中自然插入"（见附件X）"，位置在相关句末或段末。`;
    }

    prompt += `\n\n请生成符合GB/T 9704-2012标准的规范公文正文，体现参考风格。段落间用双换行符分隔。\n\n${
      title ? `标题：${title}` : '请根据内容拟定标题。'
    }\n\n请按以下格式输出（第一行是标题，第二行空行，第三行开始是正文）：\n标题内容\n\n正文内容`;

    return splitTitleAndContent(await callModel(provider, prompt));
  }

  let prompt = buildPrompt(docType, recipient, content);
  prompt += `\n\n【行文规范】\n根据主送机关判断层级（省>市>区县），用恰当语气。\n称谓：称呼对方统一用"贵单位"，称呼我方统一用"我单位"，自然融入正文，勿写"贵单位："格式。`;

  if (attachments.length > 0) {
    prompt += `\n\n附件${attachments.length}个：`;
    attachments.forEach((attachment, index) => {
      prompt += `\n${index + 1}. ${attachment}`;
    });
    prompt += `\n正文中自然插入"（见附件X）"，位置在相关句末或段末。`;
  }

  if (title) {
    const contentOnly = await callModel(provider, prompt);
    return {
      title,
      content: sanitizeModelOutput(contentOnly),
    };
  }

  prompt += `\n\n请根据上述内容拟定规范的${DOC_TYPE_NAMES[docType]}标题。\n\n请按以下格式输出（第一行是标题，第二行空行，第三行开始是正文）：\n标题内容\n\n正文内容`;
  return splitTitleAndContent(await callModel(provider, prompt));
}

export async function refineGeneratedContent(params: {
  docType: keyof typeof DOC_TYPE_NAMES;
  recipient: string;
  originalContent: string;
  userFeedback: string;
  provider: Provider;
}) {
  const prompt = `你是一位资深的公文写作专家。用户选中了公文的某个部分并提出了修改意见。

【分析用户意图】
首先判断用户想要什么类型的修改：
- 语气调整（更正式/更亲切/更严肃）
- 内容扩充（增加细节/论据/例子）
- 内容精简（删减冗余/提炼要点）
- 格式调整（段落结构/条目化/合并）
- 纠错（语法/用词/逻辑）
- 重写（完全改写表达方式）

文档类型：${DOC_TYPE_NAMES[params.docType]}
主送机关：${params.recipient}

用户选中的内容：
${params.originalContent}

用户修改意见：
${params.userFeedback}

【输出要求】
1. 只输出修改后的选中部分
2. 不要添加标题、主送机关、落款等其他内容
3. 不要添加任何解释说明
4. 根据识别的意图进行针对性修改
5. 保持公文的规范性和专业性`;

  return sanitizeModelOutput(await callModel(params.provider, prompt));
}

export async function analyzeReferenceStyle(params: {
  docType: keyof typeof DOC_TYPE_NAMES;
  content: string;
  provider: Provider;
}) {
  const prompt = `你是一位资深公文写作专家。请深度分析以下${DOC_TYPE_NAMES[params.docType]}的正文写作风格。

【参考公文】
${params.content}

重要说明：
- 忽略标题、发文机关、日期、落款、附件等元数据
- 只分析正文部分的写作风格特征
- 不要记录具体的内容、数据或事实

请从以下维度分析正文风格：
1. 语气特点：正式程度、情感色彩、权威性表达
2. 结构特点：段落组织、逻辑顺序、层次划分方式
3. 用词风格：词汇类型、修饰手法、表达习惯
4. 句式特点：句子长度、复杂度、节奏感
5. 逻辑流程：论证方式、因果关系、递进层次

请严格按照以下 JSON 格式输出：
{
  "tone": "语气特点描述",
  "structure": "结构特点描述",
  "vocabulary": "用词风格描述",
  "sentenceStyle": "句式特点描述",
  "logicFlow": "逻辑流程描述"
}`;

  const response = await callModel(params.provider, prompt);
  const match = response.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(match?.[0] || response) as AnalyzeResult;
  } catch {
    return {
      tone: '正式、规范',
      structure: '层次清晰',
      vocabulary: '书面语为主',
      sentenceStyle: '句式规范',
      logicFlow: '逻辑严密',
    };
  }
}
