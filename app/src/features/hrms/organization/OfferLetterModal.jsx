import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Edit3,
  Eye,
  CheckCircle2,
  FileCheck,
  Building2,
  Save,
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  User,
} from "lucide-react";

export default function OfferLetterModal({
  isOpen,
  onClose,
  offer,
  onUpdateOffer,
  onConfirmOffer,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (offer) {
      const existing = offer.letterContent;
      setFormData({
        refNumber: existing?.refNumber || `EV/OFFER/2024/${offer.id || "101"}`,
        issueDate:
          existing?.issueDate ||
          offer.sentDate ||
          new Date().toISOString().split("T")[0],
        candidateName: offer.candidateName || "",
        email: offer.email || "",
        position: offer.position || "",
        jobType: existing?.jobType || offer.jobType || "Full-time",
        dept: offer.dept || "Engineering",
        salary: existing?.salary || offer.salary || "$95,000 / annum",
        location: existing?.location || offer.location || "New York HQ",
        workMode: existing?.workMode || offer.workMode || "Hybrid",
        joiningDate: offer.joiningDate || "2024-11-01",
        reportingManager: offer.reportingManager || "David Park (CTO)",
        probationPeriod: existing?.probationPeriod || offer.probationPeriod || "3 Months",
        acceptanceDeadline:
          existing?.acceptanceDeadline ||
          offer.expiryDate ||
          "Within 7 days of issue",
        note:
          existing?.note ||
          "Please review the terms above and sign below to confirm your acceptance. We look forward to welcoming you to the team!",
        signatoryName: existing?.signatoryName || "Ayesha Khan",
        signatoryTitle: existing?.signatoryTitle || "Head of People & Culture",
        companyName: "Evenmore Technologies Inc.",
        companyAddress: "100 Innovation Parkway, New York, NY 10001 • hr@evenmore.io",
      });
      setIsEditing(false);
      setSavedSuccess(false);
    }
  }, [offer]);

  if (!isOpen || !offer || !formData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleConfirm = () => {
    if (onConfirmOffer) {
      const updated = {
        ...offer,
        candidateName: formData.candidateName,
        email: formData.email,
        position: formData.position,
        jobType: formData.jobType,
        dept: formData.dept,
        salary: formData.salary,
        location: formData.location,
        workMode: formData.workMode,
        joiningDate: formData.joiningDate,
        reportingManager: formData.reportingManager,
        probationPeriod: formData.probationPeriod,
        expiryDate: formData.acceptanceDeadline,
        letterContent: { ...formData },
        status: "Pending",
      };
      onConfirmOffer(updated);
      onClose();
    }
  };

  const handleSave = () => {
    if (onUpdateOffer) {
      const updated = {
        ...offer,
        candidateName: formData.candidateName,
        email: formData.email,
        position: formData.position,
        jobType: formData.jobType,
        dept: formData.dept,
        salary: formData.salary,
        location: formData.location,
        workMode: formData.workMode,
        joiningDate: formData.joiningDate,
        reportingManager: formData.reportingManager,
        probationPeriod: formData.probationPeriod,
        expiryDate: formData.acceptanceDeadline,
        letterContent: { ...formData },
      };
      onUpdateOffer(updated);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-3xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        
        {/* Top Control Bar (Hidden during Print) */}
        <div className="bg-[#1F2E4A] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold">
              <FileCheck size={16} />
            </div>
            <div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Offer Letter — {formData.candidateName}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  {formData.jobType}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Minimal &amp; simple formal offer format
              </p>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            {/* Toggle Edit / Preview */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isEditing
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              }`}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
              <span>{isEditing ? "Preview Letter" : "Edit Details"}</span>
            </button>

            {/* Save / Confirm */}
            {onConfirmOffer ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Confirm & Generate Offer Letter"
              >
                <CheckCircle2 size={14} />
                <span>Confirm &amp; Generate</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Save Changes"
              >
                <Save size={14} />
                <span>{savedSuccess ? "Saved!" : "Save"}</span>
              </button>
            )}

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              title="Print or Export as PDF"
            >
              <Printer size={14} />
              <span>Print / Save as PDF</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition ml-1"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Saved Alert Banner */}
        {savedSuccess && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-5 py-2 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Offer letter details updated successfully.</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="max-h-[calc(88vh-55px)] overflow-y-auto">
          {isEditing ? (
            /* ── EDIT MODE FORM ── */
            <div className="p-4 sm:p-6 bg-slate-50 space-y-4 no-print text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm">
                  Edit Offer Letter Details
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  View Preview →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Candidate Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.candidateName}
                    onChange={(e) =>
                      setFormData({ ...formData, candidateName: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Job Role / Designation
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
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
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600 font-medium"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Internship</option>
                    <option>Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.dept}
                    onChange={(e) =>
                      setFormData({ ...formData, dept: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stipend / Salary
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹60,000 / month or $95,000 / yr"
                    value={formData.salary}
                    onChange={(e) =>
                      setFormData({ ...formData, salary: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600 font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Job Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Bangalore, New York"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
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
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option>On-site</option>
                    <option>Hybrid</option>
                    <option>Remote</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reporting Manager
                  </label>
                  <input
                    type="text"
                    value={formData.reportingManager}
                    onChange={(e) =>
                      setFormData({ ...formData, reportingManager: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Probation Period
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3 Months, None"
                    value={formData.probationPeriod}
                    onChange={(e) =>
                      setFormData({ ...formData, probationPeriod: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Acceptance Deadline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Within 7 days, 15 Oct 2024"
                    value={formData.acceptanceDeadline}
                    onChange={(e) =>
                      setFormData({ ...formData, acceptanceDeadline: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Signatory Name &amp; Title
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={formData.signatoryName}
                      onChange={(e) =>
                        setFormData({ ...formData, signatoryName: e.target.value })
                      }
                      className="w-1/2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    />
                    <input
                      type="text"
                      placeholder="Title"
                      value={formData.signatoryTitle}
                      onChange={(e) =>
                        setFormData({ ...formData, signatoryTitle: e.target.value })
                      }
                      className="w-1/2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-1.5 bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-300"
                >
                  Done Editing &amp; Preview
                </button>
                {onConfirmOffer && (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>Confirm &amp; Generate Offer</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* ── MINIMAL & SIMPLE PRINTABLE OFFER LETTER ── */}
          <div className="overflow-x-auto p-2 sm:p-6 lg:p-0 print:p-0 print:overflow-visible">
          <div className="p-8 sm:p-12 min-w-[720px] lg:min-w-0 print:min-w-0 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document">
            
            {/* Header / Company Info */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-base font-mono">
                    E
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-[#1F2E4A] tracking-tight uppercase">
                      {formData.companyName}
                    </h1>
                    <p className="text-[10px] text-slate-500">
                      {formData.companyAddress}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right space-y-0.5 text-[11px] text-slate-500">
                <div className="font-mono font-medium text-slate-700">
                  Ref: {formData.refNumber}
                </div>
                <div>Date: {formData.issueDate}</div>
              </div>
            </div>

            {/* Recipient */}
            <div className="space-y-0.5 text-[12px]">
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                To:
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {formData.candidateName}
              </div>
              {formData.email && (
                <div className="text-slate-600">{formData.email}</div>
              )}
            </div>

            {/* Formal Offer Note */}
            <div className="space-y-2 text-[12.5px] leading-relaxed text-slate-700">
              <p>
                Dear <b>{formData.candidateName}</b>,
              </p>
              <p>
                We are pleased to offer you the position of{" "}
                <b className="text-slate-900">{formData.position}</b> with{" "}
                <b>{formData.companyName}</b>. We were very impressed by your
                skills and background, and we are excited to have you join our
                team.
              </p>
            </div>

            {/* Essential Job Details Box (Minimal & Clean Grid) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Key Employment Terms
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3.5 gap-x-4 text-[12px]">
                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Job Role / Designation
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.position}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Job Type
                  </span>
                  <span className="inline-block font-semibold text-blue-700">
                    {formData.jobType}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Department
                  </span>
                  <span className="font-medium text-slate-800">
                    {formData.dept}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Stipend / Salary
                  </span>
                  <span className="font-extrabold text-emerald-800 text-[13px]">
                    {formData.salary}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Job Location
                  </span>
                  <span className="font-medium text-slate-800">
                    {formData.location} ({formData.workMode})
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Joining Date
                  </span>
                  <span className="font-bold text-slate-900">
                    {formData.joiningDate}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Reporting Manager
                  </span>
                  <span className="font-medium text-slate-800">
                    {formData.reportingManager}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Probation Period
                  </span>
                  <span className="font-medium text-slate-800">
                    {formData.probationPeriod}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">
                    Acceptance Deadline
                  </span>
                  <span className="font-medium text-slate-800">
                    {formData.acceptanceDeadline}
                  </span>
                </div>
              </div>
            </div>

            {/* Simple Closing Note */}
            <div className="text-[12px] text-slate-600 leading-relaxed pt-1">
              <p>{formData.note}</p>
            </div>

            {/* Signatures: Clean & Compact */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8">
              {/* Employer Sign-off */}
              <div className="space-y-2">
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  For {formData.companyName}:
                </div>
                <div className="pt-6 border-b border-slate-300 w-44"></div>
                <div className="space-y-0.5 text-[11.5px]">
                  <div className="font-bold text-slate-900">{formData.signatoryName}</div>
                  <div className="text-slate-500 text-[11px]">{formData.signatoryTitle}</div>
                </div>
              </div>

              {/* Candidate Acceptance */}
              <div className="space-y-2">
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  Candidate Acceptance:
                </div>
                <p className="text-[10.5px] text-slate-500">
                  I accept the employment offer under the terms stated above.
                </p>
                <div className="pt-4 border-b border-slate-300 w-44"></div>
                <div className="space-y-0.5 text-[11px] text-slate-500">
                  <div>Signature: ______________________</div>
                  <div>Date: __________________________</div>
                </div>
              </div>
            </div>

            {/* Minimal Footer */}
            <div className="pt-4 text-center text-[9.5px] text-slate-400">
              Evenmore Technologies Inc. • Confidential Employment Offer
            </div>

          </div>
          </div>
        </div>

      </div>
    </div>
  );
}
