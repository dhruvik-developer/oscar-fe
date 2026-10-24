import { useState, useMemo, useEffect } from "react";
import { Download, ChevronRight, ChevronLeft, ChevronDown, Trash2, Eye } from "lucide-react";
import EmployeeProfileModal from "./EmployeeProfileModal";
import Modal from "../../../components/ui/Modal";
import { useAppStore } from "../../../stores/appStore";
import PageHeader from "../../../components/ui/PageHeader";
import { Avatar } from "../../../components/hrms/Avatar";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

const DEPARTMENTS = ["All", "Engineering", "Design", "Marketing", "Finance", "HR", "Operations", "Sales"];
const STATUSES = ["All", "Active", "On Leave", "Probation"];

const statusStyles = {
  Active: { background: "#e6f4ea", color: "#15803d", border: "#a7f3d0" },
  "On Leave": { background: "#fef3c7", color: "#b45309", border: "#fde68a" },
  Probation: { background: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

export default function Employees() {
  const storeEmployees = useAppStore((s) => s.employees || []);
  const addStoreEmployee = useAppStore((s) => s.addEmployee);
  const deleteStoreEmployee = useAppStore((s) => s.deleteEmployee);
  const setToast = useAppStore((s) => s.setToast || s.showToast);
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [viewMode, setViewMode] = useState("Table");
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const pageSize = 5;

  useEffect(() => {
    useAppStore.getState().refreshHrms?.("employees");
  }, []);

  // Use store employees, normalized with img/avatar
  const employees = useMemo(() => {
    return storeEmployees.map((e) => ({
      ...e,
      img: e.img || e.avatar || null,
    }));
  }, [storeEmployees]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    designation: "Senior Engineer",
    dept: "Engineering",
    location: "Mumbai",
    managerId: "",
  });

  const filtered = useMemo(
    () =>
      employees.filter(
        (e) => (dept === "All" || e.department === dept) && (status === "All" || e.status === status)
      ),
    [employees, dept, status]
  );

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function handleAdd() {
    if (!form.name || !form.email) return setToast("Name and email are required.", "error");
    const managerRow = employees.find((x) => String(x.id) === String(form.managerId));
    const next = {
      name: form.name,
      email: form.email,
      designation: form.designation,
      department: form.dept,
      location: form.location,
      managerId: form.managerId || undefined,
      manager: managerRow?.name || undefined,
      reportingManager: managerRow?.name || undefined,
      reportingManagerId: form.managerId || undefined,
      joiningDate: new Date().toISOString().slice(0, 10),
      status: "Active",
      avatar: null,
    };
    addStoreEmployee(next).then((saved) => {
      if (saved) {
        setToast("Employee added successfully.");
        useAppStore.getState().refreshHrms?.("employees");
      }
    }).catch(() => {});
    setShowForm(false);
    setForm({ name: "", email: "", designation: "Senior Engineer", dept: "Engineering", location: "Mumbai", managerId: "" });
  }

  async function handleDelete(id, name) {
    if (!id) return setToast("Cannot delete — missing employee id.", "error");
    if (typeof window !== "undefined" && !window.confirm(`Delete employee ${name}? This cannot be undone.`)) return;
    try {
      await deleteStoreEmployee(id);
      useAppStore.getState().refreshHrms?.("employees");
      setToast(`Employee ${name} removed.`);
    } catch {
      // `deleteEmployee` already restored the row and toasted the reason.
    }
  }

  const handleExport = () => {
    const header = "ID,Name,Email,Designation,Department,Manager,Status";
    const rows = filtered.map((e) => `"${e.id}","${e.name}","${e.email}","${e.designation}","${e.department}","${e.manager || e.reportingManager || ""}","${e.status}"`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-directory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="emp-dir-page">
      <PageHeader
        title="Employee Directory"
        subtitle={`${filtered.length} employees • 12 departments`}
        guide={hrmsGuides.employees}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'HRMS' },
          { label: 'Employee Setup' },
        ]}
        actions={
          <>
            <button type="button" onClick={handleExport} className="emp-export-btn">
              <Download size={15} /> Export
            </button>
            <button type="button" onClick={() => setShowForm(true)} className="emp-add-btn">
              Add Employee
            </button>
          </>
        }
      />

      {/* Filter Card */}
      <div className="emp-card emp-filter-card">
        <div className="flex-wrap lg:flex-nowrap" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={`emp-filter-dropdown ${dept !== "All" ? "active" : ""}`}>
            <span className="emp-filter-text">
              {dept === "All" ? "Department" : dept}
            </span>
            <ChevronDown size={13} className="emp-filter-arrow" />
            <select
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setCurrentPage(1);
              }}
              className="emp-filter-native-select"
              aria-label="Department Filter"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className={`emp-filter-dropdown ${status !== "All" ? "active" : ""}`}>
            <span className="emp-filter-text">
              {status === "All" ? "Status" : status}
            </span>
            <ChevronDown size={13} className="emp-filter-arrow" />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="emp-filter-native-select"
              aria-label="Status Filter"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {(dept !== "All" || status !== "All") && (
            <button
              type="button"
              onClick={() => {
                setDept("All");
                setStatus("All");
                setCurrentPage(1);
              }}
              className="emp-btn-clear"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Table / Grid Toggle */}
        <div className="emp-tabs">
          <button
            type="button"
            onClick={() => setViewMode("Table")}
            className={viewMode === "Table" ? "emp-tab active" : "emp-tab"}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("Grid")}
            className={viewMode === "Grid" ? "emp-tab active" : "emp-tab"}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Main Table / Grid Card */}
      <div className="emp-card emp-main-card">
        {viewMode === "Table" ? (
          <div style={{ overflowX: "auto" }}>
            <table className="emp-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>ID</th>
                  <th>DESIGNATION</th>
                  <th>DEPARTMENT</th>
                  <th>MANAGER</th>
                  <th>STATUS</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((row) => (
                  <tr
                    key={row.id}
                    className="emp-row-clickable"
                    onClick={() => setSelectedEmployee(row)}
                    title="Click to view employee profile"
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar name={row.name} size="sm" />
                        <div>
                          <span className="emp-name-text">
                            {row.name}
                          </span>
                          <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{row.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="emp-id">{row.empId || row.employeeCode || row.id}</td>
                    <td style={{ color: "#374151" }}>{row.designation}</td>
                    <td style={{ color: "#374151" }}>{row.department}</td>
                    <td style={{ color: "#374151" }}>{row.manager || row.reportingManager || "—"}</td>
                    <td>
                      <span className="emp-status" style={{ ...statusStyles[row.status] }}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(row);
                          }}
                          className="emp-action-btn"
                          title="View Profile"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row.id, row.name);
                          }}
                          className="emp-trash-btn"
                          title="Delete employee"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                      No employees match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emp-grid-view">
            {paginatedEmployees.map((row) => (
              <div
                key={row.id}
                className="emp-grid-item emp-grid-clickable"
                onClick={() => setSelectedEmployee(row)}
                title="Click to view employee profile"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Avatar name={row.name} size="xl" />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmployee(row);
                      }}
                      className="emp-action-btn"
                      title="View Profile"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row.id, row.name);
                      }}
                      className="emp-trash-btn"
                      title="Delete employee"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <h3 className="emp-grid-name">
                  {row.name}
                </h3>
                <p style={{ margin: 0, fontSize: "12.5px", color: "#6b7280" }}>{row.email}</p>
                <div style={{ margin: "12px 0 10px", fontSize: "13px", color: "#374151" }}>
                  <strong>{row.designation}</strong> • {row.department}{(row.manager || row.reportingManager) ? ` • Mgr: ${row.manager || row.reportingManager}` : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <span className="emp-id">{row.empId || row.employeeCode || row.id}</span>
                  <span className="emp-status" style={{ ...statusStyles[row.status] }}>
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="emp-footer">
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            Showing {paginatedEmployees.length} of {filtered.length}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="emp-page-btn"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="emp-page-indicator">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="emp-page-btn"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Employee"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleAdd}>
              Add Employee
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                className="form-input"
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Email <span className="required">*</span>
              </label>
              <input
                className="form-input"
                type="email"
                placeholder="Enter email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={form.dept}
                onChange={(e) => setForm({ ...form, dept: e.target.value })}
              >
                {DEPARTMENTS.slice(1).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Manager (Reporting To)</label>
              <select
                className="form-select"
                value={form.managerId}
                onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              >
                <option value="">No manager</option>
                {employees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.department ? ` • ${m.department}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                className="form-input"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                className="form-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Employee Profile Detail Modal */}
      <EmployeeProfileModal
        isOpen={Boolean(selectedEmployee)}
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        onEmployeeUpdated={(updated) => {
          setSelectedEmployee(updated);
          useAppStore.getState().refreshHrms?.("employees");
        }}
      />

      <style>{`
        .emp-row-clickable { cursor: pointer; transition: background 0.12s ease; }
        .emp-row-clickable:hover { background: #f1f5f9 !important; }
        .emp-row-clickable:hover .emp-name-text { color: #2563eb !important; }
        .emp-name-text { font-weight: 600; color: #111827; display: inline-block; margin-right: 8px; transition: color 0.15s ease; }

        .emp-grid-clickable { cursor: pointer; transition: all 0.2s ease; }
        .emp-grid-clickable:hover { border-color: #94a3b8; box-shadow: 0 4px 14px rgba(15,23,42,0.08); transform: translateY(-1.5px); }
        .emp-grid-clickable:hover .emp-grid-name { color: #2563eb; }
        .emp-grid-name { margin: 10px 0 2px; font-size: 15px; font-weight: 700; color: #111827; transition: color 0.15s ease; }

        .emp-action-btn { border: none; background: transparent; color: #64748b; cursor: pointer; padding: 4px; border-radius: 6px; display: grid; place-items: center; transition: all 0.15s ease; }
        .emp-action-btn:hover { color: #0f172a; background: #e2e8f0; }
        .emp-dir-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .emp-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .emp-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .emp-title { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
        .emp-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
        .emp-export-btn { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 16px; font-size: 13.5px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .emp-export-btn:hover { background: #f9fafb; }
        .emp-add-btn { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .emp-add-btn:hover { background: #0f172a; }
        
        .emp-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .emp-filter-card { border: none; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        
        .emp-select { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 34px 7px 16px; font-size: 13.5px; color: #1e293b; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 13px; min-width: 110px; transition: border-color 0.15s ease; }
        .emp-select:focus { border-color: #94a3b8; }

        .emp-filter-dropdown { position: relative; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 14px; height: 36px; min-width: 130px; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; }
        .emp-filter-dropdown:hover { border-color: #cbd5e1; background: #f8fafc; }
        .emp-filter-dropdown.active { border-color: #3b82f6; background: #eff6ff; }
        .emp-filter-text { font-size: 13.5px; color: #1e293b; font-weight: 500; white-space: nowrap; user-select: none; }
        .emp-filter-dropdown.active .emp-filter-text { color: #1d4ed8; font-weight: 600; }
        .emp-filter-arrow { color: #64748b; flex-shrink: 0; pointer-events: none; }
        .emp-filter-dropdown.active .emp-filter-arrow { color: #2563eb; }
        .emp-filter-native-select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        .emp-btn-clear { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 12px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .emp-btn-clear:hover { background: #f8fafc; color: #111827; }
        
        .emp-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; }
        .emp-tab { border: 1.5px solid transparent; border-radius: 999px; padding: 4px 16px; font-size: 13px; font-weight: 500; color: #8e9baa; background: transparent; cursor: pointer; transition: all 0.15s ease; }
        .emp-tab.active { font-weight: 600; color: #000000; background: #ffffff; border-color: #000000; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        
        .emp-main-card { overflow: hidden; }
        .emp-table { width: 100%; border-collapse: collapse; min-width: 720px; font-size: 13.5px; }
        .emp-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .emp-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 20px; white-space: nowrap; }
        .emp-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .emp-table tbody tr:hover { background: #f8fafc; }
        .emp-table td { padding: 14px 20px; vertical-align: middle; }
        
        .emp-avatar { width: 34px; height: 34px; border-radius: 999px; object-fit: cover; }
        .emp-avatar-large { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; }
        .emp-id { font-family: inherit; font-size: 12.5px; color: #6b7280; white-space: nowrap; }
        .emp-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 13px; border: 1px solid; white-space: nowrap; }
        .emp-trash-btn { border: none; background: transparent; color: #9ca3af; cursor: pointer; padding: 4px; border-radius: 6px; display: grid; place-items: center; transition: color 0.15s ease; }
        .emp-trash-btn:hover { color: #ef4444; background: #fee2e2; }
        
        .emp-grid-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 18px 20px; }
        .emp-grid-item { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #fff; }
        
        .emp-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: #ffffff; border-top: 1px solid #f1f5f9; }
        .emp-page-btn { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #4b5563; cursor: pointer; transition: all 0.15s ease; }
        .emp-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .emp-page-btn:not(:disabled):hover { background: #f9fafb; border-color: #d1d5db; }
        .emp-page-indicator { display: inline-flex; align-items: center; justify-content: center; background: #16233a; color: #fff; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 4px 12px; height: 26px; }
        @media (max-width: 1023px) {
          .emp-dir-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .emp-dir-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .emp-dir-page { padding: 14px 14px 22px; }
          .emp-filter-card { padding: 12px 14px; }
          .emp-grid-view { grid-template-columns: minmax(0, 1fr); padding: 14px; }
          .emp-footer { flex-wrap: wrap; gap: 10px; padding: 12px 14px; }
          .emp-tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
          .emp-tab { flex-shrink: 0; white-space: nowrap; }
        }
      `}</style>
    </div>
  );
}
