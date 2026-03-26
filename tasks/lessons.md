# Lessons

- If a phase plan changes data contracts or workflow behavior, lint-only `<verify>` steps are not enough; add executable behavioral checks that prove the contract works, not just that the files parse.
- If a roadmap requirement is broader than one route or file, give it its own plan or explicit task coverage instead of assuming nearby hardening work implicitly satisfies it.
- Next.js 如果报 `Cannot find module './<id>.js'` 且堆栈指向 `.next/server/webpack-runtime.js`，先检查 `webpack-runtime.js` 的 chunk 引用路径是否和 `.next/server/chunks/` 实际布局一致，再决定是否需要隔离旧 `.next` 并重建，不要先怀疑业务页面代码。
- 如果本地 `next dev` 生成的 `.next/server/webpack-runtime.js` 仍用 `./<id>.js` 加载数字 chunk，而实际文件位于 `.next/server/chunks/<id>.js`，应优先修正 dev 启动流程里的 runtime 路径，不要同时运行 `next build` 和 `next dev` 去共用同一个 `.next` 目录。
- 如果 runtime 文件最终已经被补丁改成 `chunks/<id>.js`，用户仍在启动早期撞到 `Cannot find module './<id>.js'`，优先怀疑 `next dev` 首次产物生成与首个请求之间的竞态；启动脚本应先隔离旧 `.next`，并尽早、高频修补 runtime，而不是只靠低频轮询。
- 开发启动脚本不能吞掉 `--port` 等透传参数，也不要硬编码 `0.0.0.0:3000`；应沿用调用方传入的端口，并默认使用更保守的本地 host，避免把端口/主机层面的问题误判成业务回归。
- 如果某个 app router 页面在运行时报 `Cannot read properties of null (reading 'useContext')`，而构建又能通过，优先检查该页是否依赖 `useRouter` / `useSearchParams` 等 `next/navigation` Hook；对纯交互页面，可改成浏览器导航和 `window.location.search` 读取，先把对路由上下文的硬依赖去掉。
- 当用户在表单交互里要求“列表形式/一条条填写”时，优先实现真正的逐项输入控件，不要只把同一段文本换成列表预览。
