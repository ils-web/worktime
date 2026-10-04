export function ClientDashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Панель Управления Компанией</h1>
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-500/20">
          Client & Foreman Portal
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Сотрудники</div>
          <div className="text-3xl font-bold text-white mt-2">0</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Сейчас на смене</div>
          <div className="text-3xl font-bold text-emerald-400 mt-2">0</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Бригадиры</div>
          <div className="text-3xl font-bold text-white mt-2">0</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Часов за месяц</div>
          <div className="text-3xl font-bold text-white mt-2">0.0 ч</div>
        </div>
      </div>
    </div>
  );
}
