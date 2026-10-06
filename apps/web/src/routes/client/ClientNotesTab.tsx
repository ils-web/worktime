import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Plus, StickyNote, DollarSign, Calendar, Loader2 } from 'lucide-react';

export function ClientNotesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ empId: '', noteText: '', expense: 0 });

  // Queries
  const { data: notesData, isLoading } = useQuery({
    queryKey: ['client-notes', selectedDate],
    queryFn: () => apiRequest<{ notes: any[] }>(`/api/client/notes?date=${selectedDate}`),
  });

  const { data: empData } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  // Mutation
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/notes', {
        method: 'POST',
        body: JSON.stringify({ ...body, date: selectedDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', selectedDate] });
      setIsCreateOpen(false);
      setForm({ empId: '', noteText: '', expense: 0 });
    },
  });

  const notes = notesData?.notes || [];
  const employees = empData?.employees || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-400" />
            {t('admin.notesTabTitle')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.notesTabSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
          </div>

          <button
            onClick={() => {
              setForm({ empId: employees[0]?.empId || '', noteText: '', expense: 0 });
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            {t('admin.addNote')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-4">{t('admin.thEmployee')}</th>
                <th className="p-4">{t('admin.thNoteReason')}</th>
                <th className="p-4">{t('admin.thExpense')}</th>
                <th className="p-4">{t('admin.thCreatedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    {t('admin.noNotesDate', { date: selectedDate })}
                  </td>
                </tr>
              ) : (
                notes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-semibold text-white">
                      {n.employee?.name || n.empId}
                      <span className="block text-xs font-mono text-slate-400">{n.empId}</span>
                    </td>
                    <td className="p-4 text-slate-300 text-xs sm:text-sm">{n.noteText}</td>
                    <td className="p-4">
                      {n.expense ? (
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ₪{n.expense}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Note */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={t('admin.newNoteModal')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('admin.noteEmployee')}</label>
            <select
              required
              value={form.empId}
              onChange={(e) => setForm({ ...form, empId: e.target.value })}
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('admin.noteText')}</label>
            <textarea
              rows={3}
              required
              value={form.noteText}
              onChange={(e) => setForm({ ...form, noteText: e.target.value })}
              placeholder={t('worker.notePlaceholder')}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('admin.noteExpenseLabel')}</label>
            <input
              type="number"
              step="0.5"
              value={form.expense}
              onChange={(e) => setForm({ ...form, expense: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              {t('admin.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('admin.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
