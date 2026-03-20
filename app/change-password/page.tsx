'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

function ChangePasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadCurrentUser() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (!user) {
        router.replace('/login');
        return;
      }

      setEmail(user.email || '');
    }

    loadCurrentUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 12) {
      setError('新密码至少需要 12 位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          must_change_password: false,
        },
      });

      if (updateError) {
        setError(updateError.message || '密码修改失败');
        return;
      }

      setMessage('密码修改成功，正在返回首页...');
      setTimeout(() => {
        router.replace('/');
        router.refresh();
      }, 1200);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">修改密码</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {searchParams.get('reason') === 'must_change_password'
            ? '首次登录或管理员重置密码后，需要先修改密码才能继续使用。'
            : '请设置新的登录密码。'}
        </p>

        {email && <p className="text-sm text-gray-600 text-center mb-4">当前账号：{email}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">新密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="至少 12 位"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="再次输入新密码"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '保存中...' : '保存新密码'}
          </button>
        </form>

        <button onClick={handleLogout} className="w-full mt-4 text-sm text-gray-600 hover:text-gray-900">
          退出登录
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <ChangePasswordPageContent />
    </Suspense>
  );
}
