import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/common/PageHeader';
import {
  usePmsStore,
  filterProjects,
  getProjectFilterOptions,
  emptyProjectFilters,
  hasActiveFilters,
} from '../../../stores/pmsStore';
import { ProjectFilterBar } from './components/ProjectFilterBar';
import { ProjectsTable } from './components/ProjectsTable';

/**
 * MyProjectsPage (/pms/my-projects) — the directory scoped to the signed-in PM.
 *
 * Same table and filter bar as the master directory; the only difference is the
 * pre-scope to projectManager.id === currentUserId, applied before the filter
 * bar so the counts and dropdowns reflect the user's own book of work.
 */
export default function MyProjectsPage() {
  const navigate = useNavigate();
  const projects = usePmsStore((s) => s.projects);
  const currentUserId = usePmsStore((s) => s.currentUserId);
  const employees = usePmsStore((s) => s.employees);

  const currentUser = useMemo(
    () => employees.find((e) => e.id === currentUserId) ?? null,
    [employees, currentUserId]
  );

  const mine = useMemo(
    () => projects.filter((p) => p.projectManager?.id === currentUserId),
    [projects, currentUserId]
  );

  const [filters, setFilters] = useState(emptyProjectFilters);

  const options = useMemo(() => getProjectFilterOptions(mine), [mine]);
  const visible = useMemo(() => filterProjects(mine, filters), [mine, filters]);
  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Projects"
        subtitle={
          currentUser
            ? `Projects where ${currentUser?.name} is the assigned project manager.`
            : 'Projects assigned to you as project manager.'
        }
      />

      <ProjectFilterBar
        filters={filters}
        options={options}
        allProjects={mine}
        onChange={setFilters}
        onReset={() => setFilters(emptyProjectFilters())}
        isFiltered={isFiltered}
        resultCount={visible.length}
        totalCount={mine.length}
      />

      <ProjectsTable
        projects={visible}
        emptyTitle={isFiltered ? 'No projects match these filters' : 'Nothing assigned to you'}
        emptyDesc={
          isFiltered
            ? 'Try widening the search or clearing a filter.'
            : 'Projects where you are the assigned project manager will appear here.'
        }
        onQuickAssign={(row) => navigate(`/pms/projects/${row.id}`)}
        onLogDelay={(row) => navigate(`/pms/delays?project=${row.id}`)}
      />
    </div>
  );
}
