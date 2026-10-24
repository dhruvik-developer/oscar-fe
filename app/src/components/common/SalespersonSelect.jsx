import { useEffect, useState } from 'react';

import { api } from '../../services/api';

/**
 * Salesperson picker fed by HRMS employees (Oscar letter pad §11, §12).
 *
 * The chosen employee is stored on the sales document as `salesperson_fk`,
 * which is what the incentive engine and salesperson reports read. Uses the
 * names-only `/hrms/employees/colleagues/` list, so sales users need no HRMS
 * permission to pick one.
 */
let cache = null;

function loadSalespeople() {
  if (!cache) {
    cache = api
      .get('/hrms/employees/colleagues/')
      .then((res) => {
        const rows = Array.isArray(res) ? res : res?.results || [];
        const isSales = (e) => /sales/i.test(`${e.department} ${e.designation}`);
        return [...rows].sort((a, b) => (isSales(b) - isSales(a)) || a.name.localeCompare(b.name));
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export default function SalespersonSelect({ value, name, onChange, className = '', disabled = false }) {
  const [people, setPeople] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSalespeople()
      .then((rows) => alive && setPeople(rows))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  // Older documents may carry only a name; keep it selectable.
  const selectedId = value || people.find((p) => p.name === name)?.id || '';
  const orphanName = !selectedId && name ? name : '';

  return (
    <select
      value={selectedId || (orphanName ? `name:${orphanName}` : '')}
      disabled={disabled}
      className={className}
      onChange={(e) => {
        const person = people.find((p) => p.id === e.target.value);
        onChange(person ? { id: person.id, name: person.name } : { id: '', name: '' });
      }}
    >
      <option value="">{failed ? 'Salesperson list unavailable' : 'Select salesperson'}</option>
      {orphanName && <option value={`name:${orphanName}`}>{orphanName}</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}{p.designation ? ` · ${p.designation}` : ''}
        </option>
      ))}
    </select>
  );
}
