'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Просто устанавливаем куку на клиенте для простоты, т.к. сверка идет на сервере
    document.cookie = `admin_session=${password}; path=/; max-age=${30 * 24 * 60 * 60}`;
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-black">
      <form onSubmit={handleLogin} className="p-8 bg-white border border-gray-200 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl font-bold mb-6">Вход в Marcus Admin</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="password"
          placeholder="Пароль"
          className="w-full p-2 border border-gray-300 rounded mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Войти
        </button>
      </form>
    </div>
  );
}
