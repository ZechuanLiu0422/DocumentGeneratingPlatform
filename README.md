# 公文生成平台

基于 WAT 框架（Workflows, Agents, Tools）的智能公文生成系统。

## ✅ 项目已完成并可交付

所有核心功能已实现，系统可以正常使用。

## 功能特性

- **智能公文生成**：支持通知、函、请示、报告四种公文类型
- **AI 润色**：集成 Claude 和 OpenAI，自动将自然语言转换为规范公文格式
- **极简输入**：只需填写 5 个字段（标题、主送机关、内容、发文机关、日期）
- **国标格式**：严格遵循 GB/T 9704-2012《党政机关公文格式》标准
- **Word 导出**：自动生成符合规范的 Word 文档
- **历史记录**：保存所有生成的公文记录
- **用户认证**：基于 NextAuth.js 的安全登录系统

## 快速开始

### 1. 安装依赖

```bash
npm install
pip3 install -r requirements.txt
```

### 2. 配置环境变量

编辑 `.env` 文件，填入你的 API keys：

```bash
# AI API Keys（至少配置一个）
CLAUDE_API_KEY=your-claude-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here
```

### 3. 初始化数据库

```bash
python3 init_db.py --init
python3 init_db.py --create-user admin password123
```

### 4. 启动服务

```bash
npm run dev
```

访问 http://localhost:3000

## 使用说明

### 登录
- 用户名：admin
- 密码：password123

### 生成公文

1. 登录后选择公文类型（通知、函、请示、报告）
2. 填写 5 个必填字段：
   - **标题**：例如"关于召开年度总结会议的通知"
   - **主送机关**：例如"各部门、各单位"
   - **主要内容**：用自然语言描述完整内容，AI 会自动提取背景、事项、细节等信息
   - **发文机关**：例如"XX单位办公室"
   - **成文日期**：选择日期
3. 选择 AI 提供商（Claude 或 OpenAI）
4. 点击"生成公文"查看 AI 润色后的内容
5. 点击"下载 Word 文档"获取规范格式的文档

### 查看历史

点击"历史记录"可查看所有已生成的公文。

## 技术栈

- **前端**: Next.js 14 + React + Tailwind CSS
- **后端**: Next.js API Routes + Python Tools
- **数据库**: SQLite (sql.js)
- **AI**: Claude API / OpenAI API
- **文档生成**: python-docx
- **认证**: NextAuth.js

## 架构说明

```
用户界面 (React)
    ↓
Next.js API Routes (薄层路由)
    ↓
Python Tools (核心逻辑)
    ↓
[SQLite | AI APIs | Word 生成]
```

## 注意事项

1. **API Keys**：使用前必须配置至少一个 AI API key
2. **字体**：Word 文档使用方正小标宋和仿宋_GB2312
3. **生产部署**：修改 NEXTAUTH_SECRET 为随机字符串
