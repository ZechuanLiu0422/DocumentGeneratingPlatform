#!/usr/bin/env python3
"""
数据库迁移脚本：为 drafts 表添加 contactName, contactPhone, attachments 列
"""
import sqlite3
import os

DATABASE_PATH = os.getenv('DATABASE_PATH', './data/documents.db')

def migrate():
    """执行数据库迁移"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    try:
        # 添加 contactName 列
        cursor.execute('ALTER TABLE drafts ADD COLUMN contactName TEXT')
        print("✓ 添加 contactName 列")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print("- contactName 列已存在")
        else:
            raise

    try:
        # 添加 contactPhone 列
        cursor.execute('ALTER TABLE drafts ADD COLUMN contactPhone TEXT')
        print("✓ 添加 contactPhone 列")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print("- contactPhone 列已存在")
        else:
            raise

    try:
        # 添加 attachments 列
        cursor.execute('ALTER TABLE drafts ADD COLUMN attachments TEXT')
        print("✓ 添加 attachments 列")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print("- attachments 列已存在")
        else:
            raise

    conn.commit()
    conn.close()
    print("\n✓ 数据库迁移完成")

if __name__ == '__main__':
    migrate()
