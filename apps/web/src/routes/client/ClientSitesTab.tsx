import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { MapPicker } from '../../components/MapPicker';
import {
  Building2,
  Plus,
  MapPin,
  Users,
  Edit2,
  Trash2,
  Loader2,
  Search,
  AlertTriangle,
} from 'lucide-react';

interface SiteFormState {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  employeeIds: number[];
}

export function ClientSitesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteFormState | null>(null);
  const [assigningSite, setAssigningSite] = useState<any | null>(null);
  const [deletingSite, setDeletingSite] = useState<any | null>(null);

  const [form, setForm] = useState<SiteFormState>({
    name: '',
    address: '',
    lat: 32.0853,
    lng: 34.7818,
    radius: 100,
    employeeIds: [],
  });

  // Queries
  const { data: sitesData, isLoading } = useQuery({
    queryKey: ['client-sites'],
    queryFn: () => apiRequest<{ sites: any[] }>('/api/client/sites'),
  });

  const { data: empData } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/sites', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-sites'] });
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiRequest(`/api/client/sites/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-sites'] });
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      setEditingSite(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/client/sites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-sites'] });
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      setDeletingSite(null);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ siteId, employeeIds }: { siteId: string; employeeIds: number[] }) =>
      apiRequest(`/api/client/sites/${siteId}/employees`, {
        method: 'POST',
        body: JSON.stringify({ employeeIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-sites'] });
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      setAssigningSite(null);
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      address: '',
      lat: 32.0853,
      lng: 34.7818,
      radius: 100,
      employeeIds: [],
    });
  };

  const sites = sitesData?.sites || [];
  const employees = empData?.employees || [];

  const filteredSites = sites.filter(
    (s: any) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            {t('admin.sitesTitle')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.sitesSubtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
        >
          <Plus className="w-4 h-4" />
          {t('admin.addSite')}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute ltr:left-3.5 rtl:right-3.5 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('admin.siteName') + ' / ' + t('admin.siteAddress') + '...'}
          className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Sites List */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">{t('admin.noSitesFound')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {t('admin.sitesSubtitle')}
          </p>
          <button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="mt-5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            {t('admin.addSite')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site: any) => {
            const assignedCount = site.employees?.length || 0;
            return (
              <div
                key={site.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-white text-base leading-snug">{site.name}</h3>
                    </div>
                    <Badge variant="blue">
                      {site.radius} {t('admin.metersUnit')}
                    </Badge>
                  </div>

                  <div className="text-xs text-slate-400 flex items-start gap-1.5 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {site.address || `${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-medium text-slate-300 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        {t('admin.assignedEmployees')}
                      </span>
                      <span className="font-bold text-emerald-400">{assignedCount}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {assignedCount === 0 ? (
                        <span className="text-[11px] text-slate-500 italic">
                          Нет прикреплённых работников
                        </span>
                      ) : (
                        site.employees.map((es: any) => (
                          <span
                            key={es.employee.id}
                            className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 flex items-center gap-1 font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {es.employee.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setAssigningSite(site)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('admin.manageAssignedEmployees')}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSite({
                          id: site.id,
                          name: site.name,
                          address: site.address || '',
                          lat: site.lat,
                          lng: site.lng,
                          radius: site.radius,
                          employeeIds: site.employees?.map((es: any) => es.employee.id) || [],
                        });
                      }}
                      title={t('admin.editSite')}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingSite(site)}
                      title={t('admin.deleteSite')}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Site */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('admin.addSite')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('admin.siteName')} *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Склад Центр / Филиал Дизенгоф..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('admin.siteRadius')}
            </label>
            <div className="flex gap-2">
              {[50, 100, 150, 200, 300, 500].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, radius: r })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    form.radius === r
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}м
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('admin.geofenceMap')}
            </label>
            <MapPicker
              lat={form.lat}
              lng={form.lng}
              radius={form.radius}
              onChange={(lat, lng, radius) => {
                setForm((prev) => ({
                  ...prev,
                  lat,
                  lng,
                  radius,
                }));
              }}
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
              {t('admin.addSite')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Site */}
      <Modal
        isOpen={!!editingSite}
        onClose={() => setEditingSite(null)}
        title={t('admin.editSite')}
      >
        {editingSite && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({ id: editingSite.id!, body: editingSite });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.siteName')} *
              </label>
              <input
                type="text"
                required
                value={editingSite.name}
                onChange={(e) => setEditingSite({ ...editingSite, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.siteRadius')}
              </label>
              <div className="flex gap-2">
                {[50, 100, 150, 200, 300, 500].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditingSite({ ...editingSite, radius: r })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                      editingSite.radius === r
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}м
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.geofenceMap')}
              </label>
              <MapPicker
                lat={editingSite.lat}
                lng={editingSite.lng}
                radius={editingSite.radius}
                onChange={(lat, lng, radius) => {
                  setEditingSite((prev) =>
                    prev
                      ? {
                          ...prev,
                          lat,
                          lng,
                          radius,
                        }
                      : null
                  );
                }}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingSite(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
              >
                {t('admin.cancel')}
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('admin.save')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Assign Employees to Site */}
      <Modal
        isOpen={!!assigningSite}
        onClose={() => setAssigningSite(null)}
        title={`${t('admin.manageAssignedEmployees')}: ${assigningSite?.name || ''}`}
      >
        {assigningSite && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Выберите сотрудников, которым разрешено отмечать начало и завершение смены на этом объекте:
            </p>

            <div className="max-h-72 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/60">
              {employees.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-4">
                  Нет сотрудников для назначения
                </div>
              ) : (
                employees.map((emp: any) => {
                  const isAssigned = assigningSite.employees?.some(
                    (es: any) => es.employee.id === emp.id
                  );

                  return (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 cursor-pointer transition border border-slate-800/60"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            let currentEmpIds: number[] =
                              assigningSite.employees?.map((es: any) => es.employee.id) || [];
                            if (checked) {
                              currentEmpIds = [...currentEmpIds, emp.id];
                            } else {
                              currentEmpIds = currentEmpIds.filter((id) => id !== emp.id);
                            }
                            setAssigningSite({
                              ...assigningSite,
                              employees: currentEmpIds.map((id) => ({
                                employee: employees.find((x: any) => x.id === id) || { id },
                              })),
                            });
                          }}
                          className="w-4 h-4 text-emerald-500 rounded bg-slate-950 border-slate-700 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <div>
                          <div className="text-sm font-semibold text-white">{emp.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {emp.empId}</div>
                        </div>
                      </div>

                      {emp.isMobile && (
                        <Badge variant="blue">{t('admin.mobile')}</Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setAssigningSite(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
              >
                {t('admin.cancel')}
              </button>
              <button
                type="button"
                disabled={assignMutation.isPending}
                onClick={() => {
                  const empIds: number[] =
                    assigningSite.employees?.map((es: any) => es.employee.id) || [];
                  assignMutation.mutate({ siteId: assigningSite.id, employeeIds: empIds });
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('admin.saveEmployee')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Delete Site Confirmation */}
      <Modal
        isOpen={!!deletingSite}
        onClose={() => setDeletingSite(null)}
        title={t('admin.deleteSite')}
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">
                  Удалить объект «{deletingSite?.name}»?
                </p>
                <p className="text-xs text-rose-300/80 mt-1">
                  Объект будет удалён из системы. Связанные сотрудники продолжат работать, но потеряют геопривязку к этому объекту.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeletingSite(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
            >
              {t('admin.cancel')}
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deletingSite && deleteMutation.mutate(deletingSite.id)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-rose-950"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('admin.deleteSite')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ClientSitesTab;
