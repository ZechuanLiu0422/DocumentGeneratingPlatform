#!/usr/bin/env python3
"""
格式化工具函数
"""

def format_chinese_date(date_str):
    """将 2026-03-16 转换为 2026年3月16日"""
    try:
        year, month, day = date_str.split('-')
        month = str(int(month))
        day = str(int(day))
        return f"{year}年{month}月{day}日"
    except:
        return date_str
