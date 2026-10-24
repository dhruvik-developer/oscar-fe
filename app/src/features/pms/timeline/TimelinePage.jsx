import React, { useMemo, useState } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import {
  usePmsStore,
  computeTimelineRows,
  computeTimelineWindow,
  getProjectManagers,
} from '../../../stores/pmsStore';
import { TimelineFilterBar } from './components/TimelineFilterBar';
import { TimelineGanttChart } from './components/TimelineGanttChart';

/**
 * TimelinePage (/pms/timeline) — the cross-project Gantt.
 *
 * Filtering narrows which projects are drawn but the time window is recomputed
 * from what survives, so a filtered view fills the width instead of leaving the
 * bars squashed into a corner of the original span.
 */

const EMPTY = { department: 'all', projectManagerId: 'all', status: 'all' };

export default function TimelinePage() {
  const projects = usePmsStore((s) => s.projects);
  const employees = usePmsStore((s) => s.employees);

  const [filters, setFilters] = useState(EMPTY);

  const allRows = useMemo(() => computeTimelineRows(projects), [projects]);

  const options = useMemo(() => {
    const departments = new Set();
    for (const row of allRows) {
      for (const bar of row.bars) if (bar.department) departments.add(bar.department);
    }
    return {
      departments: [...departments].sort((a, b) => a.localeCompare(b)),
      managers: getProjectManagers(employees),
    };
  }, [allRows, employees]);

  const visible = useMemo(() => {
    return allRows
      .filter((row) => {
        if (filters.projectManagerId !== 'all' && row.projectManagerId !== filters.projectManagerId) {
          return false;
        }
        if (filters.status !== 'all' && row.status !== filters.status) return false;
        if (filters.department !== 'all' && !row.bars.some((b) => b.department === filters.department)) {
          return false;
        }
        return true;
      })
      .map((row) =>
        // Narrowing by department shows only that department's spans.
        filters.department === 'all'
          ? row
          : { ...row, bars: row.bars.filter((b) => b.department === filters.department) }
      );
  }, [allRows, filters]);

  const window = useMemo(() => computeTimelineWindow(visible), [visible]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timeline & Gantt"
        subtitle="Stage spans across every active project on one shared time axis."
      />

      <TimelineFilterBar
        filters={filters}
        options={options}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY)}
        resultCount={visible.length}
        totalCount={allRows.length}
      />

      <TimelineGanttChart rows={visible} window={window} />
    </div>
  );
}
