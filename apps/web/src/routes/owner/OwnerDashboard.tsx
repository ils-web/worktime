export function OwnerDashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Панель Владельца SaaS</h1>
        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-semibold border border-amber-500/20">
          Owner Portal
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Клиенты (Тенанты)</div>
          <div className="text-3xl font-bold text-white mt-2">0</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Счета за месяц</div>
          <div className="text-3xl font-bold text-white mt-2">0 ₪</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 p-6 rounded-2xl">
          <div className="text-sm text-slate-400">Новые заявки с лендинга</div>
          <div className="text-3xl font-bold text-white mt-2">0</div>
        </div>
      </div>
    </div>
  );
}
