import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { hrmsSync, isBackendEnabled } from '../../../services/hrmsSync';
import { Plus, MapPin, Search, Edit2, Trash2, Globe, Building } from 'lucide-react';

const EMPTY_LOCATION = { name: '', address: '', timezone: 'IST • UTC+5:30', type: 'Branch' };

export function LocationsPage() {
  const showToast = useAppStore((s) => s.showToast);
  // Real offices only: the page used to fall back to sample New York / London
  // rows, which looked like data and could not be edited or deleted.
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLoc, setNewLoc] = useState(EMPTY_LOCATION);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await hrmsSync.pull('locations');
        if (active && Array.isArray(rows)) {
          setLocations(rows);
        }
      } catch (err) {
        console.warn('[LocationsPage] Failed to pull locations:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = locations.filter((l) =>
    String(l.name ?? '').toLowerCase().includes(q.toLowerCase()) ||
    String(l.address ?? '').toLowerCase().includes(q.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!newLoc.name.trim()) return;
    const created = { id: `LOC-0${locations.length + 1}`, ...newLoc, count: 0 };
    setLocations([
      ...locations,
      created,
    ]);
    try {
      if (isBackendEnabled()) {
        const saved = await hrmsSync.create('locations', created);
        if (saved?.id) {
          setLocations((prev) => prev.map((l) => (l.id === created.id ? saved : l)));
        }
      }
    } catch (err) {
      console.warn('[LocationsPage] Failed to create location on server:', err);
    }
    showToast(`Location "${newLoc.name}" added successfully`);
    setIsModalOpen(false);
    setNewLoc(EMPTY_LOCATION);
  }

  async function handleDelete(id, name) {
    setLocations(locations.filter((x) => x.id !== id));
    try {
      if (isBackendEnabled()) {
        await hrmsSync.remove('locations', id);
      }
    } catch (err) {
      console.warn('[LocationsPage] Failed to delete location on server:', err);
    }
    showToast(`Location "${name}" removed`);
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
            onClick={() => setIsModalOpen(true)}
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
          {filtered.map((l) => (
            <div
              key={l.id}
              className="bg-white border border-bdr rounded-xl p-5 shadow-xs hover:border-slate-400 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-off border border-bdr grid place-items-center text-navy shrink-0">
                      <Building size={17} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px] text-slate-900">{l.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-off border border-bdr text-slate-600">
                        {l.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => showToast(`Edit ${l.name}`)}
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
                  <span>{l.address}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-bdr/60 text-[11px]">
                <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                  {l.timezone}
                </span>
                <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                  {l.count || 0} staff members
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Location */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Office Location">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Office Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Singapore Innovation Hub"
              value={newLoc.name}
              onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Street Address
            </label>
            <input
              type="text"
              placeholder="e.g. 1 Marina Boulevard, Singapore"
              value={newLoc.address}
              onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Office Type
              </label>
              <select
                value={newLoc.type}
                onChange={(e) => setNewLoc({ ...newLoc, type: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              >
                <option>Headquarters</option>
                <option>Branch</option>
                <option>Tech Hub</option>
                <option>Remote</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Timezone
              </label>
              <input
                type="text"
                placeholder="e.g. SGT • UTC+8"
                value={newLoc.timezone}
                onChange={(e) => setNewLoc({ ...newLoc, timezone: e.target.value })}
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Save Location
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const Locations = LocationsPage;
export default LocationsPage;
