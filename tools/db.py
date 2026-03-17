#!/usr/bin/env python3
"""
数据库初始化和操作脚本
"""
import sqlite3
import os
import sys
import hashlib
from datetime import datetime

DATABASE_PATH = os.getenv('DATABASE_PATH', './data/documents.db')

def get_connection():
    """获取数据库连接"""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """初始化数据库表结构"""
    conn = get_connection()
    cursor = conn.cursor()

    # 创建 users 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 创建 documents 表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            doc_type TEXT NOT NULL,
            title TEXT NOT NULL,
            recipient TEXT NOT NULL,
            user_input TEXT NOT NULL,
            generated_content TEXT NOT NULL,
            ai_provider TEXT NOT NULL,
            issuer TEXT NOT NULL,
            doc_date TEXT NOT NULL,
            file_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # 创建 ai_configs 表（可选）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            api_key TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, provider)
        )
    ''')

    # 创建 common_phrases 表（常用信息）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS common_phrases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            phrase TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # 创建 drafts 表（草稿）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            doc_type TEXT NOT NULL,
            title TEXT,
            recipient TEXT,
            content TEXT,
            issuer TEXT,
            date TEXT,
            provider TEXT DEFAULT 'claude',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()
    print("✓ 数据库初始化完成")

def hash_password(password):
    """密码哈希"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_user(username, password, display_name=None):
    """创建用户"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        password_hash = hash_password(password)
        cursor.execute(
            'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
            (username, password_hash, display_name or username)
        )
        conn.commit()
        print(f"✓ 用户 '{username}' 创建成功")
    except sqlite3.IntegrityError:
        print(f"✗ 用户 '{username}' 已存在")
    finally:
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == '--init':
            init_database()
        elif command == '--create-user' and len(sys.argv) >= 4:
            username = sys.argv[2]
            password = sys.argv[3]
            display_name = sys.argv[4] if len(sys.argv) > 4 else None
            create_user(username, password, display_name)
        else:
            print("用法:")
            print("  python3 tools/db.py --init")
            print("  python3 tools/db.py --create-user <username> <password> [display_name]")
    else:
        print("用法:")
        print("  python3 tools/db.py --init")
        print("  python3 tools/db.py --create-user <username> <password> [display_name]")
