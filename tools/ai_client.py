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

        # 统一添加行文规范
        prompt += """

【行文规范】
根据主送机关判断层级（省>市>区县），用恰当语气。称谓：主送用"贵X"、发文用"我X"，自然融入正文，勿写"贵委："格式。"""

        # 如果有附件，添加附件信息
        if attachments and len(attachments) > 0:
            prompt += f"\n\n附件{len(attachments)}个："
            for i, att in enumerate(attachments):
                prompt += f"\n{i+1}.{att}"
            prompt += "\n正文中自然插入'（见附件X）'，位置在相关句末或段末。"

        prompt += f"\n\n请根据上述内容拟定规范的{doc_type_names.get(doc_type, '公文')}标题。\n\n请按以下格式输出（第一行是标题，第二行空行，第三行开始是正文）：\n标题内容\n\n正文内容"

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
            'notice': f"""资深公文写作专家，精通GB/T 9704-2012。

任务：将"{content}"转为规范通知正文（主送：{recipient}）

【行文规范】
根据"{recipient}"判断层级（省>市>区县），用恰当语气。称谓：主送用"贵X"、发文用"我X"，自然融入正文，勿写"贵委："格式。

【语言要求】
开头："根据...精神""现将...通知如下"
主体：用"一、二、三"序号，段落间双换行
结尾："特此通知"
避免口语化，用规范书面语

直接输出正文，勿含标题、主送机关、落款。""",

            'letter': f"""资深公文写作专家，精通GB/T 9704-2012。

任务：将"{content}"转为规范函正文（主送：{recipient}）

【行文规范】
根据"{recipient}"判断层级，用恰当语气。称谓：主送用"贵X"、发文用"我X"，自然融入正文，勿写"贵委："格式。

【语言要求】
开头："收悉""根据工作需要""现函告如下"
结尾：对上级"恳请支持为盼"、对平级"请予支持为盼"、对下级"请予配合"
语气平等诚恳，段落间双换行

直接输出正文，勿含标题、主送机关、落款。""",

            'request': f"""资深公文写作专家，精通GB/T 9704-2012。

任务：将"{content}"转为规范请示正文（主送：{recipient}）

【行文规范】
请示用于下级向上级，必须恭敬诚恳。称谓：主送用"贵X"、发文用"我X"，自然融入正文，勿写"贵委："格式。

【语言要求】
开头："根据...规定""现请示如下"
主体：一文一事，理由充分，用"一、二、三"序号
结尾："妥否，请批示"或"当否，请批示"（必须）
段落间双换行

直接输出正文，勿含标题、主送机关、落款。""",

            'report': f"""资深公文写作专家，精通GB/T 9704-2012。

任务：将"{content}"转为规范报告正文（主送：{recipient}）

【行文规范】
报告用于下级向上级汇报，语气客观恭敬。称谓：主送用"贵X"、发文用"我X"，自然融入正文，勿写"贵委："格式。

【语言要求】
开头："根据...要求""现将...报告如下"
主体：情况详实，分析深入，用"一、二、三"序号
结尾："特此报告"（必须）
段落间双换行

直接输出正文，勿含标题、主送机关、落款。"""
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

    def generate_with_imitation(self, doc_type, recipient, content, title, issuer, date, attachments, reference_analysis, imitation_strength):
        """基于参考风格生成公文"""
        doc_type_names = {
            'notice': '通知',
            'letter': '函',
            'request': '请示',
            'report': '报告'
        }

        strength_desc = {
            'strict': '严格：高度贴合参考风格，保持相似的句式和用词习惯',
            'moderate': '适中：学习核心特征，但允许自然变化',
            'loose': '宽松：仅参考整体风格，具体表达灵活处理'
        }

        prompt = f"""你是一位资深公文写作专家。请根据以下参考风格特征，生成一份新的{doc_type_names.get(doc_type, '公文')}。

【风格特征】（从参考公文中学习）
- 语气：{reference_analysis.get('tone', '正式规范')}
- 结构：{reference_analysis.get('structure', '层次清晰')}
- 用词：{reference_analysis.get('vocabulary', '书面语为主')}
- 句式：{reference_analysis.get('sentenceStyle', '句式规范')}
- 逻辑：{reference_analysis.get('logicFlow', '逻辑严密')}

【仿写强度】：{imitation_strength}
{strength_desc.get(imitation_strength, '')}

【新公文信息】
主送机关：{recipient}
主要内容：{content}

**关键约束**：
1. 只学习风格特征，不复制具体内容、事实、数据
2. 标题、发文机关、日期等由系统填充，正文中不要提及
3. 不要生硬套用参考语句，保持逻辑自洽

【行文规范】
根据"{recipient}"判断层级（省/市/区县、委/厅/局/办），用恰当语气。称谓：主送用"贵X"、发文用"我X"，自然融入正文。
主送机关已由系统单独显示，正文直接从内容开始，勿写"贵委："这样的格式。"""

        if attachments and len(attachments) > 0:
            prompt += f"\n\n附件{len(attachments)}个："
            for i, att in enumerate(attachments):
                prompt += f"\n{i+1}.{att}"
            prompt += "\n正文中自然插入'（见附件X）'，位置在相关句末或段末。"

        prompt += f"""

请生成符合GB/T 9704-2012标准的规范公文正文，体现参考风格。段落间用双换行符分隔。

{"请根据内容拟定标题。" if not title else f"标题：{title}"}

请按以下格式输出（第一行是标题，第二行空行，第三行开始是正文）：
标题内容

正文内容"""

        if self.provider == 'claude':
            result = self._call_claude(prompt)
        else:
            result = self._call_openai(prompt)

        import re
        result = re.sub(r'^```.*?\n', '', result.strip())
        result = re.sub(r'\n```$', '', result.strip())

        parts = result.strip().split('\n\n', 1)
        if len(parts) == 2:
            return {'title': parts[0].strip(), 'content': parts[1].strip()}
        else:
            lines = result.strip().split('\n', 1)
            return {'title': lines[0].strip() if lines else '未命名文档', 'content': lines[1].strip() if len(lines) > 1 else result}
