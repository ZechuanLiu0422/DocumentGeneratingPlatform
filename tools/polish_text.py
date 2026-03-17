#!/usr/bin/env python3
"""
AI 润色工具 - 命令行接口
"""
import sys
import json
import argparse
from ai_client import AIClient

def main():
    parser = argparse.ArgumentParser(description='AI 公文润色工具')
    parser.add_argument('--doc-type', required=True, help='文档类型 (notice/letter/request/report)')
    parser.add_argument('--recipient', required=True, help='主送机关')
    parser.add_argument('--content', required=True, help='用户输入的内容')
    parser.add_argument('--provider', default='claude', help='AI 提供商 (claude/openai/doubao/glm)')
    parser.add_argument('--api-key', required=True, help='API Key')
    parser.add_argument('--title', default='', help='文档标题（可选）')
    parser.add_argument('--attachments', default='[]', help='附件列表（JSON格式）')

    args = parser.parse_args()

    try:
        client = AIClient(provider=args.provider, api_key=args.api_key)

        # 解析附件
        attachments = json.loads(args.attachments) if args.attachments else []

        if not args.title:
            generated_content = client.generate_document_with_title(
                doc_type=args.doc_type,
                recipient=args.recipient,
                content=args.content,
                attachments=attachments
            )
            result = {
                'success': True,
                'generated_content': generated_content['content'],
                'generated_title': generated_content['title']
            }
        else:
            generated_content = client.generate_document(
                doc_type=args.doc_type,
                recipient=args.recipient,
                content=args.content
            )
            result = {
                'success': True,
                'generated_content': generated_content
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
