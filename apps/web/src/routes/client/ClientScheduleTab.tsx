import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Calendar, Save, Check, Loader2 } from 'lucide-react';

export function ClientScheduleTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [scheduleMatrix, setScheduleMatrix] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  const daysOfWeek = [
    { day: 0, label: t('admin.daySun') },
    { day: 1, label: t('admin.dayMon') },
    { day: 2, label: t('admin.dayTue') },
    { day: 3, label: t('admin.dayWed') },
    { day: 4, label: t('admin.dayThu') },
    { day: 5, label: t('admin.dayFri') },
    { day: 6, label: t('admin.daySat') },
  ];

  // Queries
  const { data: empData, isLoading: isEmpLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  const { data: schedData, isLoading: isSchedLoading } = useQuery({
    queryKey: ['client-schedule'],
    queryFn: () => apiRequest<{ schedules: any[] }>('/api/client/schedule'),
  });

  useEffect(() => {
    if (schedData?.schedules) {
      const map: Record<string, string> = {};
      for (const s of schedData.schedules) {
        map[`${s.employeeId}_${s.dayOfWeek}`] = s.shiftType;
      }
      setScheduleMatrix(map);
    }
  }, [schedData]);

  // Save Schedule Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<any>[] = [];
      for (const [key, shiftType] of Object.entries(scheduleMatrix)) {
        const [empIdStr, dayOfWeekStr] = key.split('_');
        const employeeId = parseInt(empIdStr || '0', 10);
        const dayOfWeek = parseInt(dayOfWeekStr || '0', 10);
        if (employeeId) {
          promises.push(
            apiRequest('/api/client/schedule', {
              method: 'POST',
              body: JSON.stringify({ employeeId, dayOfWeek, shiftType }),
            })
          );
        }
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-schedule'] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    },
  });

  const employees = empData?.employees || [];
  const isLoading = isEmpLoading || isSchedLoading;

  const handleShiftChange = (employeeId: number, dayOfWeek: number, shiftType: string) => {
    setScheduleMatrix((prev) => ({
      ...prev,
      [`${employeeId}_${dayOfWeek}`]: shiftType,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            {t('admin.scheduleTitle')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.scheduleSubtitle')}
          </p>
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : savedSuccess ? (
            <Check className="w-4 h-4 text-emerald-200" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {savedSuccess ? t('admin.scheduleSaved') : t('admin.saveSchedule')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : employees.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
          {t('admin.addEmployeesFirst')}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 sticky left-0 bg-slate-950 z-10">{t('admin.thEmployee')}</th>
                  {daysOfWeek.map((d) => (
                    <th key={d.day} className="p-4 text-center whitespace-nowrap">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-semibold text-white sticky left-0 bg-slate-900 z-10 whitespace-nowrap">
                      {emp.name}
                      <span className="block text-[11px] font-mono text-slate-400">{emp.empId}</span>
                    </td>
                    {daysOfWeek.map((d) => {
                      const val = scheduleMatrix[`${emp.id}_${d.day}`] || 'morning';
                      return (
                        <td key={d.day} className="p-3 text-center">
                          <select
                            value={val}
                            onChange={(e) => handleShiftChange(emp.id, d.day, e.target.value)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              val === 'morning'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : val === 'evening'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : val === 'night'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                          >
                            <option value="morning">{t('admin.shiftMorning')}</option>
                            <option value="evening">{t('admin.shiftEvening')}</option>
                            <option value="night">{t('admin.shiftNight')}</option>
                            <option value="off">{t('admin.shiftOff')}</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
