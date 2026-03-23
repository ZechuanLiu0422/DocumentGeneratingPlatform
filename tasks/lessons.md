# Lessons

- Next.js 如果报 `Cannot find module './<id>.js'` 且堆栈指向 `.next/server/webpack-runtime.js`，先检查 `webpack-runtime.js` 的 chunk 引用路径是否和 `.next/server/chunks/` 实际布局一致，再决定是否需要隔离旧 `.next` 并重建，不要先怀疑业务页面代码。
- 如果本地 `next dev` 生成的 `.next/server/webpack-runtime.js` 仍用 `./<id>.js` 加载数字 chunk，而实际文件位于 `.next/server/chunks/<id>.js`，应优先修正 dev 启动流程里的 runtime 路径，不要同时运行 `next build` 和 `next dev` 去共用同一个 `.next` 目录。
- 当用户在表单交互里要求“列表形式/一条条填写”时，优先实现真正的逐项输入控件，不要只把同一段文本换成列表预览。
