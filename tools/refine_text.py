#!/usr/bin/env python3
import argparse
import json
import sys
from ai_client import AIClient

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--doc-type', required=True)
    parser.add_argument('--recipient', required=True)
    parser.add_argument('--original', required=True)
    parser.add_argument('--feedback', required=True)
    parser.add_argument('--provider', required=True)
    parser.add_argument('--api-key', required=True)
    args = parser.parse_args()

    prompt = f"""你是一位资深的公文写作专家。用户选中了公文的某个部分并提出了修改意见。

【分析用户意图】
首先判断用户想要什么类型的修改：
- 语气调整（更正式/更亲切/更严肃）
- 内容扩充（增加细节/论据/例子）
- 内容精简（删减冗余/提炼要点）
- 格式调整（段落结构/条目化/合并）
- 纠错（语法/用词/逻辑）
- 重写（完全改写表达方式）

文档类型：{args.doc_type}
主送机关：{args.recipient}

用户选中的内容：
{args.original}

用户修改意见：
{args.feedback}

【输出要求】
1. 只输出修改后的选中部分
2. 不要添加标题、主送机关、落款等其他内容
3. 不要添加任何解释说明
4. 根据识别的意图进行针对性修改
5. 保持公文的规范性和专业性"""

    try:
        client = AIClient(args.provider, args.api_key)
        refined = client.refine_content(prompt)
        print(json.dumps({'success': True, 'refined_content': refined}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()
