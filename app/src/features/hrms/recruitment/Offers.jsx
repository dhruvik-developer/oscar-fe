import { useState, useMemo, useEffect } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate, useLocation } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import { DataTable } from "../../../components/hrms/DataTable";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/hrms/Button";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { FilterBar } from "../../../components/hrms/FilterBar";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Send,
  Edit2,
  Trash2,
  Calendar,
  Briefcase,
  HelpCircle,
  DollarSign
} from "lucide-react";
import OfferLetterModal from "../organization/OfferLetterModal";

export default function Offers() {
  const { offers, addOffer, updateOffer, candidates, changeStage } = useRecruitmentStore();
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({
    candidateId: "CAND-005",
    job: "HR Manager",
    salary: "$95,000",
    joiningDate: "01 Oct 2024",
    expiry: "15 Sep 2024",
    benefits: "Health, 401k",
    notes: "",
  });

  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [selectedOfferForLetter, setSelectedOfferForLetter] = useState(null);

  useEffect(() => {
    if (location.state?.openCreate) {
      openCreate();
    }
  }, [location.state]);

  const summary = {
    Pending: offers.filter((o) => o.status === "Pending").length,
    Accepted: offers.filter((o) => o.status === "Accepted").length,
    Rejected: offers.filter((o) => o.status === "Rejected").length,
    Expired: offers.filter((o) => o.status === "Expired").length,
  };

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (filter !== "All" && o.status !== filter) return false;
      if (
        search &&
        !`${o.candidateName} ${o.position} ${o.salary}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [offers, filter, search]);

  function openCreate() {
    setEditing(null);
    setForm({
      candidateId: "CAND-005",
      job: "HR Manager",
      salary: "$95,000",
      joiningDate: "01 Oct 2024",
      expiry: "15 Sep 2024",
      benefits: "Health, 401k",
      notes: "",
    });
    setDrawerOpen(true);
  }

  function handleOpenLetterModal(offerItem) {
    const cand = candidates.find((c) => c.id === offerItem.candidateId);
    setSelectedOfferForLetter({
      id: offerItem.id,
      candidateId: offerItem.candidateId,
      candidateName: offerItem.candidateName,
      email:
        cand?.email ||
        `${String(offerItem.candidateName ?? '').toLowerCase().replace(/\s+/g, ".")}@example.com`,
      position: offerItem.position,
      jobType: offerItem.jobType || "Full-time",
      dept: offerItem.position?.includes("Design")
        ? "Design"
        : offerItem.position?.includes("HR")
        ? "HR"
        : "Engineering",
      salary: offerItem.salary,
      location: cand?.location || "New York HQ",
      workMode: "Hybrid",
      sentDate: offerItem.sentDate || new Date().toISOString().split("T")[0],
      joiningDate: offerItem.joiningDate || "01 Oct 2024",
      reportingManager: "David Park (CTO)",
      probationPeriod: "3 Months",
      status: offerItem.status,
    });
    setIsLetterModalOpen(true);
  }

  function handleUpdateLetter(updatedOffer) {
    updateOffer(updatedOffer.id, updatedOffer);
    showToast(`Offer letter updated for ${updatedOffer.candidateName}`);
  }

  function handleConfirmLetter(updatedOffer) {
    updateOffer(updatedOffer.id, { ...updatedOffer, status: "Pending" });
    showToast(`Offer letter confirmed and sent to ${updatedOffer.candidateName}`);
  }

  function save(send) {
    const cand = candidates.find((c) => c.id === form.candidateId);
    if (!cand) {
      showToast("Candidate required");
      return;
    }
    if (!form.salary.trim() || !form.joiningDate.trim()) {
      showToast("Salary and Joining Date required");
      return;
    }
    if (editing) {
      updateOffer(editing, {
        candidateId: form.candidateId,
        candidateName: cand.name,
        position: form.job,
        salary: form.salary,
        joiningDate: form.joiningDate,
        expiry: form.expiry,
        status: "Pending",
      });
      showToast(send ? "Offer sent to candidate" : "Draft saved");
      setDrawerOpen(false);
    } else {
      addOffer({
        id: `OFF-${String(offers.length + 1).padStart(3, "0")}`,
        candidateId: form.candidateId,
        candidateName: cand.name,
        avatar: cand.avatar || "https://i.pravatar.cc/100?img=15",
        position: form.job,
        salary: form.salary,
        sentDate: "09 Sep 2026",
        joiningDate: form.joiningDate,
        status: "Pending",
        expiry: form.expiry,
      });
      showToast(send ? "Offer created and sent" : "Draft saved");
      setDrawerOpen(false);
    }
  }

  const cols = [
    {
      key: "candidateName",
      header: "Candidate",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <img
            src={r.avatar || "https://i.pravatar.cc/100?img=15"}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
          />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 block text-[13px]">
              {r.candidateName}
            </span>
            <span className="text-[11px] text-muted block">ID: {r.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Position",
      render: (r) => (
        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200 text-[12.5px]">
          <Briefcase size={13} className="text-slate-400" />
          <span>{r.position}</span>
        </div>
      ),
    },
    {
      key: "salary",
      header: "Offered Salary",
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
          <DollarSign size={12} />
          <span>{r.salary.replace("$", "")}</span>
        </span>
      ),
    },
    {
      key: "sentDate",
      header: "Sent Date",
      render: (r) => (
        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
          <Calendar size={13} className="text-slate-400" />
          <span>{r.sentDate}</span>
        </div>
      ),
    },
    {
      key: "joiningDate",
      header: "Joining Date",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200">
          <Calendar size={13} className="text-indigo-400" />
          <span>{r.joiningDate}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const map = {
          Pending: "Pending",
          Accepted: "Active",
          Rejected: "Cancelled",
          Expired: "Draft",
        };
        return <StatusBadge status={map[r.status] || r.status} label={r.status} />;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenLetterModal(r)}
            className="inline-flex items-center gap-1 text-[11.5px] bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer"
            title="View, edit and print offer letter"
          >
            <FileText size={12} />
            <span>Letter / PDF</span>
          </button>
          <button
            onClick={() => {
              setForm({
                candidateId: r.candidateId,
                job: r.position,
                salary: r.salary,
                joiningDate: r.joiningDate,
                expiry: r.expiry,
                benefits: "",
                notes: "",
              });
              setEditing(r.id);
              setDrawerOpen(true);
            }}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Edit Offer"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => {
              updateOffer(r.id, { status: "Pending" });
              showToast("Offer re-sent to candidate");
            }}
            className="inline-flex items-center gap-1 text-[11.5px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 rounded-lg px-2 py-1 font-medium transition cursor-pointer"
            title="Send Offer"
          >
            <Send size={11} />
            <span>Send</span>
          </button>
          <button
            onClick={() => setDeleteId(r.id)}
            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
            title="Withdraw Offer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Page Header */}
      <PageHeader
        title="Offer Letters & Rollouts"
        subtitle="Generate, send, and monitor candidate compensation packages and acceptance."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Offers" },
        ]}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[12px] font-medium transition cursor-pointer"
            >
              <HelpCircle size={14} />
              <span>Guide</span>
            </button>
            <Button
              size="sm"
              onClick={openCreate}
              className="flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>Create Offer</span>
            </Button>
          </div>
        }
      />

      {/* Metric Filter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          {
            k: "Pending",
            v: summary.Pending,
            label: "Pending Acceptance",
            icon: Clock,
            color: "text-amber-700 bg-amber-50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60",
          },
          {
            k: "Accepted",
            v: summary.Accepted,
            label: "Accepted & Ready",
            icon: CheckCircle2,
            color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60",
          },
          {
            k: "Rejected",
            v: summary.Rejected,
            label: "Declined",
            icon: XCircle,
            color: "text-rose-700 bg-rose-50 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60",
          },
          {
            k: "Expired",
            v: summary.Expired,
            label: "Lapsed / Revoked",
            icon: AlertCircle,
            color: "text-slate-600 bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700",
          },
        ].map((x) => {
          const Icon = x.icon;
          const isActive = filter === x.k;
          return (
            <button
              key={x.k}
              onClick={() => setFilter(x.k)}
              className={`border rounded-xl p-3.5 text-left transition-all cursor-pointer ${x.color} ${
                isActive
                  ? "ring-2 ring-indigo-500 border-indigo-500 shadow-xs scale-[1.01]"
                  : "hover:opacity-90"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{x.label}</span>
                <Icon size={14} className="opacity-80" />
              </div>
              <div className="text-2xl font-bold mt-1.5">{x.v}</div>
            </button>
          );
        })}

        {/* All Filter Card */}
        <button
          onClick={() => setFilter("All")}
          className={`border rounded-xl p-3.5 text-left transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 ${
            filter === "All"
              ? "ring-2 ring-indigo-500 border-indigo-500 shadow-xs scale-[1.01]"
              : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              All Offers
            </span>
            <FileText size={14} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold mt-1.5">{offers.length}</div>
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[]}
        onClear={() => setSearch("")}
      />

      {/* Table */}
      <DataTable
        columns={cols}
        data={filtered}
        emptyTitle="No offers found"
        emptyDesc="Create a formal offer package to send to qualified candidates."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            + Create Offer
          </Button>
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Edit Offer Package" : "Create Offer Package"}
        subtitle="Specify candidate, compensation structure, and start date"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => save(false)}>
              Save Draft
            </Button>
            <Button onClick={() => save(true)}>Send Offer</Button>
          </>
        }
      >
        <div className="grid sm:grid-cols-2 gap-3.5 text-[13px]">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Candidate *
            </span>
            <select
              value={form.candidateId}
              onChange={(e) => {
                const cand = candidates.find((c) => c.id === e.target.value);
                setForm({
                  ...form,
                  candidateId: e.target.value,
                  job: cand?.position || form.job,
                });
              }}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            >
              <option value="">Select Candidate</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.position}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Position Title *
            </span>
            <input
              value={form.job}
              onChange={(e) => setForm({ ...form, job: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="e.g. Lead Frontend Engineer"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Annual Salary / Package *
            </span>
            <input
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="$95,000"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Joining Date *
            </span>
            <input
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="01 Oct 2026"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Offer Expiry Date
            </span>
            <input
              value={form.expiry}
              onChange={(e) => setForm({ ...form, expiry: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="15 Sep 2026"
            />
          </label>

          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Benefits & Perks Summary
            </span>
            <input
              value={form.benefits}
              onChange={(e) => setForm({ ...form, benefits: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="Comprehensive Health Insurance, 401k match, Remote allowance..."
            />
          </label>

          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Internal Notes
            </span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px] resize-none"
              placeholder="Approved by department head..."
            />
          </label>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Withdraw Offer?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteId) updateOffer(deleteId, { status: "Expired" });
                setDeleteId(null);
                showToast("Offer has been withdrawn");
              }}
            >
              Withdraw
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600 dark:text-slate-300">
          Are you sure you want to withdraw this offer? The candidate will no longer be able to accept it.
        </p>
      </Modal>

      {/* Official Offer Letter / PDF Modal */}
      <OfferLetterModal
        isOpen={isLetterModalOpen}
        onClose={() => setIsLetterModalOpen(false)}
        offer={selectedOfferForLetter}
        onConfirmOffer={handleConfirmLetter}
        onUpdateOffer={handleUpdateLetter}
      />

      {/* Guide Modal */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto text-[13px] text-slate-600 dark:text-slate-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <HelpCircle size={18} />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                  Offers & Rollouts Guide
                </h3>
              </div>
              <button
                onClick={() => setGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  1. Formal Offer Letter & PDF
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Click 'Letter / PDF' on any offer to preview the official corporate offer letter with salary breakdown, reporting manager, and instant print/download capabilities.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  2. Acceptance & Onboarding Sync
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  When a candidate accepts an offer, they transition seamlessly into Job Onboarding to complete document verification and employee directory induction.
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setGuideOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}