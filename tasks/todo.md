# TODO

- [x] Fetch upstream install instructions and confirm required local paths
- [x] Install `obra/superpowers` into `~/.codex/superpowers`
- [x] Symlink repo skills into `~/.agents/skills/superpowers`
- [x] Verify the symlink target and record review notes

- [x] 消除 `/generate` 对 `next/navigation` hook 的依赖，规避运行时 `useContext` 空指针
- [x] 运行构建验证并补充 review 记录

- [x] 增加“重新生成正文”入口，复用 full draft 生成链路覆盖当前整稿
- [x] 在分段成文/定稿检查阶段补充确认交互，避免误触覆盖正文
- [x] 运行构建验证并补充 review 记录

- [x] 修复 dev 启动脚本的 `.next` 隔离与 `--port` 参数透传，降低 `webpack-runtime` 首次请求竞态
- [x] 静态检查启动脚本与 runtime 修补逻辑，并记录当前环境下的验证边界

- [x] 重构正文生成输入，改为基于 section brief 成文，避免把提纲解释文本直接喂给模型
- [x] 为 full draft / section rewrite 增加质量闸门、一次自动修复式重试，以及明确失败错误码
- [x] 移除提纲式正文兜底逻辑，确保生成失败时不污染草稿和版本快照
- [x] 为不同 AI 任务配置差异化 token 上限
- [x] 运行构建验证并补充 review 记录

- [x] 梳理“保存草稿”和“AI 生成”对应的页面、接口与共享依赖，定位共同故障点
- [x] 实施最小修复，避免继续返回“系统繁忙，请稍后重试”
- [x] 运行验证并记录结果
- [x] 复现“结构共创/提纲生成”最新报错并定位触发链路
- [x] 修复运行时报错，确保新 `planning` 流程与旧快捷路径都可用
- [x] 重新验证本地 dev 流程并补充 review 记录

## Review

- Install source: `https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md`
- Expected setup from upstream instructions:
- clone `https://github.com/obra/superpowers.git` to `~/.codex/superpowers`
- create symlink from `~/.agents/skills/superpowers` to `~/.codex/superpowers/skills`
- verify the symlink resolves correctly
- Result: cloned repo to `/Users/agent/.codex/superpowers`, created `/Users/agent/.agents/skills/superpowers` symlink, and verified `readlink` resolves to `/Users/agent/.codex/superpowers/skills`

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
- Draft generation root cause: “分段成文”原先直接把完整 outline JSON 喂给模型，且在模型输出截断/解析失败时静默退回 `purpose + keyPoints` 拼正文，导致提纲说明混入正文、正文像提纲扩写。
- Prompt/input refactor: 正文生成与单段重写现在统一改为基于 section brief 成文，只暴露 `id / heading / mustCover / writingTask` 作为写作约束，不再把完整提纲解释文本直接提供给模型复述。
- Quality gate: full draft 和 section rewrite 都新增结构一致性、正文长度、句群完整度、提纲目的复述、关键要点照抄等校验；首次不合格会自动带着问题清单重试 1 次，仍失败则返回明确错误码 `DRAFT_GENERATION_INVALID / SECTION_GENERATION_INVALID`。
- Failure semantics: 已移除 `purpose + keyPoints` 的正文兜底，以及 `normalizeDraftSections` 用 `outline.purpose` 填空正文的逻辑；生成失败时不会保存 `sections / generated_content`，也不会创建错误版本快照。
- Token budget: `callModel` 现在支持按任务传入 `maxTokens`，并为 intake / outline / planning / draft / section rewrite / revise / review 分别配置了不同预算，优先降低多段正文 JSON 被截断的概率。
- Dev startup regression: 用户再次报告 `Cannot find module './948.js'` 时，仓库内 `.next/server/webpack-runtime.js` 实际已被修补为 `chunks/948.js`，说明问题不再是“补丁缺失”，而是 `next dev` 首次产物与首个请求之间存在竞态，同时启动脚本未隔离旧 `.next`，也没有透传 `--port` 参数。
- Dev script fix: [scripts/run-next-dev.mjs](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/scripts/run-next-dev.mjs) 现在会在启动前自动把已有 `.next` 重命名为 `.next_stale_<timestamp>`，避免 `next build` 与 `next dev` 共用缓存；同时改为转发 CLI 参数并默认绑定 `127.0.0.1`，和 `start.command` 的动态端口逻辑保持一致。
- Draft UX addition: 在 [app/generate/page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) 为“分段成文”和“定稿检查”阶段新增“重新生成正文”按钮，直接复用现有 full draft 接口，让用户无需先清空正文也能按当前提纲整稿重生成。
- Safety guard: 当当前已有正文时，“重新生成正文”会先弹出确认框，明确告知会覆盖现有整稿内容；触发时会先清空当前定稿检查结果，避免旧 review 状态误导用户。
- Generate page runtime fix: 针对用户再次反馈的 `Cannot read properties of null (reading 'useContext')`，已将 [app/generate/page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) 从 `useRouter / useSearchParams / Suspense` 方案改为浏览器原生导航和 `window.location.search` 读取草稿 id，避免该页面在运行时依赖 app router context。
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
- `npm run build`（正文生成改为 brief 驱动、增加质量闸门与 token 分级后再次通过）
- 静态检查 [scripts/run-next-dev.mjs](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/scripts/run-next-dev.mjs) 与当前 [.next/server/webpack-runtime.js](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.next/server/webpack-runtime.js)，确认 runtime 目标路径已是 `chunks/<id>.js`
- `PORT=3003 npm run dev -- --port 3003` 在当前沙箱环境下因 `listen EPERM` 无法完成端口监听，说明此处无法做真正的本地 dev 端到端验证；脚本级修复已完成，但仍需你在本机正常终端再跑一次 `npm run dev`
- `npm run build`（新增“重新生成正文”入口与覆盖确认后再次通过）
- `npm run build`（`/generate` 去掉 `next/navigation` hook 依赖后再次通过）
