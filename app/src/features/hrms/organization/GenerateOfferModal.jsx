import React, { useState } from "react";
import { X, Sparkles, Briefcase, MapPin, DollarSign, Calendar, Clock, User } from "lucide-react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";

export default function GenerateOfferModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const candidates = useRecruitmentStore((s) => s.candidates || []);
  const hiredCandidates = candidates.filter(
    (c) => c.stage === "Hired" || c.stage === "Offer"
  );

  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [formData, setFormData] = useState({
    candidateName: "",
    candidateId: "",
    email: "",
    position: "",
    jobType: "Full-time",
    dept: "Engineering",
    salary: "$95,000 / annum",
    location: "New York HQ",
    workMode: "Hybrid",
    joiningDate: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    reportingManager: "David Park (CTO)",
    probationPeriod: "3 Months",
  });

  if (!isOpen) return null;

  const handleSelectCandidate = (e) => {
    const candId = e.target.value;
    setSelectedCandidateId(candId);
    if (!candId) return;

    const cand = candidates.find((c) => c.id === candId);
    if (cand) {
      let dept = "Engineering";
      const pos = cand.position?.toLowerCase() || "";
      if (pos.includes("design") || pos.includes("ui") || pos.includes("ux")) dept = "Design";
      else if (pos.includes("hr") || pos.includes("people") || pos.includes("talent")) dept = "HR";
      else if (pos.includes("finance") || pos.includes("account")) dept = "Finance";
      else if (pos.includes("marketing") || pos.includes("brand") || pos.includes("sales")) dept = "Sales & Marketing";
      else if (pos.includes("ops") || pos.includes("operations")) dept = "Operations";

      setFormData((prev) => ({
        ...prev,
        candidateName: cand.name,
        candidateId: cand.id,
        email: cand.email,
        position: cand.position,
        location: cand.location || prev.location,
        dept,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.candidateName) return;

    const newOffer = {
      id: `OFF-${Math.floor(100 + Math.random() * 900)}`,
      ...formData,
      sentDate: new Date().toISOString().split("T")[0],
      status: "Pending",
    };

    onSubmit(newOffer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-lg p-4 sm:p-6 my-auto">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy/10 text-navy grid place-items-center font-bold">
              <Briefcase size={16} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-slate-900">
                Generate Offer Letter
              </h3>
              <p className="text-[11.5px] text-slate-500">
                Quick &amp; minimal appointment letter setup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {/* Quick Select Hired Candidate */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-600" />
                Select Hired / Pipeline Candidate
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/60 font-semibold text-emerald-900">
                {hiredCandidates.length} Hired In Recruitment
              </span>
            </div>

            <select
              value={selectedCandidateId}
              onChange={handleSelectCandidate}
              className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
            >
              <option value="">-- Choose candidate to auto-fill (or enter manually) --</option>
              <optgroup label="Hired Candidates (Ready for Offer)">
                {hiredCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    ★ {c.name} — {c.position} ({c.stage})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other Active Candidates">
                {candidates
                  .filter((c) => c.stage !== "Hired" && c.stage !== "Offer")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.position} ({c.stage})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Candidate Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Liam Cooper"
                value={formData.candidateName}
                onChange={(e) =>
                  setFormData({ ...formData, candidateName: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. liam@email.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Role / Designation
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Backend Engineer"
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Job Type
              </label>
              <select
                value={formData.jobType}
                onChange={(e) =>
                  setFormData({ ...formData, jobType: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy font-medium"
              >
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Internship</option>
                <option>Contract</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Stipend / Salary
              </label>
              <input
                type="text"
                required
                placeholder="e.g. $95,000 / yr or ₹50,000 / mo"
                value={formData.salary}
                onChange={(e) =>
                  setFormData({ ...formData, salary: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy font-bold text-emerald-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                value={formData.dept}
                onChange={(e) =>
                  setFormData({ ...formData, dept: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              >
                <option>Engineering</option>
                <option>Design</option>
                <option>HR</option>
                <option>Finance</option>
                <option>Sales & Marketing</option>
                <option>Operations</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Job Location
              </label>
              <input
                type="text"
                placeholder="e.g. Mumbai, New York HQ"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Work Mode
              </label>
              <select
                value={formData.workMode}
                onChange={(e) =>
                  setFormData({ ...formData, workMode: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              >
                <option>Hybrid</option>
                <option>On-site</option>
                <option>Remote</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Joining Date
              </label>
              <input
                type="date"
                required
                value={formData.joiningDate}
                onChange={(e) =>
                  setFormData({ ...formData, joiningDate: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reporting Manager
              </label>
              <input
                type="text"
                placeholder="e.g. David Park (CTO)"
                value={formData.reportingManager}
                onChange={(e) =>
                  setFormData({ ...formData, reportingManager: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-[13px] hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 flex items-center gap-1.5 shadow-xs"
            >
              <Briefcase size={15} />
              <span>Generate &amp; Preview</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
