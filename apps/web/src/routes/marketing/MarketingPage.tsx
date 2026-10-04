export function MarketingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            WT
          </div>
          <span className="text-xl font-bold tracking-tight">TimeTracker SaaS</span>
        </div>
        <a
          href="/login"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition text-sm"
        >
          Войти в систему
        </a>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-4xl mx-auto">
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-emerald-500/20">
          TimeTracker v2 • Production Ready
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
          Учёт рабочего времени по <span className="text-emerald-400">GPS-геозоне</span> для выездных сотрудников
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mb-8">
          Автоматический контроль присутствия на объекте, строгий режим с фоновым GPS, расчёт ночных и сверхурочных часов, PWA для сотрудников без паролей.
        </p>
        <div className="flex gap-4">
          <a
            href="/login"
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            Войти как администратор
          </a>
        </div>
      </main>
    </div>
  );
}
