import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { hrmsSync, isBackendEnabled, describeError } from '../../../services/hrmsSync';
import { Plus, MapPin, Search, Edit2, Trash2, Building } from 'lucide-react';

const TYPES = ['Headquarters', 'Branch', 'Factory', 'Warehouse', 'Remote'];
const EMPTY_LOCATION = { name: '', address: '', timezone: 'IST — UTC+5:30', type: 'Branch' };

function formatAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    const parts = [
      addr.line,
      addr.line1,
      addr.line2,
      addr.city,
      addr.state,
      addr.pincode,
      addr.country,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    const vals = Object.values(addr).filter((v) => typeof v === 'string' && v.trim());
    return vals.join(', ');
  }
  return String(addr);
}

export function LocationsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [form, setForm] = useState(EMPTY_LOCATION);
  const [saving, setSaving] = useState(false);

  async function loadLocations() {
    try {
      setLoading(true);
      const rows = await hrmsSync.pull('locations');
      if (Array.isArray(rows)) {
        setLocations(rows);
      }
    } catch (err) {
      console.warn('[LocationsPage] Failed to pull locations:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = locations.filter((l) => {
    if (!term) return true;
    const nameMatch = String(l.name ?? '').toLowerCase().includes(term);
    const addrMatch = formatAddress(l.address).toLowerCase().includes(term);
    const typeMatch = String(l.type ?? '').toLowerCase().includes(term);
    return nameMatch || addrMatch || typeMatch;
  });

  function openCreate() {
    setEditingLoc(null);
    setForm(EMPTY_LOCATION);
    setModalOpen(true);
  }

  function openEdit(loc) {
    setEditingLoc(loc);
    setForm({
      name: loc.name || '',
      address: formatAddress(loc.address),
      type: loc.type || 'Branch',
      timezone: loc.timezone || 'IST — UTC+5:30',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      if (editingLoc) {
        // Edit existing
        const patch = {
          name: form.name.trim(),
          address: form.address.trim(),
          type: form.type,
          timezone: form.timezone,
        };
        setLocations((prev) =>
          prev.map((l) => (l.id === editingLoc.id ? { ...l, ...patch } : l))
        );
        if (isBackendEnabled()) {
          await hrmsSync.update('locations', editingLoc.id, patch);
        }
        showToast(`Location "${form.name}" updated successfully`);
      } else {
        // Create new
        const newRecord = {
          name: form.name.trim(),
          address: form.address.trim(),
          type: form.type,
          timezone: form.timezone,
          employees: 0,
        };
        const optimistic = { id: `LOC-${Date.now()}`, ...newRecord };
        setLocations((prev) => [optimistic, ...prev]);

        if (isBackendEnabled()) {
          const saved = await hrmsSync.create('locations', newRecord);
          if (saved?.id) {
            setLocations((prev) =>
              prev.map((l) => (l.id === optimistic.id ? saved : l))
            );
          }
        }
        showToast(`Location "${form.name}" added successfully`);
      }
      setModalOpen(false);
      setEditingLoc(null);
      setForm(EMPTY_LOCATION);
    } catch (err) {
      showToast(`Failed to save location — ${describeError(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    const previous = [...locations];
    setLocations((prev) => prev.filter((x) => x.id !== id));
    try {
      if (isBackendEnabled()) {
        await hrmsSync.remove('locations', id);
      }
      showToast(`Location "${name}" removed`);
    } catch (err) {
      setLocations(previous);
      showToast(`Failed to delete location — ${describeError(err)}`, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locations"
        subtitle={`${locations.length} global offices and distributed workspaces`}
        guide={hrmsGuides.locations}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="px-5 py-2.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13.5px] font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} /> Add Location
          </button>
        }
      />

      {/* Search Bar */}
      <div className="bg-white border border-bdr rounded-xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search location by name or address..."
            className="pl-9 pr-4 h-9 w-full sm:w-72 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
          />
        </div>
      </div>

      {/* Grid of Location Cards */}
      {loading ? (
        <div className="py-16 text-center text-muted text-sm bg-white border border-bdr rounded-xl">
          Loading locations…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted text-[13px] bg-white border border-bdr rounded-xl">
          {q ? `No locations matching "${q}"` : 'No locations found. Add the first location to get started.'}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((l) => {
            const formattedAddr = formatAddress(l.address);
            const staffCount = l.employees ?? l.employeeCount ?? l.count ?? 0;
            return (
              <div
                key={l.id}
                className="bg-white border border-bdr rounded-xl p-5 shadow-xs hover:border-slate-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-off border border-bdr grid place-items-center text-navy shrink-0">
                        <Building size={17} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[15px] text-slate-900 truncate">{l.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-off border border-bdr text-slate-600">
                          {l.type || 'Branch'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(l)}
                        className="w-8 h-8 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(l.id, l.name)}
                        className="w-8 h-8 rounded-lg border border-bdr hover:bg-red-50 text-muted hover:text-red-600 grid place-items-center transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="text-[13px] text-muted flex items-start gap-1.5 mt-3.5">
                    <MapPin size={15} className="shrink-0 mt-0.5 text-navy" />
                    <span>{formattedAddr || 'No address specified'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-bdr/60 text-[11px]">
                  <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                    {l.timezone || 'IST — UTC+5:30'}
                  </span>
                  <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                    {staffCount} staff member{staffCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Location */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLoc ? 'Edit Office Location' : 'Add Office Location'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Office Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Surat Mill / Mumbai HQ"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Street Address
            </label>
            <input
              type="text"
              placeholder="e.g. Plot 12, GIDC Sachin, Surat, Gujarat"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Office Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Timezone
              </label>
              <input
                type="text"
                placeholder="e.g. IST — UTC+5:30"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingLoc ? 'Update Location' : 'Save Location'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const Locations = LocationsPage;
export default LocationsPage;
