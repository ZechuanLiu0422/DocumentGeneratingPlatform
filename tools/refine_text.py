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

【重要】你只需要输出修改后的选中部分，不要添加其他内容（如标题、主送机关、落款等）。

文档类型：{args.doc_type}
主送机关：{args.recipient}

用户选中的内容：
{args.original}

用户修改意见：
{args.feedback}

请根据用户的修改意见，对选中内容进行调整。保持公文的规范性和专业性。

【输出要求】
1. 只输出修改后的选中部分
2. 不要添加标题、主送机关、落款等其他内容
3. 不要添加任何解释说明
4. 保持原有的段落结构和格式"""

    try:
        client = AIClient(args.provider, args.api_key)
        refined = client.refine_content(prompt)
        print(json.dumps({'success': True, 'refined_content': refined}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()
