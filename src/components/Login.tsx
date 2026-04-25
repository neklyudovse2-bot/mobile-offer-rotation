'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    document.cookie = `admin_session=${password}; path=/; max-age=${30 * 24 * 60 * 60}`;
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-black px-4">
      <form 
        onSubmit={handleLogin} 
        className="w-full max-w-[380px]"
      >
        <div className="flex items-center gap-2 mb-10 justify-center">
          <svg width="20" height="20" viewBox="0 0 76 65" fill="black" xmlns="http://www.w3.org/2000/svg">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/>
          </svg>
          <span className="text-base font-semibold tracking-tight">Rotation</span>
        </div>

        <div className="border border-[#eaeaea] rounded-md bg-white p-8">
          <h1 className="text-xl font-semibold tracking-tight mb-2">Вход в админку</h1>
          <p className="text-sm text-[#666] mb-6">Введите пароль для продолжения</p>

          <label className="block">
            <span className="text-xs font-medium text-[#666] uppercase tracking-wider mb-2 block">
              Пароль
            </span>
            <input
              type="password"
              className="w-full px-3 py-2 border border-[#eaeaea] rounded-md 
                         text-sm text-black placeholder:text-[#999]
                         focus:outline-none focus:border-black transition-colors
                         disabled:opacity-50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </label>

          <button 
            type="submit" 
            disabled={loading || !password}
            className="w-full mt-6 px-4 py-2 rounded-md 
                       bg-black text-white text-sm font-semibold 
                       hover:bg-[#333] transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </div>

        <p className="text-xs text-[#999] mt-6 text-center">
          Mobile Offer Rotation · Admin
        </p>
      </form>
    </div>
  );
}
