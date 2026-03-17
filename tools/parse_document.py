#!/usr/bin/env python3
"""
文档解析工具：支持Word、PDF、TXT格式
"""
import sys
import json
import argparse
from docx import Document

def parse_docx(file_path: str) -> str:
    """解析Word文档"""
    doc = Document(file_path)
    return '\n'.join([p.text for p in doc.paragraphs if p.text.strip()])

def parse_txt(file_path: str) -> str:
    """解析文本文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

def parse_pdf(file_path: str) -> str:
    """解析PDF文档"""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
            return '\n'.join(text)
    except ImportError:
        return "错误：需要安装 pdfplumber 库 (pip install pdfplumber)"

def main():
    parser = argparse.ArgumentParser(description='解析文档文件')
    parser.add_argument('--file', required=True, help='文件路径')
    args = parser.parse_args()

    file_path = args.file
    ext = file_path.split('.')[-1].lower()

    try:
        if ext == 'docx':
            content = parse_docx(file_path)
        elif ext == 'pdf':
            content = parse_pdf(file_path)
        elif ext == 'txt':
            content = parse_txt(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

        result = {
            'success': True,
            'content': content,
            'wordCount': len(content)
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
