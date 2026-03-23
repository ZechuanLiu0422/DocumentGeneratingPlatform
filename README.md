# DocumentGeneratingPlatform

基于 `Next.js 14 + Supabase + Vercel` 的智能公文生成平台，支持通知、函、请示、报告四类公文的 AI 生成、仿写分析、草稿管理、历史记录与 Word 导出。

## 当前架构

- 前端：Next.js App Router + React + Tailwind CSS
- 认证：Supabase Auth
- 数据库：Supabase Postgres + RLS
- AI：平台统一管理 Claude / OpenAI / 豆包 / GLM 密钥
- 导出：Node.js 侧内存生成 Word 文档
- 部署：Vercel

## 主要变化

- 不再使用本地 SQLite
- 不再使用 NextAuth
- 不再使用 Python 子进程处理 AI、上传解析和 Word 导出
- 用户不再自行保存 API Key，所有 AI Key 只保存在服务端环境变量

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

CLAUDE_API_KEY=...
CLAUDE_MODEL=claude-3-5-sonnet-latest

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

可选 provider：

```bash
DOUBAO_API_KEY=...
DOUBAO_MODEL=...
GLM_API_KEY=...
GLM_MODEL=glm-4-flash
```

### 3. 初始化 Supabase

在 Supabase SQL Editor 或 Supabase CLI 中，按文件名顺序执行 `supabase/migrations/` 下的全部 SQL：

```sql
supabase/migrations/20260320120000_initial_schema.sql
supabase/migrations/20260321110000_collaborative_writing_upgrade.sql
```

第一份 migration 会创建：

- `profiles`
- `documents`
- `drafts`
- `contacts`
- `common_phrases`
- `usage_events`

并自动启用 RLS。

第二份 migration 会补齐协作写作能力所需结构：

- `drafts.workflow_stage / collected_facts / missing_fields / outline / sections`
- `drafts.active_rule_ids / active_reference_ids / version_count`
- `drafts.generated_title / generated_content`
- `writing_rules`
- `reference_assets`
- `document_versions`
- `usage_events` 中新增 `intake / outline / draft / review` 动作约束

两份 migration 都执行后，草稿保存、AI 采集/提纲/正文/审校、版本恢复等功能才会正常工作。

如果你打算使用 Supabase CLI，本仓库已提供基础配置：

```bash
supabase/config.toml
```

### 4. 创建测试账号

本项目首版默认使用“管理员邀请 / 手动开通”模式。

你可以在 Supabase Dashboard 中：

1. 进入 `Authentication > Users`
2. 手动创建用户，或发送邀请
3. 用该邮箱和密码登录系统

### 5. 启动项目

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

也可以直接双击：

- macOS: `start.command`
- Windows: `start.bat`

### 6. 本地部署检查

```bash
npm run check:deploy
```

这个脚本会检查：

- `.env` 是否存在
- Supabase 关键环境变量是否已填写
- 是否至少启用了一个平台 AI Provider
- migration 文件是否存在
- 会列出当前仓库中的全部 migration，提醒你逐个执行

### 7. 管理员创建用户

如果你想通过命令行快速创建首批账号：

```bash
npm run invite:user -- user@example.com ZhangSan Temp#123456
```

如果不传显示名和临时密码，脚本会自动生成。
通过该脚本创建的账号会默认开启 `must_change_password`，首次登录后会被强制跳转到修改密码页。

## Vercel 部署

### 1. 导入项目到 Vercel

将仓库连接到 Vercel。

### 2. 配置环境变量

在 Vercel Project Settings 中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLAUDE_API_KEY`
- `CLAUDE_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- 可选的 `DOUBAO_API_KEY` / `DOUBAO_MODEL`
- 可选的 `GLM_API_KEY` / `GLM_MODEL`

### 3. 配置 Supabase

- 按顺序执行 `supabase/migrations/*.sql`
- 在 `Authentication` 中创建或邀请首批用户
- 检查 RLS 策略是否生效

### 4. 预发布检查

- 受保护页面未登录时会跳转 `/login`
- 首次登录且带临时密码的用户会被强制跳转 `/change-password`
- 登录成功后可访问首页、生成页、设置页、历史页
- 草稿、联系人、常用短语、历史记录都按用户隔离
- 参考文件上传限制、AI 调用限流和日额度生效
- 前端与 API 不返回任何 AI Key 明文
- `/api/health` 可用于部署后基础健康检查

更完整清单见：

- [DEPLOYMENT_CHECKLIST.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/DEPLOYMENT_CHECKLIST.md)

## 安全与稳定性基线

已实现：

- Supabase Auth 取代本地账号体系
- 业务数据按 `user_id` 启用 RLS
- 高成本接口增加频率限制和日额度限制
- 所有关键 API 增加 `zod` 入参校验
- 统一错误脱敏与结构化日志
- 上传文件类型、大小、内容长度、PDF 页数限制
- 平台统一 AI Key，不落库、不回显、不传前端

## 目录说明

- `app/api/*`: 业务 API
- `lib/supabase/*`: Supabase SSR 客户端与中间件
- `lib/official-document-ai.ts`: AI 提示词与多 provider 调用
- `lib/document-generator.ts`: Word 导出
- `lib/file-parser.ts`: `.docx/.pdf/.txt` 内容解析
- `supabase/migrations/*`: 数据库初始化 SQL

## 后续可选增强

- 接入 Supabase Storage 保存历史导出文件
- 增加管理员后台与邀请流程页面
- 增加更强的审计日志与外部监控
- 增加密码重置与首次登录引导
