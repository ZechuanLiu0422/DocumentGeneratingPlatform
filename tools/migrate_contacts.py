#!/usr/bin/env python3
"""
数据库迁移脚本：创建 contacts 表
"""
import sqlite3
import os

DATABASE_PATH = os.getenv('DATABASE_PATH', './data/documents.db')

def migrate():
    """执行数据库迁移"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        print("✓ 创建 contacts 表")
    except sqlite3.OperationalError as e:
        print(f"- contacts 表已存在或创建失败: {e}")

    conn.commit()
    conn.close()
    print("\n✓ 数据库迁移完成")

if __name__ == '__main__':
    migrate()
