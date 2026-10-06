import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import {
  Download,
  FileSpreadsheet,
  Clock,
  PlusCircle,
  Moon,
  Sun,
  Loader2,
} from 'lucide-react';

export function ClientHoursTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of month
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Forms
  const [quickForm, setQuickForm] = useState({ empId: '', action: 'CLOCK_IN' });
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualShiftDate, setManualShiftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualStartTime, setManualStartTime] = useState('08:00');
  const [manualEndTime, setManualEndTime] = useState('17:00');
  const [isNextDay, setIsNextDay] = useState(false);

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['client-hours', startDate, endDate],
    queryFn: () =>
      apiRequest<{ hours: any[]; clientName: string }>(
        `/api/client/hours?startDate=${startDate}&endDate=${endDate}`
      ),
  });

  const { data: empData } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  // Mutations
  const quickMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/logs/quick', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-hours'] });
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      queryClient.invalidateQueries({ queryKey: ['client-logs-recent'] });
      setIsQuickOpen(false);
    },
  });

  const manualMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/logs/manual', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-hours'] });
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      queryClient.invalidateQueries({ queryKey: ['client-logs-recent'] });
      setIsManualOpen(false);
    },
  });

  const hoursList = data?.hours || [];
  const employees = empData?.employees || [];

  // Summary statistics
  const totalNet = hoursList.reduce((acc, h) => acc + (h.netHours || 0), 0);
  const totalNight = hoursList.reduce((acc, h) => acc + (h.nightHours || 0), 0);
  const totalSaturday = hoursList.reduce((acc, h) => acc + (h.saturdayHours || 0), 0);
  const totalOvertime = hoursList.reduce((acc, h) => acc + (h.overtimeHours || 0), 0);

  // Quick date presets
  const handleThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(lastDay.toISOString().slice(0, 10));
  };

  const handleLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(lastDay.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    try {
      const blob = await apiRequest<Blob>(
        `/api/client/reports/pdf?startDate=${startDate}&endDate=${endDate}`
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Timesheet_${startDate}_${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(t('admin.downloadErrorPdf') + err.message);
    }
  };

  // Download CSV
  const handleDownloadCsv = async () => {
    try {
      const blob = await apiRequest<Blob>(
        `/api/client/reports/csv?startDate=${startDate}&endDate=${endDate}`
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Timesheet_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(t('admin.downloadErrorCsv') + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            {t('admin.timesheetTitle')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.timesheetSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Period Presets */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold shadow-sm">
            <button
              type="button"
              onClick={handleThisMonth}
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              {t('admin.thisMonth')}
            </button>
            <button
              type="button"
              onClick={handleLastMonth}
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              {t('admin.lastMonth')}
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              {t('admin.today')}
            </button>
          </div>

          {/* Explicit Date Inputs (From / To) */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs shadow-sm">
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-slate-400 font-semibold">{t('admin.dateFrom')}:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <span className="text-slate-600 font-bold">—</span>
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-slate-400 font-semibold">{t('admin.dateTo')}:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <button
            type="button"
            onClick={() => {
              setQuickForm({ empId: employees[0]?.empId || '', action: 'CLOCK_IN' });
              setIsQuickOpen(true);
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            {t('admin.quickActionBtn')}
          </button>

          <button
            type="button"
            onClick={() => {
              setManualEmpId(employees[0]?.empId || '');
              setManualShiftDate(startDate || new Date().toISOString().slice(0, 10));
              setManualStartTime('08:00');
              setManualEndTime('17:00');
              setIsNextDay(false);
              setIsManualOpen(true);
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            {t('admin.addManualShift')}
          </button>

          {/* Export Buttons */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            {t('admin.downloadCsv')}
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-950"
          >
            <Download className="w-3.5 h-3.5" />
            {t('admin.downloadPdf')}
          </button>
        </div>
      </div>

      {/* 2. Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-emerald-400" />
            {t('admin.cardTotalNet')}
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {totalNet.toFixed(1)} <span className="text-xs font-normal text-slate-400">{t('admin.hourUnit')}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Moon className="w-4 h-4 text-purple-400" />
            {t('admin.cardNight')}
          </div>
          <div className="text-2xl font-black text-purple-400 mt-2">
            {totalNight.toFixed(1)} <span className="text-xs font-normal text-slate-400">{t('admin.hourUnit')}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            {t('admin.cardSat')}
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {totalSaturday.toFixed(1)} <span className="text-xs font-normal text-slate-400">{t('admin.hourUnit')}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-rose-400" />
            {t('admin.cardOvertime')}
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">
            {totalOvertime.toFixed(1)} <span className="text-xs font-normal text-slate-400">{t('admin.hourUnit')}</span>
          </div>
        </div>
      </div>

      {/* 3. Detailed Hours Table */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-3.5">{t('admin.thDate')}</th>
                  <th className="p-3.5">{t('admin.thEmployee')}</th>
                  <th className="p-3.5">{t('admin.thIn')}</th>
                  <th className="p-3.5">{t('admin.thOut')}</th>
                  <th className="p-3.5">{t('admin.thGross')}</th>
                  <th className="p-3.5">{t('admin.thLunch')}</th>
                  <th className="p-3.5">{t('admin.thNet')}</th>
                  <th className="p-3.5">{t('admin.thNight')}</th>
                  <th className="p-3.5">{t('admin.thSat')}</th>
                  <th className="p-3.5">{t('admin.thOvertime')}</th>
                  <th className="p-3.5">{t('admin.thNotes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {hoursList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-500">
                      {t('admin.noShiftsPeriod')}
                    </td>
                  </tr>
                ) : (
                  hoursList.map((row, idx) => (
                    <tr key={`${row.empId}_${row.date}_${idx}`} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-xs text-slate-300">{row.date}</td>
                      <td className="p-3.5 font-semibold text-white">
                        {row.name}
                        <span className="block text-[11px] font-mono text-slate-400">{row.empId}</span>
                      </td>
                      <td className="p-3.5 text-xs text-slate-300">{row.firstIn}</td>
                      <td className="p-3.5 text-xs text-slate-300">{row.lastOut}</td>
                      <td className="p-3.5 text-xs text-slate-400">{row.grossHours?.toFixed(2)}</td>
                      <td className="p-3.5 text-xs text-slate-500">
                        {row.lunchDeducted ? `-${row.lunchDeducted}${t('admin.hourUnit')}` : '0'}
                      </td>
                      <td className="p-3.5 font-bold text-emerald-400">
                        {row.netHours?.toFixed(2)} {t('admin.hourUnit')}
                      </td>
                      <td className="p-3.5 text-xs text-purple-400">
                        {row.nightHours > 0 ? `${row.nightHours.toFixed(2)} ${t('admin.hourUnit')}` : '—'}
                      </td>
                      <td className="p-3.5 text-xs text-amber-400">
                        {row.saturdayHours > 0 ? `${row.saturdayHours.toFixed(2)} ${t('admin.hourUnit')}` : '—'}
                      </td>
                      <td className="p-3.5 text-xs text-rose-400">
                        {row.overtimeHours > 0 ? `${row.overtimeHours.toFixed(2)} ${t('admin.hourUnit')}` : '—'}
                      </td>
                      <td className="p-3.5 text-xs text-slate-400 max-w-xs truncate">
                        {row.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Quick Clock */}
      <Modal isOpen={isQuickOpen} onClose={() => setIsQuickOpen(false)} title={t('admin.quickModalTitle')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            quickMutation.mutate(quickForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('admin.employee')}</label>
            <select
              required
              value={quickForm.empId}
              onChange={(e) => setQuickForm({ ...quickForm, empId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            >
              {employees.map((emp) => (
                <option key={emp.empId} value={emp.empId}>
                  {emp.name} ({emp.empId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('admin.action')}</label>
            <select
              value={quickForm.action}
              onChange={(e) => setQuickForm({ ...quickForm, action: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="CLOCK_IN">{t('admin.quickClockInDesc')}</option>
              <option value="CLOCK_OUT">{t('admin.quickClockOutDesc')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsQuickOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              {t('admin.cancel')}
            </button>
            <button
              type="submit"
              disabled={quickMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {quickMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('admin.quickSubmit')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Manual Shift Entry with 24-hour TimePicker */}
      <Modal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        title={t('admin.manualShiftTitle')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            let outDate = manualShiftDate;
            if (isNextDay || manualEndTime < manualStartTime) {
              const d = new Date(manualShiftDate);
              d.setDate(d.getDate() + 1);
              outDate = d.toISOString().slice(0, 10);
            }
            manualMutation.mutate({
              empId: manualEmpId,
              clockIn: `${manualShiftDate}T${manualStartTime}:00`,
              clockOut: `${outDate}T${manualEndTime}:00`,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('admin.employee')}
            </label>
            <select
              required
              value={manualEmpId}
              onChange={(e) => setManualEmpId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {employees.map((emp) => (
                <option key={emp.empId} value={emp.empId}>
                  {emp.name} ({emp.empId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('admin.shiftDate')}
            </label>
            <input
              type="date"
              required
              value={manualShiftDate}
              onChange={(e) => setManualShiftDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Quick Shift Presets Bar */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {t('admin.quickShiftPresets')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setManualStartTime('08:00');
                  setManualEndTime('17:00');
                  setIsNextDay(false);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                  manualStartTime === '08:00' && manualEndTime === '17:00' && !isNextDay
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                ☀️ 08:00 — 17:00
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualStartTime('07:00');
                  setManualEndTime('16:00');
                  setIsNextDay(false);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                  manualStartTime === '07:00' && manualEndTime === '16:00' && !isNextDay
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                🌅 07:00 — 16:00
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualStartTime('15:00');
                  setManualEndTime('23:00');
                  setIsNextDay(false);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                  manualStartTime === '15:00' && manualEndTime === '23:00' && !isNextDay
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                🌆 15:00 — 23:00
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualStartTime('22:00');
                  setManualEndTime('06:00');
                  setIsNextDay(true);
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                  manualStartTime === '22:00' && manualEndTime === '06:00' && isNextDay
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                🌙 22:00 — 06:00
              </button>
            </div>
          </div>

          {/* Time pickers: 24h Hour and Minute Selectors */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.clockInTime')}
              </label>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-emerald-500">
                <select
                  value={manualStartTime.split(':')[0] || '08'}
                  onChange={(e) => {
                    const m = manualStartTime.split(':')[1] || '00';
                    setManualStartTime(`${e.target.value}:${m}`);
                  }}
                  className="bg-transparent text-white text-xs font-mono font-bold px-1 py-1 focus:outline-none cursor-pointer flex-1 text-center"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const val = String(i).padStart(2, '0');
                    return (
                      <option key={val} value={val} className="bg-slate-900 text-white font-mono">
                        {val}
                      </option>
                    );
                  })}
                </select>
                <span className="text-slate-500 font-bold">:</span>
                <select
                  value={manualStartTime.split(':')[1] || '00'}
                  onChange={(e) => {
                    const h = manualStartTime.split(':')[0] || '08';
                    setManualStartTime(`${h}:${e.target.value}`);
                  }}
                  className="bg-transparent text-white text-xs font-mono font-bold px-1 py-1 focus:outline-none cursor-pointer flex-1 text-center"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white font-mono">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.clockOutTime')}
              </label>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-emerald-500">
                <select
                  value={manualEndTime.split(':')[0] || '17'}
                  onChange={(e) => {
                    const m = manualEndTime.split(':')[1] || '00';
                    const newH = e.target.value;
                    setManualEndTime(`${newH}:${m}`);
                    if (parseInt(newH, 10) < parseInt(manualStartTime.split(':')[0] || '08', 10)) {
                      setIsNextDay(true);
                    }
                  }}
                  className="bg-transparent text-white text-xs font-mono font-bold px-1 py-1 focus:outline-none cursor-pointer flex-1 text-center"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const val = String(i).padStart(2, '0');
                    return (
                      <option key={val} value={val} className="bg-slate-900 text-white font-mono">
                        {val}
                      </option>
                    );
                  })}
                </select>
                <span className="text-slate-500 font-bold">:</span>
                <select
                  value={manualEndTime.split(':')[1] || '00'}
                  onChange={(e) => {
                    const h = manualEndTime.split(':')[0] || '17';
                    setManualEndTime(`${h}:${e.target.value}`);
                  }}
                  className="bg-transparent text-white text-xs font-mono font-bold px-1 py-1 focus:outline-none cursor-pointer flex-1 text-center"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white font-mono">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={isNextDay || manualEndTime < manualStartTime}
                onChange={(e) => setIsNextDay(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span>{t('admin.nextDayNotice')}</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsManualOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              {t('admin.cancel')}
            </button>
            <button
              type="submit"
              disabled={manualMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition"
            >
              {manualMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('admin.saveShift')}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
