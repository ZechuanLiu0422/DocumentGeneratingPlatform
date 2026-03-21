import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl bg-white shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">页面不存在</h1>
        <p className="mt-3 text-sm text-gray-600">
          你访问的页面可能已经移动、删除，或者地址输入有误。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            返回首页
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            前往登录
          </Link>
        </div>
      </div>
    </div>
  );
}
