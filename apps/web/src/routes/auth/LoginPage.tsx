import { useState, type FormEvent } from 'react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Phase 1 Auth will handle API request
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/60 border border-slate-700/60 p-8 rounded-2xl shadow-xl backdrop-blur">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 mx-auto flex items-center justify-center font-bold text-slate-950 text-xl mb-4">
            WT
          </div>
          <h2 className="text-2xl font-bold text-white">Вход в систему</h2>
          <p className="text-sm text-slate-400 mt-1">
            Для Владельца, Компании (Client) и Бригадира (Foreman)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Логин
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="Введите имя пользователя"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl transition shadow-lg shadow-emerald-500/20 mt-2"
          >
            Войти
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-xs text-slate-400 hover:text-emerald-400 transition">
            ← Вернуться на главную
          </a>
        </div>
      </div>
    </div>
  );
}
