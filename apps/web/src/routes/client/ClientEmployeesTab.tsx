import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { MapPicker } from '../../components/MapPicker';
import {
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  Copy,
  Check,
  Search,
  Loader2,
  LogOut,
  MapPin,
  Edit2,
  Building2,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface ClientEmployeesTabProps {
  userRole?: string;
}

export function ClientEmployeesTab({ userRole }: ClientEmployeesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [qrEmployee, setQrEmployee] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [form, setForm] = useState({
    empId: '',
    name: '',
    isMobile: false,
    strictGps: false,
    autoCloseShift: false,
    foremanId: '',
    siteIds: [] as string[],
    geofenceLat: 32.0853,
    geofenceLng: 34.7818,
    geofenceRadius: 100,
    geofenceAddress: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    newEmpId: '',
    isMobile: false,
    strictGps: false,
    autoCloseShift: false,
    foremanId: '',
    siteIds: [] as string[],
    geofenceLat: 32.0853,
    geofenceLng: 34.7818,
    geofenceRadius: 100,
    geofenceAddress: '',
  });

  // Queries
  const { data: empData, isLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  const { data: sitesData } = useQuery({
    queryKey: ['client-sites'],
    queryFn: () => apiRequest<{ sites: any[] }>('/api/client/sites'),
  });

  const { data: foremenData } = useQuery({
    queryKey: ['client-foremen'],
    queryFn: () => apiRequest<{ foremen: any[] }>('/api/client/foremen'),
    enabled: userRole === 'client',
  });

  const sites = sitesData?.sites || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/employees', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      queryClient.invalidateQueries({ queryKey: ['client-sites'] });
      setIsCreateOpen(false);
      setForm({
        empId: '',
        name: '',
        isMobile: false,
        strictGps: false,
        autoCloseShift: false,
        foremanId: '',
        siteIds: [],
        geofenceLat: 32.0853,
        geofenceLng: 34.7818,
        geofenceRadius: 100,
        geofenceAddress: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ empId, body }: { empId: string; body: any }) =>
      apiRequest(`/api/client/employees/${empId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      queryClient.invalidateQueries({ queryKey: ['client-sites'] });
      setEditingEmp(null);
    },
  });

  const toggleMobileMutation = useMutation({
    mutationFn: (empId: string) =>
      apiRequest(`/api/client/employees/${empId}/mobile`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-employees'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (empId: string) =>
      apiRequest(`/api/client/employees/${empId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-employees'] }),
  });

  const forceExitMutation = useMutation({
    mutationFn: (empDbId: number) =>
      apiRequest(`/api/client/employees/${empDbId}/force-exit`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-employees'] }),
  });

  const employees = empData?.employees || [];
  const foremen = foremenData?.foremen || [];

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.empId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyQrLink = (empId: string) => {
    const url = `${window.location.origin}/w/${empId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{t('admin.employeesTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.employeesSubtitle')}
          </p>
        </div>

        {(userRole === 'client' || userRole === 'foreman') && (
          <button
            onClick={() => {
              const randomEmpId = `E${Math.floor(1000 + Math.random() * 9000)}`;
              setForm((prev) => ({ ...prev, empId: randomEmpId, siteIds: [] }));
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            {t('admin.addEmployee')}
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('admin.searchEmpPlaceholder')}
          className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Table */}
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
                  <th className="p-4">{t('admin.thEmployee')}</th>
                  <th className="p-4">{t('admin.linkId')}</th>
                  <th className="p-4">{t('admin.shiftStatus')}</th>
                  <th className="p-4">{t('admin.gpsMode')}</th>
                  <th className="p-4">{t('admin.geofence')}</th>
                  <th className="p-4">{t('admin.foreman')}</th>
                  <th className="p-4 text-right">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      {t('admin.noEmployeesFound')}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-semibold text-white">{emp.name}</td>
                      <td className="p-4">
                        <code className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-xs text-emerald-400 font-mono">
                          {emp.empId}
                        </code>
                      </td>
                      <td className="p-4">
                        {emp.isOnShift ? (
                          <Badge variant="emerald" dot>{t('admin.onShift')}</Badge>
                        ) : (
                          <Badge variant="slate">{t('admin.offShift')}</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          {emp.isMobile ? (
                            <Badge variant="blue">{t('admin.mobile')}</Badge>
                          ) : emp.strictGps ? (
                            <Badge variant="amber">{t('admin.strictGps')}</Badge>
                          ) : (
                            <Badge variant="slate">{t('admin.standardGps')}</Badge>
                          )}
                          {emp.autoCloseShift && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20" title={t('admin.empAutoCloseShift')}>
                              <Clock className="w-2.5 h-2.5" />
                              <span>{t('admin.empAutoCloseShift')}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {emp.isMobile ? (
                          <span className="text-slate-500">{t('admin.everywhereNoGeo')}</span>
                        ) : emp.sites && emp.sites.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {emp.sites.map((es: any) => (
                              <span
                                key={es.id || es.siteId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[11px]"
                              >
                                <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="truncate max-w-[120px]">
                                  {es.site?.name || t('admin.workSite')}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : emp.geofence ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            {emp.geofence.address || `${emp.geofence.radius} ${t('admin.metersUnit')}`}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-300">
                        {emp.foreman?.name || '—'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingEmp(emp);
                              const assignedSiteIds =
                                emp.sites?.map((es: any) => es.siteId || es.site?.id) || [];
                              const primarySite = sites.find((s: any) => assignedSiteIds.includes(s.id));
                              const isDefaultTelAviv =
                                !emp.geofence ||
                                (Math.abs((emp.geofence.lat || 0) - 32.0853) < 0.001 &&
                                 Math.abs((emp.geofence.lng || 0) - 34.7818) < 0.001);

                              const initialLat =
                                primarySite && isDefaultTelAviv && primarySite.lat
                                  ? primarySite.lat
                                  : emp.geofence?.lat || primarySite?.lat || 32.0853;
                              const initialLng =
                                primarySite && isDefaultTelAviv && primarySite.lng
                                  ? primarySite.lng
                                  : emp.geofence?.lng || primarySite?.lng || 34.7818;
                              const initialRadius =
                                primarySite && isDefaultTelAviv && primarySite.radius
                                  ? primarySite.radius
                                  : emp.geofence?.radius || primarySite?.radius || 100;
                              const initialAddress =
                                primarySite && isDefaultTelAviv
                                  ? primarySite.address || primarySite.name
                                  : emp.geofence?.address || primarySite?.address || '';

                              setEditForm({
                                name: emp.name,
                                newEmpId: emp.empId,
                                isMobile: !!emp.isMobile,
                                strictGps: !!emp.strictGps,
                                autoCloseShift: !!emp.autoCloseShift,
                                foremanId: emp.foremanId || '',
                                siteIds: assignedSiteIds,
                                geofenceLat: initialLat,
                                geofenceLng: initialLng,
                                geofenceRadius: initialRadius,
                                geofenceAddress: initialAddress,
                              });
                            }}
                            title={t('admin.editEmployee')}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setQrEmployee(emp)}
                            title={t('admin.connectSmartphone')}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleMobileMutation.mutate(emp.empId)}
                            title={t('admin.toggleMobile')}
                            className={`p-1.5 rounded-lg hover:bg-slate-800 transition ${
                              emp.isMobile
                                ? 'text-blue-400 hover:text-slate-400'
                                : 'text-slate-400 hover:text-blue-400'
                            }`}
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                          {emp.isOnShift && (
                            <button
                              onClick={() => forceExitMutation.mutate(emp.id)}
                              title={t('admin.forceCloseShift')}
                              className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-slate-800 transition"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}
                          {userRole === 'client' && (
                            <button
                              onClick={() => deleteMutation.mutate(emp.empId)}
                              title={t('admin.deleteEmployee')}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Modal: Create Employee with Geofence Map */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('admin.newEmployee')}
        maxWidth="max-w-xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              empId: form.empId,
              name: form.name,
              isMobile: form.isMobile,
              strictGps: form.strictGps,
              autoCloseShift: form.autoCloseShift,
              foremanId: form.foremanId || null,
              siteIds: form.siteIds,
              geofence: form.isMobile
                ? null
                : {
                    lat: form.geofenceLat,
                    lng: form.geofenceLng,
                    radius: form.geofenceRadius,
                    address: form.geofenceAddress || null,
                  },
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.empFullName')}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                placeholder={t('admin.empNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.empLinkIdField')}
              </label>
              <input
                type="text"
                required
                value={form.empId}
                onChange={(e) => setForm({ ...form, empId: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                placeholder="E101"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMobile}
                onChange={(e) => setForm({ ...form, isMobile: e.target.checked })}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-white">{t('admin.empMobileNoGeo')}</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.strictGps}
                onChange={(e) => setForm({ ...form, strictGps: e.target.checked })}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-white">{t('admin.empStrictMode')}</span>
            </label>
          </div>

          {/* Auto Close Shift Option */}
          <label className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition">
            <input
              type="checkbox"
              checked={form.autoCloseShift}
              onChange={(e) => setForm({ ...form, autoCloseShift: e.target.checked })}
              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 mt-0.5"
            />
            <div className="flex flex-col">
              <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {t('admin.empAutoCloseShift')}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                {t('admin.empAutoCloseShiftDesc')}
              </span>
            </div>
          </label>

          {userRole === 'client' && foremen.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('admin.empForemanSelect')}
              </label>
              <select
                value={form.foremanId}
                onChange={(e) => setForm({ ...form, foremanId: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              >
                <option value="">{t('admin.empNoForeman')}</option>
                {foremen.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sites Selection */}
          {!form.isMobile && sites.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('admin.selectSites')}
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                {sites.map((s) => {
                  const isChecked = form.siteIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                        isChecked
                          ? 'bg-emerald-950/40 border border-emerald-700/50 text-white'
                          : 'bg-slate-900/60 border border-slate-800/60 text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm((prev) => ({
                                ...prev,
                                siteIds: [...prev.siteIds, s.id],
                                ...(s.lat && s.lng
                                  ? {
                                      geofenceLat: s.lat,
                                      geofenceLng: s.lng,
                                      geofenceRadius: s.radius || prev.geofenceRadius,
                                      geofenceAddress: s.address || s.name,
                                    }
                                  : {}),
                              }));
                            } else {
                              const remaining = form.siteIds.filter((id) => id !== s.id);
                              const fallbackSite = sites.find((x: any) => remaining.includes(x.id));
                              setForm((prev) => ({
                                ...prev,
                                siteIds: remaining,
                                ...(fallbackSite && fallbackSite.lat && fallbackSite.lng
                                  ? {
                                      geofenceLat: fallbackSite.lat,
                                      geofenceLng: fallbackSite.lng,
                                      geofenceRadius: fallbackSite.radius || prev.geofenceRadius,
                                      geofenceAddress: fallbackSite.address || fallbackSite.name,
                                    }
                                  : {}),
                              }));
                            }
                          }}
                          className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="font-semibold">{s.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                        {s.address || `${s.radius} ${t('admin.metersUnit')}`}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {form.siteIds.length > 0
                  ? t('admin.assignSitesHelp')
                  : t('admin.noSitesAssigned')}
              </p>
            </div>
          )}

          {/* Interactive Geofence Map */}
          {!form.isMobile && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    {form.siteIds.length > 0 ? t('admin.personalGeofence') : t('admin.geofenceMap')}
                  </label>
                  {form.siteIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetSite = sites.find((x: any) => form.siteIds.includes(x.id));
                        if (targetSite && targetSite.lat && targetSite.lng) {
                          setForm((prev) => ({
                            ...prev,
                            geofenceLat: targetSite.lat,
                            geofenceLng: targetSite.lng,
                            geofenceRadius: targetSite.radius || 100,
                            geofenceAddress: targetSite.address || targetSite.name,
                          }));
                        }
                      }}
                      className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-medium transition flex items-center gap-1"
                      title={t('admin.syncWithSiteHelp', 'Синхронизировать геозону с выбранным объектом')}
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>{t('admin.syncWithSite', 'Синхронизировать с объектом')}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{t('admin.radiusLabel')}</span>
                  <input
                    type="number"
                    min="20"
                    max="5000"
                    step="10"
                    value={form.geofenceRadius}
                    onChange={(e) =>
                      setForm({ ...form, geofenceRadius: parseInt(e.target.value) || 100 })
                    }
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono"
                  />
                  <span className="text-xs text-slate-400">{t('admin.metersUnit')}</span>
                </div>
              </div>

              <MapPicker
                lat={form.geofenceLat}
                lng={form.geofenceLng}
                radius={form.geofenceRadius}
                onChange={(lat, lng, radius) =>
                  setForm((prev) => ({
                    ...prev,
                    geofenceLat: lat,
                    geofenceLng: lng,
                    geofenceRadius: radius,
                  }))
                }
                onAddressFound={(addr) =>
                  setForm((prev) => ({
                    ...prev,
                    geofenceAddress: addr,
                  }))
                }
              />

              <div>
                <input
                  type="text"
                  value={form.geofenceAddress}
                  onChange={(e) => setForm({ ...form, geofenceAddress: e.target.value })}
                  placeholder={t('admin.empAddressPlaceholder')}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>
            </div>
          )}

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

      {/* Modal: Edit Employee */}
      <Modal
        isOpen={!!editingEmp}
        onClose={() => setEditingEmp(null)}
        title={t('admin.editEmployee')}
        maxWidth="max-w-xl"
      >
        {editingEmp && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                empId: editingEmp.empId,
                body: {
                  name: editForm.name,
                  newEmpId: editForm.newEmpId,
                  isMobile: editForm.isMobile,
                  strictGps: editForm.strictGps,
                  autoCloseShift: editForm.autoCloseShift,
                  foremanId: editForm.foremanId || null,
                  siteIds: editForm.siteIds,
                  geofence: editForm.isMobile
                    ? null
                    : {
                        lat: editForm.geofenceLat,
                        lng: editForm.geofenceLng,
                        radius: editForm.geofenceRadius,
                        address: editForm.geofenceAddress || null,
                      },
                },
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('admin.empFullName')}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('admin.empLinkIdField')}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.newEmpId}
                  onChange={(e) => setEditForm({ ...editForm, newEmpId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isMobile}
                  onChange={(e) => setEditForm({ ...editForm, isMobile: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-white">{t('admin.empMobileNoGeo')}</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.strictGps}
                  onChange={(e) => setEditForm({ ...editForm, strictGps: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-white">{t('admin.empStrictMode')}</span>
              </label>
            </div>

            {/* Auto Close Shift Option */}
            <label className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition">
              <input
                type="checkbox"
                checked={editForm.autoCloseShift}
                onChange={(e) => setEditForm({ ...editForm, autoCloseShift: e.target.checked })}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 mt-0.5"
              />
              <div className="flex flex-col">
                <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {t('admin.empAutoCloseShift')}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {t('admin.empAutoCloseShiftDesc')}
                </span>
              </div>
            </label>

            {userRole === 'client' && foremen.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('admin.empForemanSelect')}
                </label>
                <select
                  value={editForm.foremanId}
                  onChange={(e) => setEditForm({ ...editForm, foremanId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                >
                  <option value="">{t('admin.empNoForeman')}</option>
                  {foremen.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sites Selection */}
            {!editForm.isMobile && sites.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t('admin.selectSites')}
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                  {sites.map((s) => {
                    const isChecked = editForm.siteIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                          isChecked
                            ? 'bg-emerald-950/40 border border-emerald-700/50 text-white'
                            : 'bg-slate-900/60 border border-slate-800/60 text-slate-300 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm((prev) => ({
                                  ...prev,
                                  siteIds: [...prev.siteIds, s.id],
                                  ...(s.lat && s.lng
                                    ? {
                                        geofenceLat: s.lat,
                                        geofenceLng: s.lng,
                                        geofenceRadius: s.radius || prev.geofenceRadius,
                                        geofenceAddress: s.address || s.name,
                                      }
                                    : {}),
                                }));
                              } else {
                                const remaining = editForm.siteIds.filter((id) => id !== s.id);
                                const fallbackSite = sites.find((x: any) => remaining.includes(x.id));
                                setEditForm((prev) => ({
                                  ...prev,
                                  siteIds: remaining,
                                  ...(fallbackSite && fallbackSite.lat && fallbackSite.lng
                                    ? {
                                        geofenceLat: fallbackSite.lat,
                                        geofenceLng: fallbackSite.lng,
                                        geofenceRadius: fallbackSite.radius || prev.geofenceRadius,
                                        geofenceAddress: fallbackSite.address || fallbackSite.name,
                                      }
                                    : {}),
                                }));
                              }
                            }}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="font-semibold">{s.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                          {s.address || `${s.radius} ${t('admin.metersUnit')}`}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {editForm.siteIds.length > 0
                    ? t('admin.assignSitesHelp')
                    : t('admin.noSitesAssigned')}
                </p>
              </div>
            )}

            {/* Interactive Geofence Map */}
            {!editForm.isMobile && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      {editForm.siteIds.length > 0 ? t('admin.personalGeofence') : t('admin.geofenceMap')}
                    </label>
                    {editForm.siteIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetSite = sites.find((x: any) => editForm.siteIds.includes(x.id));
                          if (targetSite && targetSite.lat && targetSite.lng) {
                            setEditForm((prev) => ({
                              ...prev,
                              geofenceLat: targetSite.lat,
                              geofenceLng: targetSite.lng,
                              geofenceRadius: targetSite.radius || 100,
                              geofenceAddress: targetSite.address || targetSite.name,
                            }));
                          }
                        }}
                        className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-medium transition flex items-center gap-1"
                        title={t('admin.syncWithSiteHelp', 'Синхронизировать геозону с выбранным объектом')}
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>{t('admin.syncWithSite', 'Синхронизировать с объектом')}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{t('admin.radiusLabel')}</span>
                    <input
                      type="number"
                      min="20"
                      max="5000"
                      step="10"
                      value={editForm.geofenceRadius}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          geofenceRadius: parseInt(e.target.value) || 100,
                        })
                      }
                      className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono"
                    />
                    <span className="text-xs text-slate-400">{t('admin.metersUnit')}</span>
                  </div>
                </div>

                <MapPicker
                  lat={editForm.geofenceLat}
                  lng={editForm.geofenceLng}
                  radius={editForm.geofenceRadius}
                  onChange={(lat, lng, radius) =>
                    setEditForm((prev) => ({
                      ...prev,
                      geofenceLat: lat,
                      geofenceLng: lng,
                      geofenceRadius: radius,
                    }))
                  }
                  onAddressFound={(addr) =>
                    setEditForm((prev) => ({
                      ...prev,
                      geofenceAddress: addr,
                    }))
                  }
                />

                <div>
                  <input
                    type="text"
                    value={editForm.geofenceAddress}
                    onChange={(e) => setEditForm({ ...editForm, geofenceAddress: e.target.value })}
                    placeholder={t('admin.empAddressPlaceholder')}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingEmp(null)}
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
                {t('admin.saveEmployee')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: QR Code Onboarding */}
      <Modal
        isOpen={!!qrEmployee}
        onClose={() => setQrEmployee(null)}
        title={t('admin.qrModalTitle')}
      >
        {qrEmployee && (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-white rounded-2xl inline-block mx-auto shadow-xl">
              <QRCodeSVG
                value={`${window.location.origin}/w/${qrEmployee.empId}`}
                size={200}
                level="M"
              />
            </div>

            <div>
              <div className="text-sm font-bold text-white">{qrEmployee.name}</div>
              <div className="text-xs text-slate-400 mt-1">
                {t('admin.qrScanHelp')}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-400">
              <span className="truncate pr-2">{`${window.location.origin}/w/${qrEmployee.empId}`}</span>
              <button
                onClick={() => copyQrLink(qrEmployee.empId)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition shrink-0 flex items-center gap-1 text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t('admin.copied') : t('admin.copy')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
