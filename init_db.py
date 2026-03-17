#!/usr/bin/env python3
"""
Database initialization script for sql.js compatibility
"""
import sqlite3
import sys
import bcrypt
import os

def init_db():
    db_path = 'data/documents.db'
    os.makedirs('data', exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

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

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            api_key TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, provider)
        )
    ''')

    conn.commit()
    conn.close()
    print('✓ 数据库初始化完成')

def create_user(username, password):
    db_path = 'data/documents.db'

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, password_hash))
        conn.commit()
        print(f'✓ 用户 \'{username}\' 创建成功')
    except sqlite3.IntegrityError:
        print(f'✗ 用户 \'{username}\' 已存在')
    finally:
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == '--init':
            init_db()
        elif sys.argv[1] == '--create-user' and len(sys.argv) == 4:
            create_user(sys.argv[2], sys.argv[3])
        else:
            print('用法: python3 init_db.py --init')
            print('      python3 init_db.py --create-user <username> <password>')
    else:
        print('用法: python3 init_db.py --init')
        print('      python3 init_db.py --create-user <username> <password>')
