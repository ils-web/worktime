import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import {
  Users,
  Clock,
  ShieldCheck,
  Activity,
  LogOut,
  Loader2,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Search,
  FileEdit,
} from 'lucide-react';

export function ClientDashboardTab() {
  const queryClient = useQueryClient();

  // Queries
  const { data: empData, isLoading: isEmpLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ['client-logs-recent'],
    queryFn: () =>
      apiRequest<{
        logs: any[];
        todayStats?: {
          totalCompletedHours: number;
          completedShiftsCount: number;
          clockInsCount: number;
          manualLogsToday: any[];
          topWorkersToday: Array<{ empId: string; name: string; hours: number }>;
        };
      }>('/api/client/logs/recent'),
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
  const todayStats = logsData?.todayStats;

  // 1. Long Shift Alerts (> 10 hours)
  const longShiftAlerts = activeWorkers
    .map((emp) => {
      const startTime = emp.lastLogTime ? new Date(emp.lastLogTime) : null;
      const hoursOnShift = startTime
        ? Math.max(0, (Date.now() - startTime.getTime()) / 3600000)
        : 0;
      return {
        emp,
        hoursOnShift,
        startTime,
      };
    })
    .filter((a) => a.hoursOnShift >= 10);

  // 2. Manual logs today
  const manualLogsToday = todayStats?.manualLogsToday || [];
  const totalAlertsCount = longShiftAlerts.length + manualLogsToday.length;

  const [panelTab, setPanelTab] = useState<'alerts' | 'summary' | 'feed'>(
    totalAlertsCount > 0 ? 'alerts' : 'summary'
  );
  const [feedFilter, setFeedFilter] = useState<'ALL' | 'CLOCK_IN' | 'CLOCK_OUT' | 'MANUAL'>('ALL');
  const [feedSearch, setFeedSearch] = useState('');

  // Switch to alerts if count changes and was 0 before
  useEffect(() => {
    if (totalAlertsCount > 0 && panelTab === 'summary') {
      setPanelTab('alerts');
    }
  }, [totalAlertsCount]);

  // Today Summary metrics
  const completedHours = todayStats?.totalCompletedHours || 0;
  const activeElapsedHours = activeWorkers.reduce((acc, emp) => {
    if (!emp.lastLogTime) return acc;
    const h = (Date.now() - new Date(emp.lastLogTime).getTime()) / 3600000;
    return acc + Math.max(0, h);
  }, 0);
  const totalHoursWorkedToday = Number((completedHours + activeElapsedHours).toFixed(1));
  const attendanceRate =
    employees.length > 0 ? Math.round((activeWorkers.length / employees.length) * 100) : 0;

  // Filter feed logs
  const filteredFeedLogs = recentLogs.filter((log) => {
    if (feedFilter === 'CLOCK_IN' && log.action !== 'CLOCK_IN') return false;
    if (
      feedFilter === 'CLOCK_OUT' &&
      log.action !== 'CLOCK_OUT' &&
      log.action !== 'AUTO_EXIT'
    )
      return false;
    if (feedFilter === 'MANUAL' && !log.isManual) return false;
    if (feedSearch.trim()) {
      const q = feedSearch.toLowerCase();
      const empName = (log.employee?.name || log.empId || '').toLowerCase();
      return empName.includes(q);
    }
    return true;
  });

  function formatLogTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);
    const timeFormatted = d.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (diffMinutes < 1) return `только что (${timeFormatted})`;
    if (diffMinutes < 60) return `${diffMinutes} мин назад (${timeFormatted})`;
    return timeFormatted;
  }

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
                Обновляется автоматически в реальном времени (каждые 15 сек)
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
                        {Number(hoursOnShift) >= 10 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            {hoursOnShift} ч (переработка)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                        <span>
                          ID: <code className="text-slate-300 font-mono">{emp.empId}</code>
                        </span>
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
                        <span>
                          Длительность:{' '}
                          <strong className="text-emerald-400">{hoursOnShift} ч</strong>
                        </span>
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

        {/* 3. Concept 4: Modular Hub (Alerts, Today Summary, Smart Feed) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            {/* Header & Mode Switcher */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Контроль смен</span>
              </h3>
              {totalAlertsCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  {totalAlertsCount} требует внимания
                </span>
              )}
            </div>

            {/* Segmented Tab Bar */}
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold mb-4">
              <button
                type="button"
                onClick={() => setPanelTab('alerts')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  panelTab === 'alerts'
                    ? 'bg-slate-800 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertTriangle
                  className={`w-3.5 h-3.5 ${
                    totalAlertsCount > 0 ? 'text-rose-400 animate-bounce' : 'text-slate-400'
                  }`}
                />
                <span>Внимание</span>
                {totalAlertsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full">
                    {totalAlertsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPanelTab('summary')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  panelTab === 'summary'
                    ? 'bg-slate-800 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Сводка дня</span>
              </button>

              <button
                type="button"
                onClick={() => setPanelTab('feed')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  panelTab === 'feed'
                    ? 'bg-slate-800 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Лента</span>
              </button>
            </div>

            {/* TAB CONTENT */}

            {/* 1. Alerts & Exceptions Tab */}
            {panelTab === 'alerts' && (
              <div className="space-y-3">
                {totalAlertsCount === 0 ? (
                  <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-white text-sm">Все смены в норме</div>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                      Затянувшихся смен (&gt;10 ч), забытых выходов и подозрительных отметок за сегодня нет.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {/* Long Shift Alerts */}
                    {longShiftAlerts.map((a) => (
                      <div
                        key={a.emp.id}
                        className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-2 shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span className="font-bold text-white text-xs">{a.emp.name}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                            {a.hoursOnShift.toFixed(1)} ч
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Смена длится уже <strong>{a.hoursOnShift.toFixed(1)} ч</strong> (с{' '}
                          {a.startTime?.toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                          ). Возможно, работник забыл закрыть смену.
                        </p>
                        <button
                          type="button"
                          onClick={() => forceExitMutation.mutate(a.emp.id)}
                          disabled={forceExitMutation.isPending}
                          className="w-full py-1.5 bg-rose-600/80 hover:bg-rose-500 active:scale-98 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-md"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Закрыть смену работника</span>
                        </button>
                      </div>
                    ))}

                    {/* Manual Logs Alerts */}
                    {manualLogsToday.map((log: any) => (
                      <div
                        key={log.id}
                        className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                            {log.employee?.name || log.empId}
                          </span>
                          <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                            {log.action === 'CLOCK_IN' ? 'ВХОД' : 'ВЫХОД'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Ручная правка в{' '}
                          {new Date(log.dateTime).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                          .
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Today's Summary Tab */}
            {panelTab === 'summary' && (
              <div className="space-y-4">
                {/* 3-metric KPI Card */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Часы
                    </span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {totalHoursWorkedToday} ч
                    </span>
                  </div>
                  <div className="border-x border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Закрыто
                    </span>
                    <span className="text-base font-black text-white font-mono">
                      {todayStats?.completedShiftsCount ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Явка
                    </span>
                    <span className="text-base font-black text-sky-400 font-mono">
                      {attendanceRate}%
                    </span>
                  </div>
                </div>

                {/* Staff Attendance Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Загрузка персонала сегодня:</span>
                    <span className="font-bold text-white">
                      {activeWorkers.length} из {employees.length} на смене
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                </div>

                {/* Completed Shifts Today */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">
                    Отработали за сегодня (итоги):
                  </span>
                  {todayStats?.topWorkersToday && todayStats.topWorkersToday.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {todayStats.topWorkersToday.map((w) => (
                        <div
                          key={w.empId}
                          className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-800/80 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-white truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{w.name}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 shrink-0">
                            {w.hours} ч
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950/30 rounded-xl text-center text-slate-500 text-xs">
                      Смены еще в процессе. Итоги отобразятся после первого выхода.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Smart Activity Feed Tab */}
            {panelTab === 'feed' && (
              <div className="space-y-3">
                {/* Search & Action Filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={feedSearch}
                      onChange={(e) => setFeedSearch(e.target.value)}
                      placeholder="Поиск по имени..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div className="flex gap-1">
                    {[
                      { id: 'ALL', label: 'Все' },
                      { id: 'CLOCK_IN', label: 'Вход' },
                      { id: 'CLOCK_OUT', label: 'Выход' },
                      { id: 'MANUAL', label: 'Ручные' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setFeedFilter(btn.id as any)}
                        className={`flex-1 py-1 rounded text-[11px] font-semibold transition ${
                          feedFilter === btn.id
                            ? 'bg-slate-800 text-white font-bold border border-slate-700'
                            : 'bg-slate-950/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event items list */}
                {isLogsLoading ? (
                  <div className="flex justify-center p-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : filteredFeedLogs.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">Событий не найдено</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {filteredFeedLogs.slice(0, 8).map((log) => {
                      const isClockIn = log.action === 'CLOCK_IN';
                      return (
                        <div
                          key={log.id}
                          className="p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs flex items-center justify-between hover:border-slate-700 transition"
                        >
                          <div className="truncate mr-2">
                            <div className="font-semibold text-white truncate">
                              {log.employee?.name || log.empId}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {formatLogTime(log.dateTime)}
                              {log.isManual && ' (вручную)'}
                            </div>
                          </div>
                          <Badge variant={isClockIn ? 'emerald' : 'slate'} className="shrink-0 text-[10px]">
                            {isClockIn ? 'ВХОД' : 'ВЫХОД'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
