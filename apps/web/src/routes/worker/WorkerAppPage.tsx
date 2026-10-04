import { useParams } from 'react-router-dom';

export function WorkerAppPage() {
  const { empId } = useParams<{ empId: string }>();

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between p-4 bg-slate-950 text-white">
      <header className="flex justify-between items-center py-2 border-b border-slate-800">
        <div>
          <span className="text-xs text-slate-400">Сотрудник</span>
          <div className="font-semibold text-sm">ID: {empId}</div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          GPS активен
        </div>
      </header>

      <main className="my-auto space-y-4 py-8">
        <button
          className="w-full h-32 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-3xl rounded-3xl shadow-xl shadow-emerald-950 flex flex-col items-center justify-center transition"
        >
          <span>ВХОД</span>
          <span className="text-xs font-normal text-emerald-200 mt-1">Начать рабочую смену</span>
        </button>

        <button
          className="w-full h-32 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-black text-3xl rounded-3xl shadow-xl flex flex-col items-center justify-center transition border border-slate-700"
        >
          <span>ВЫХОД</span>
          <span className="text-xs font-normal text-slate-400 mt-1">Завершить смену</span>
        </button>
      </main>

      <footer className="py-2 text-center text-xs text-slate-500">
        TimeTracker PWA • Офлайн-режим поддерживается
      </footer>
    </div>
  );
}
