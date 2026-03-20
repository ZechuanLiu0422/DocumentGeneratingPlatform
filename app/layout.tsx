import './globals.css';

export const metadata = {
  title: '公文生成平台',
  description: '基于 Vercel 与 Supabase 的智能公文生成系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
