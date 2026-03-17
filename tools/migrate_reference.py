#!/usr/bin/env python3
"""
数据库迁移脚本：添加仿写模式相关表和字段
"""
import sqlite3
import os

DATABASE_PATH = os.getenv('DATABASE_PATH', './data/documents.db')

def migrate():
    """执行数据库迁移"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    try:
        # 创建 reference_documents 表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reference_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                doc_type TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                analysis TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        print("✓ 创建 reference_documents 表")
    except sqlite3.OperationalError as e:
        if 'already exists' in str(e):
            print("- reference_documents 表已存在")
        else:
            raise

    try:
        # 为 drafts 表添加 reference_id 列
        cursor.execute('ALTER TABLE drafts ADD COLUMN reference_id INTEGER')
        print("✓ 添加 drafts.reference_id 列")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print("- drafts.reference_id 列已存在")
        else:
            raise

    try:
        # 为 drafts 表添加 imitation_strength 列
        cursor.execute("ALTER TABLE drafts ADD COLUMN imitation_strength TEXT DEFAULT 'moderate'")
        print("✓ 添加 drafts.imitation_strength 列")
    except sqlite3.OperationalError as e:
        if 'duplicate column name' in str(e):
            print("- drafts.imitation_strength 列已存在")
        else:
            raise

    conn.commit()
    conn.close()
    print("\n✓ 数据库迁移完成")

if __name__ == '__main__':
    migrate()
