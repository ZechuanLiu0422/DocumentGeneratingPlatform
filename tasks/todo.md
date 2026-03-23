# TODO

- [x] 梳理“保存草稿”和“AI 生成”对应的页面、接口与共享依赖，定位共同故障点
- [x] 实施最小修复，避免继续返回“系统繁忙，请稍后重试”
- [x] 运行验证并记录结果
- [x] 复现“结构共创/提纲生成”最新报错并定位触发链路
- [x] 修复运行时报错，确保新 `planning` 流程与旧快捷路径都可用
- [x] 重新验证本地 dev 流程并补充 review 记录

## Review

- Root cause: 协作写作版本引入了 `drafts` 新字段、`writing_rules / reference_assets / document_versions` 新表，以及 `usage_events` 新 action 约束；但 README、部署清单和 `check:deploy` 仍只要求首个 migration，容易导致数据库未升级时“保存草稿”和“AI 生成”同时失败。
- Code change: 为后端统一错误处理增加 schema mismatch 识别，遇到缺列、缺表、旧约束等典型异常时，返回“请执行最新 Supabase migrations”的明确提示，而不是笼统的“系统繁忙”。
- Guardrail: `scripts/check-deploy.mjs` 现在会列出仓库内全部 migration，并明确要求按顺序全部执行。
- Docs: README 与部署清单已同步更新为执行全部 migration，尤其是 `20260321110000_collaborative_writing_upgrade.sql`。
- Additional runtime fix: 当前出现的 `Cannot find module './948.js'` 是 `.next` 开发产物错位导致，旧 `webpack-runtime.js` 仍按 `.next/server/948.js` 加载，而实际 chunk 位于 `.next/server/chunks/948.js`。已将旧 `.next` 隔离为 `.next_stale_20260323_1`，并重建干净产物。
- Outline planning upgrade: 新增“结构共创”阶段，AI 会先给出 3 种差异明显的结构建议，用户选定后可继续调段数、顺序和每段主题，再生成正式提纲。
- Data model/API: `drafts` 新增 `planning` 持久化字段，工作流阶段新增 `planning`，新增 `/api/ai/outline-plan`，并让 `/api/ai/outline` 支持基于已确认结构生成正式提纲。
- Frontend flow: 生成页步骤栏扩展为 5 步，新增结构建议卡片、方案选择、段落顺序调整、新增/删除段落和“基于该结构生成正式提纲”入口，同时保留“直接生成提纲”快捷路径。
- Latest runtime fix: 结构共创现在允许“保存编辑中的未完成段落”，但在“生成正式提纲”前会先校验每一段是否补全；同时前端把结构共创段数限制为最多 8 段，避免用户新增空白段或超上限时直接打到后端报错。
- Backend guardrail: `/api/ai/outline` 不再盲目信任草稿里已有的 `planning.sections`；如果从历史草稿恢复到不完整结构，会返回明确的“请先补全结构段落”提示，而不是继续在后续工作流里隐式失败。
- Dev runtime fix: 本地 `next dev` 生成的 `.next/server/webpack-runtime.js` 会错误地按 `./<id>.js` 加载数字 chunk，但真实文件位于 `.next/server/chunks/<id>.js`。已新增 [scripts/run-next-dev.mjs](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/scripts/run-next-dev.mjs)，在 `npm run dev` 启动后自动修补 runtime，使数字 chunk 走 `chunks/<id>.js`，避免再次出现 `Cannot find module './682.js'` / `./948.js`。
- Planning UX simplification: 结构共创卡片默认只保留“段落标题 / 本段内容”两个主编辑项，`purpose / orderReason` 改为“AI 结构说明”折叠区中的只读信息，不再让用户在主流程里维护结构解释字段。
- Planning normalization: `/api/ai/outline` 现在只要求确认结构时提供 `headingDraft / topicSummary`，并在正式提纲生成前统一自动补齐/重写 `purpose / orderReason`，避免旧解释字段与用户调整后的结构脱节。
- Verification:
- `npm run check:deploy`
- `npm run build`
- 启动全新 `npm run dev` 后，访问 `/generate` 不再出现 `Cannot find module './948.js'`，而是正常进入登录重定向流程
- `npm run build`（结构共创方案上线后再次验证通过）
- `npm run build`（补上结构共创本地校验、草稿宽松保存与 outline 路由兜底校验后再次通过）
- `npm run dev`（通过新启动脚本自动修补 `.next/server/webpack-runtime.js` 的 chunk 路径）
- `curl -i http://127.0.0.1:3003/login` 返回 `200 OK`
- `curl -I http://127.0.0.1:3003/does-not-exist` 返回登录重定向 `307`，未再触发 `_not-found/page` 的 chunk 缺失报错
- `npm run build`（结构共创轻量化改版后再次通过）
