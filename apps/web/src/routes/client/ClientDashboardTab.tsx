import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Users, Clock, ShieldCheck, Activity, LogOut, Loader2 } from 'lucide-react';

export function ClientDashboardTab() {
  const queryClient = useQueryClient();

  // Queries
  const { data: empData, isLoading: isEmpLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['client-logs-recent'],
    queryFn: () => apiRequest<{ logs: any[] }>('/api/client/logs/recent'),
    refetchInterval: 15000, // Poll every 15s for real-time tracking
  });

  // Force exit mutation
  const forceExitMutation = useMutation({
    mutationFn: (empDbId: number) =>
      apiRequest(`/api/client/employees/${empDbId}/force-exit`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      queryClient.invalidateQueries({ queryKey: ['client-logs-recent'] });
    },
  });

  const employees = empData?.employees || [];
  const activeWorkers = employees.filter((e) => e.isOnShift);
  const recentLogs = logsData?.logs || [];

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Всего сотрудников</span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{employees.length}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Сейчас на смене</span>
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-3">{activeWorkers.length}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Строгий GPS</span>
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">
            {employees.filter((e) => e.strictGps).length}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Мобильные сотрудники</span>
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">
            {employees.filter((e) => e.isMobile).length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Real-Time Active Workers on Shift */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                Сотрудники на объектах прямо сейчас
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Обновляется автоматически в реальном времени
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {activeWorkers.length} активных
            </span>
          </div>

          {isEmpLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : activeWorkers.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80 text-slate-500 text-sm">
              В данный момент никто не находится на рабочей смене
            </div>
          ) : (
            <div className="space-y-3">
              {activeWorkers.map((emp) => {
                const startTime = emp.lastLogTime ? new Date(emp.lastLogTime) : null;
                const hoursOnShift = startTime
                  ? Math.max(0, (Date.now() - startTime.getTime()) / 3600000).toFixed(1)
                  : '0.0';

                return (
                  <div
                    key={emp.id}
                    className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        {emp.name}
                        <Badge variant="emerald" dot>На объекте</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                        <span>ID: <code className="text-slate-300 font-mono">{emp.empId}</code></span>
                        {startTime && (
                          <span>
                            Начало:{' '}
                            {startTime.toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </span>
                        )}
                        <span>Длительность: <strong className="text-emerald-400">{hoursOnShift} ч</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => forceExitMutation.mutate(emp.id)}
                      disabled={forceExitMutation.isPending}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      title="Принудительно закрыть смену"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Закрыть смену
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Recent Events Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Последние отметки</h3>

          {isLogsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">Нет недавних событий</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {recentLogs.slice(0, 10).map((log) => {
                const isClockIn = log.action === 'CLOCK_IN';
                return (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {log.employee?.name || log.empId}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(log.dateTime).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                        {log.isManual && ' (вручную)'}
                      </div>
                    </div>
                    <Badge variant={isClockIn ? 'emerald' : 'slate'}>
                      {isClockIn ? 'ВХОД' : 'ВЫХОД'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
