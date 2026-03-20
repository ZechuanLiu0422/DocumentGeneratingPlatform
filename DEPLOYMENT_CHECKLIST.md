# Deployment Checklist

## Supabase

- 已创建 Supabase 项目
- 已执行 `supabase/migrations/20260320120000_initial_schema.sql`
- `Authentication > Users` 中已创建或邀请首批用户
- 已确认 `profiles / drafts / documents / contacts / common_phrases / usage_events` 表存在
- 已确认所有表均启用 RLS

## Vercel Env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- 至少一组 AI provider：
  - `CLAUDE_API_KEY` + `CLAUDE_MODEL`
  - 或 `OPENAI_API_KEY` + `OPENAI_MODEL`
  - 或 `DOUBAO_API_KEY` + `DOUBAO_MODEL`
  - 或 `GLM_API_KEY` + `GLM_MODEL`

## Local Validation

- 已执行 `npm install`
- 已执行 `npm run check:deploy`
- 已执行 `npm run build`

## Smoke Test

- 未登录访问 `/` 会跳转到 `/login`
- 可以用管理员创建的邮箱密码登录
- 首页可加载草稿列表
- 设置页可保存显示名称
- 可以新增/删除常用联系人和常用短语
- 生成页可正常选择平台 provider
- `.docx/.pdf/.txt` 上传与风格分析正常
- 可以生成正文、二次润色、下载 Word 文档
- 历史记录可查看

## Security Verification

- 前端与 API 响应中没有明文 AI Key
- 触发限流时返回 429
- 大文件、非法格式、过长文本会被拒绝
- Vercel Preview 与 Production 使用不同环境变量
