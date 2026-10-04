import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Plus, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';

export function ClientForemenTab() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['client-foremen'],
    queryFn: () => apiRequest<{ foremen: any[] }>('/api/client/foremen'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/foremen', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-foremen'] });
      setIsCreateOpen(false);
      setForm({ name: '', username: '', password: '' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/client/foremen/${id}/toggle`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-foremen'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/client/foremen/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-foremen'] }),
  });

  const foremen = data?.foremen || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Бригадиры компании</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление учётными записями бригадиров и доступом к подопечным сотрудникам
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
        >
          <Plus className="w-4 h-4" />
          Добавить бригадира
        </button>
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
                <th className="p-4">ФИО</th>
                <th className="p-4">Логин</th>
                <th className="p-4">Назначено сотрудников</th>
                <th className="p-4">Статус</th>
                <th className="p-4">Дата создания</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {foremen.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Бригадиры пока не добавлены
                  </td>
                </tr>
              ) : (
                foremen.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-semibold text-white">{f.name}</td>
                    <td className="p-4 text-xs font-mono text-slate-300">{f.username}</td>
                    <td className="p-4 text-emerald-400 font-semibold">
                      {f._count?.employees || 0} чел.
                    </td>
                    <td className="p-4">
                      {f.isActive ? (
                        <Badge variant="emerald" dot>Активен</Badge>
                      ) : (
                        <Badge variant="rose">Отключен</Badge>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleMutation.mutate(f.id)}
                          title={f.isActive ? 'Отключить' : 'Включить'}
                          className={`p-1.5 rounded-lg hover:bg-slate-800 transition ${
                            f.isActive
                              ? 'text-emerald-400 hover:text-rose-400'
                              : 'text-rose-400 hover:text-emerald-400'
                          }`}
                        >
                          {f.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(f.id)}
                          title="Удалить бригадира"
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Foreman */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Новый бригадир"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">ФИО</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              placeholder="Михаил Бригадир"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Логин</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              placeholder="foreman_mikhail"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Пароль</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Создать
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
