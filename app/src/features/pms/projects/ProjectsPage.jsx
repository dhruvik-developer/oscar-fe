import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Info, ChevronRight } from 'lucide-react';
import {
  usePmsStore,
  filterProjects,
  getProjectFilterOptions,
  emptyProjectFilters,
  hasActiveFilters,
} from '../../../stores/pmsStore';
import { ProjectFilterBar } from './components/ProjectFilterBar';
import { ProjectsTable } from './components/ProjectsTable';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ConfigureStagePercentagesModal } from './components/ConfigureStagePercentagesModal';
import { PmsToast } from '../components/PmsToast';

/**
 * ProjectsPage (/pms/projects) — the master textile fabric project directory.
 */
export default function ProjectsPage() {
  const navigate = useNavigate();
  const projects = usePmsStore((s) => s.projects);
  const hydrate = usePmsStore((s) => s.hydrate);

  const [filters, setFilters] = useState(emptyProjectFilters);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [configurePercentagesProject, setConfigurePercentagesProject] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    hydrate({ force: true });
  }, [hydrate]);

  const options = useMemo(() => getProjectFilterOptions(projects), [projects]);
  const visible = useMemo(() => filterProjects(projects, filters), [projects, filters]);
  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation matching reference UI */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <span className="hover:text-slate-800 cursor-pointer" onClick={() => navigate('/dashboard')}>
          Dashboard
        </span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="hover:text-slate-800 cursor-pointer" onClick={() => navigate('/pms/dashboard')}>
          PMS
        </span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-900 font-semibold">Projects</span>
      </nav>

      {/* Header matching reference UI */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">All Projects</h1>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              title="PMS Projects Overview & Allocation Guide"
              className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <Info size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer and own fabric projects from quotation to dispatch.
          </p>
        </div>

        {/* Green + Create New Project button matching reference UI */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition cursor-pointer"
        >
          <Plus size={16} />
          Create New Project
        </button>
      </div>

      {/* Filter Bar with Status Tabs & Date Range */}
      <ProjectFilterBar
        filters={filters}
        options={options}
        allProjects={projects}
        onChange={setFilters}
        onReset={() => setFilters(emptyProjectFilters())}
        isFiltered={isFiltered}
        resultCount={visible.length}
        totalCount={projects.length}
      />

      {/* Projects Table matching the reference layout & columns */}
      <ProjectsTable
        projects={visible}
        emptyTitle={isFiltered ? 'No projects match these filters' : 'No projects yet'}
        emptyDesc={
          isFiltered
            ? 'Try widening the search, clearing a dropdown, or turning off "Delayed only".'
            : 'Create a project to get started.'
        }
        emptyAction={
          !isFiltered ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              <Plus size={14} />
              Create New Project
            </button>
          ) : null
        }
      />

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Info size={18} className="text-blue-600" />
              PMS Textile Project Directory
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This directory tracks end-to-end textile production orders. For each sales order or job work run:
            </p>
            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
              <li><strong>Requirement (m):</strong> Total ordered meterage for the customer.</li>
              <li><strong>Dyeing Sent (m):</strong> Total grey meters dispatched to dye house/processor.</li>
              <li><strong>Customer Project:</strong> Meterage received and allocated specifically to the customer order.</li>
              <li><strong>Own Project:</strong> Excess buffer meterage retained for own mill stock.</li>
            </ul>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          navigate(`/pms/projects/${id}`);
        }}
      />

      <ConfigureStagePercentagesModal
        isOpen={Boolean(configurePercentagesProject)}
        project={configurePercentagesProject}
        onClose={() => setConfigurePercentagesProject(null)}
      />

      <PmsToast />
    </div>
  );
}
