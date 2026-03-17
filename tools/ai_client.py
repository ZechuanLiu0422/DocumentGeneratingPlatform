#!/usr/bin/env python3
"""
AI 抽象层 - 统一多个 AI API 的调用接口
"""
import os
from anthropic import Anthropic
from openai import OpenAI
import httpx

class AIClient:
    def __init__(self, provider='claude', api_key=None):
        self.provider = provider

        if provider == 'claude':
            self.client = Anthropic(api_key=api_key)
        elif provider == 'openai':
            self.client = OpenAI(api_key=api_key)
        elif provider == 'doubao':
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://ark.cn-beijing.volces.com/api/v3",
                http_client=httpx.Client()
            )
        elif provider == 'glm':
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://open.bigmodel.cn/api/paas/v4",
                http_client=httpx.Client()
            )
        else:
            raise ValueError(f"不支持的 AI 提供商: {provider}")

    def generate_document(self, doc_type, recipient, content):
        """根据文档类型生成规范的公文内容"""
        prompt = self._build_prompt(doc_type, recipient, content)

        if self.provider == 'claude':
            return self._call_claude(prompt)
        elif self.provider in ['openai', 'doubao', 'glm']:
            return self._call_openai(prompt)

    def generate_document_with_title(self, doc_type, recipient, content, attachments=None):
        """生成公文内容和标题"""
        doc_type_names = {
            'notice': '通知',
            'letter': '函',
            'request': '请示',
            'report': '报告'
        }

        prompt = self._build_prompt(doc_type, recipient, content)

        # 如果有附件，添加附件信息到prompt
        if attachments and len(attachments) > 0:
            prompt += f"\n\n本文档包含{len(attachments)}个附件："
            for i, att in enumerate(attachments):
                prompt += f"\n附件{i+1}：{att}"
            prompt += "\n\n请在正文中适当位置引用这些附件，引用格式为'（见附件1）'、'（见附件2）'等，不要写出附件名称。"

        prompt += f"\n\n另外，请根据上述内容拟定一个规范的{doc_type_names.get(doc_type, '公文')}标题。标题应简洁明确，符合公文标题格式要求。\n\n请按以下格式输出（第一行是标题，第二行空行，第三行开始是正文）：\n标题内容\n\n正文内容"

        if self.provider == 'claude':
            result = self._call_claude(prompt)
        else:
            result = self._call_openai(prompt)

        import re

        # 清理可能的markdown标记
        result = re.sub(r'^```.*?\n', '', result.strip())
        result = re.sub(r'\n```$', '', result.strip())

        # 按双换行符分割标题和内容
        parts = result.strip().split('\n\n', 1)
        if len(parts) == 2:
            return {'title': parts[0].strip(), 'content': parts[1].strip()}
        else:
            # 如果没有双换行，按第一行作为标题
            lines = result.strip().split('\n', 1)
            return {'title': lines[0].strip() if lines else '未命名文档', 'content': lines[1].strip() if len(lines) > 1 else result}

    def refine_content(self, prompt):
        """根据用户反馈修改内容"""
        if self.provider == 'claude':
            return self._call_claude(prompt)
        else:
            return self._call_openai(prompt)

    def _build_prompt(self, doc_type, recipient, content):
        """构建针对不同公文类型的 prompt"""
        prompts = {
            'notice': f"""你是资深公文写作专家，精通 GB/T 9704-2012 标准。

任务：将自然语言转换为规范的通知正文。

主送机关：{recipient}
用户内容：{content}

【公文语言规范】
开头常用语：
- "根据...精神/要求"
- "为...，经研究决定"
- "现将...通知如下"

主体表述：
- 使用"一、二、三"序号
- 每个要点独立成段，段落间用双换行符分隔
- 时间地点等要素明确具体

结尾用语：
- "特此通知"（或无特定结束语）

语言特点：
- 准确、简洁、庄重
- 避免口语化（"搞""弄""挺好"）
- 使用规范书面语（"开展""实施""落实"）

【输出要求】
1. 段落间用双换行符分隔
2. 使用规范序号（一、二、三）
3. 不要添加缩进空格（系统自动处理）
4. 结尾必须有规范结束语

【示例结构】
根据XX文件精神，为做好XX工作，现将有关事项通知如下：

一、会议时间和地点
XX年XX月XX日上午9:00，在XX会议室召开。

二、参会人员
各部门负责人及相关工作人员。

三、有关要求
请各单位高度重视，按时参加。

特此通知

直接输出正文，不要添加标题、主送机关、落款。""",

            'letter': f"""你是资深公文写作专家，精通 GB/T 9704-2012 标准。

任务：将自然语言转换为规范的函正文。

主送机关：{recipient}
用户内容：{content}

【公文语言规范】
开头常用语：
- "收悉""接函""来函收悉"
- "根据工作需要"
- "为...，现函告如下"

主体表述：
- 平等、诚恳的语气
- 事项阐述清晰具体
- 可使用序号组织（一、二、三）

结尾用语：
- "请予支持为盼"
- "请予函复为荷"
- "特此函告"

语言特点：
- 平等协商的语气
- 简洁明了
- 避免命令式表达

【输出要求】
段落间用双换行符分隔，不要添加缩进空格。

直接输出正文，不要添加标题、主送机关、落款。""",

            'request': f"""你是资深公文写作专家，精通 GB/T 9704-2012 标准。

任务：将自然语言转换为规范的请示正文。

主送机关：{recipient}
用户内容：{content}

【公文语言规范】
开头常用语：
- "根据...规定"
- "为...，现请示如下"
- "鉴于..."

主体表述：
- 一文一事原则
- 理由充分，政策依据明确
- 恭敬、诚恳的语气
- 使用序号组织（一、二、三）

结尾用语（必须）：
- "妥否，请批示"
- "当否，请批示"
- "以上请示，请予批准"

语言特点：
- 恭敬、诚恳
- 理由充分
- 请求明确

【输出要求】
段落间用双换行符分隔，结尾必须有请示用语。

直接输出正文，不要添加标题、主送机关、落款。""",

            'report': f"""你是资深公文写作专家，精通 GB/T 9704-2012 标准。

任务：将自然语言转换为规范的报告正文。

主送机关：{recipient}
用户内容：{content}

【公文语言规范】
开头常用语：
- "根据...要求"
- "现将...报告如下"
- "按照...部署"

主体表述：
- 工作情况汇报详实
- 问题分析深入
- 下一步计划具体可行
- 使用序号组织（一、二、三）

结尾用语（必须）：
- "特此报告"

语言特点：
- 客观、准确
- 数据详实
- 分析深入

【输出要求】
段落间用双换行符分隔，结尾必须是"特此报告"。

直接输出正文，不要添加标题、主送机关、落款。"""
        }

        return prompts.get(doc_type, prompts['notice'])

    def _call_claude(self, prompt):
        """调用 Claude API"""
        message = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text

    def _call_openai(self, prompt):
        """调用 OpenAI API"""
        model_map = {
            'openai': 'gpt-4',
            'doubao': 'ep-20241211140351-xqxfh',
            'glm': 'glm-4'
        }
        model = model_map.get(self.provider, 'gpt-4')

        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        return response.choices[0].message.content
