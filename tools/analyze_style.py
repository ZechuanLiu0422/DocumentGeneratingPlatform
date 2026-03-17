#!/usr/bin/env python3
"""
公文风格分析工具
"""
import sys
import json
import argparse
from ai_client import AIClient

DOC_TYPE_NAMES = {
    'notice': '通知',
    'letter': '函',
    'request': '请示',
    'report': '报告'
}

ANALYSIS_PROMPT = """你是一位资深公文写作专家。请深度分析以下{doc_type}的**正文写作风格**。

【参考公文】
{reference_content}

**重要说明**：
- 忽略标题、发文机关、日期、落款、附件等元数据
- 只分析正文部分的写作风格特征
- 不要记录具体的内容、数据或事实

请从以下维度分析**正文风格**：
1. **语气特点**：正式程度、情感色彩、权威性表达
2. **结构特点**：段落组织、逻辑顺序、层次划分方式
3. **用词风格**：词汇类型、修饰手法、表达习惯
4. **句式特点**：句子长度、复杂度、节奏感
5. **逻辑流程**：论证方式、因果关系、递进层次

请用简洁的语言总结每个维度的特点（每项1-2句话）。

请严格按照以下JSON格式输出：
{{
  "tone": "语气特点描述",
  "structure": "结构特点描述",
  "vocabulary": "用词风格描述",
  "sentenceStyle": "句式特点描述",
  "logicFlow": "逻辑流程描述"
}}
"""

def analyze_style(doc_type: str, content: str, provider: str, api_key: str) -> dict:
    """分析公文风格特征"""
    client = AIClient(provider=provider, api_key=api_key)

    prompt = ANALYSIS_PROMPT.format(
        doc_type=DOC_TYPE_NAMES.get(doc_type, '公文'),
        reference_content=content
    )

    response = client.refine_content(prompt)

    # 尝试解析JSON
    try:
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            raise ValueError("无法从响应中提取JSON")
    except:
        # 如果解析失败，返回默认结构
        analysis = {
            "tone": "正式、规范",
            "structure": "层次清晰",
            "vocabulary": "书面语为主",
            "sentenceStyle": "句式规范",
            "logicFlow": "逻辑严密"
        }

    return analysis

def main():
    parser = argparse.ArgumentParser(description='分析公文风格')
    parser.add_argument('--doc-type', required=True, help='文档类型')
    parser.add_argument('--content', required=True, help='参考公文内容')
    parser.add_argument('--provider', required=True, help='AI提供商')
    parser.add_argument('--api-key', required=True, help='API密钥')
    args = parser.parse_args()

    try:
        analysis = analyze_style(args.doc_type, args.content, args.provider, args.api_key)

        result = {
            'success': True,
            'analysis': analysis
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()
