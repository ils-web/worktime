import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Phone, Mail, Trash2, Edit3, Loader2 } from 'lucide-react';

export function OwnerLeadsTab() {
  const queryClient = useQueryClient();
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [commentText, setCommentText] = useState('');
  const [statusVal, setStatusVal] = useState('new');

  const { data, isLoading } = useQuery({
    queryKey: ['owner-leads'],
    queryFn: () => apiRequest<{ leads: any[] }>('/api/owner/leads'),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      apiRequest(`/api/owner/leads/${id}/comment`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-leads'] });
      setEditingLead(null);
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/owner/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-leads'] }),
  });

  const leads = data?.leads || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Заявки с лендинга (Leads)</h2>
        <p className="text-xs text-slate-400 mt-0.5">Входящие контакты потенциальных клиентов</p>
      </div>

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
                  <th className="p-4">Имя / Компания</th>
                  <th className="p-4">Контакты</th>
                  <th className="p-4">Сообщение</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Комментарий</th>
                  <th className="p-4">Дата</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Заявок пока нет
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{lead.name}</div>
                        {lead.company && (
                          <div className="text-xs text-slate-400">{lead.company}</div>
                        )}
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <a href={`tel:${lead.phone}`} className="hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail className="w-3.5 h-3.5 text-blue-400" />
                            <a href={`mailto:${lead.email}`} className="hover:underline">
                              {lead.email}
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-300 max-w-xs truncate">
                        {lead.message || '—'}
                      </td>
                      <td className="p-4">
                        {lead.status === 'new' && <Badge variant="emerald" dot>Новая</Badge>}
                        {lead.status === 'in_progress' && (
                          <Badge variant="amber">В работе</Badge>
                        )}
                        {lead.status === 'closed' && <Badge variant="slate">Закрыта</Badge>}
                      </td>
                      <td className="p-4 text-xs text-slate-400 max-w-xs truncate">
                        {lead.comment || '—'}
                      </td>
                      <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingLead(lead);
                              setCommentText(lead.comment || '');
                              setStatusVal(lead.status || 'new');
                            }}
                            title="Редактировать комментарий и статус"
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteLeadMutation.mutate(lead.id)}
                            title="Удалить заявку"
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
        </div>
      )}

      {/* Modal: Edit Lead */}
      <Modal
        isOpen={!!editingLead}
        onClose={() => setEditingLead(null)}
        title="Обработка заявки"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editingLead) {
              updateLeadMutation.mutate({
                id: editingLead.id,
                body: { comment: commentText, status: statusVal },
              });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Статус заявки</label>
            <select
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="new">Новая</option>
              <option value="in_progress">В работе (связались)</option>
              <option value="closed">Закрыта (клиент подключен / отказ)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Комментарий менеджера</label>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              placeholder="Договорились о созвоне на завтра в 14:00..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditingLead(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={updateLeadMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {updateLeadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
