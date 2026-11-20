import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Globe,
  ImagePlus,
  Mail,
  Phone,
  Save,
  Type,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { defaultLeadFormSections } from "../../../data/crm/leadFormSchema";
import { useCrmStore } from "../../../stores/crmStore";
import { useERP } from "../../../context/ERPContext";
import { fetchLiveLeadFormId, findForm, getLiveLeadFormId, isLeadFormSwitchedOn, loadForms } from "../../../services/crmForms";
import PageInfoButton from "../../../components/ui/PageInfoButton";

function getFieldIcon(field) {
  if (field.type === "Email") return Mail;
  if (field.type === "Phone") return Phone;
  if (field.type === "Date") return CalendarDays;
  if (field.type === "Dropdown") return ChevronDown;
  if (field.type === "User") return UserRound;
  if (field.type === "Lookup") return Globe;
  return Type;
}

function PhoneInput({ field, Icon, value, onChange }) {
  return (
    <div className="relative flex items-center">
      <input
        type="tel"
        value={value || "+91 "}
        onChange={(e) => {
          let v = e.target.value;
          if (!v || v === '+' || v.trim() === '') { onChange?.('+91 '); return; }
          if (!v.startsWith('+91')) { const cl = v.replace(/^\+?91\s*/, ''); onChange?.(`+91 ${cl}`); return; }
          onChange?.(v);
        }}
        placeholder={field.placeholder || "+91 98765 43210"}
        className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <Icon size={15} className="absolute right-3 text-slate-400 pointer-events-none" />
    </div>
  );
}

function renderInput(field, value, onChange) {
  if (field.type === "Lead Image") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">{field.label}</span>
          <div className="w-8 h-4.5 bg-emerald-500 rounded-full flex items-center p-0.5 justify-end cursor-pointer">
            <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
          </div>
        </div>
        <div className="w-14 h-14 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-center text-slate-400 mt-2.5">
          <ImagePlus size={24} strokeWidth={1.5} />
        </div>
      </div>
    );
  }

  if (field.type === "Multi Line") {
    return (
      <textarea
        rows={3}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={field.placeholder}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
      />
    );
  }

  if (field.type === "Dropdown") {
    const options = Array.isArray(field.options) ? field.options : ["Option 1", "Option 2"];
    return (
      <div className="relative flex items-center">
        <select
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none pr-8 cursor-pointer"
        >
          <option value="" disabled>
            {field.placeholder || "Select option"}
          </option>
          {options.map((opt, i) => (
            <option key={i} value={typeof opt === 'string' ? opt : opt.value || opt.label}>
              {typeof opt === 'string' ? opt : opt.label || opt.value}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="absolute right-3 text-slate-400 pointer-events-none" />
      </div>
    );
  }

  if (field.type === "Checkbox") {
    return (
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange?.(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-slate-300"
        />
        <span className="text-xs font-medium text-slate-700">{field.placeholder || field.label}</span>
      </label>
    );
  }

  if (field.type === "Date") {
    return (
      <div className="relative flex items-center">
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={field.placeholder || "Select date"}
          className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <CalendarDays size={15} className="absolute right-3 text-slate-400 pointer-events-none" />
      </div>
    );
  }

  const Icon = getFieldIcon(field);
  const inputType =
    field.type === "Email"
      ? "email"
      : field.type === "Phone"
      ? "tel"
      : field.type === "Number" || field.type === "Currency"
      ? "number"
      : "text";

  const isPhone = field.type === "Phone" || /phone|mobile/i.test(field.label);
  if (isPhone) {
    return <PhoneInput field={field} Icon={Icon} value={value} onChange={onChange} />;
  }

  return (
    <div className="relative flex items-center">
      <input
        type={inputType}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={field.placeholder}
        className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <Icon size={15} className="absolute right-3 text-slate-400 pointer-events-none" />
    </div>
  );
}

export default function DynamicLeadFormPage({
  sections = defaultLeadFormSections,
  onBackToLeads,
  onEditLayout,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = onBackToLeads || (() => navigate("/crm/leads"));
  const handleEdit = onEditLayout || (() => navigate("/crm/leads/form-builder"));

  // Re-render once the store finishes hydrating after this page mounts.
  const storeForms = useCrmStore((s) => s.forms);

  // Another user may have switched the live form since the forms loaded.
  useEffect(() => {
    fetchLiveLeadFormId().catch(() => {});
  }, []);

  // Which form to show: an explicitly passed preview, else the form toggled
  // on in Manage Lead Create Forms. With every form switched off the page
  // shows a notice instead, so no lead is created on an unchosen form.
  const previewFormId = location.state?.formId || null;
  const resolvedForm = useMemo(() => {
    if (Array.isArray(sections) && sections.length > 0 && sections !== defaultLeadFormSections) {
      return { sections };
    }
    // Every form switched off: show the "No lead form is switched on" notice
    // instead of falling back to the first form. A builder preview still works.
    if (!previewFormId && !isLeadFormSwitchedOn()) {
      return { sections: [] };
    }
    const wantedId = previewFormId || getLiveLeadFormId();
    if (wantedId) {
      const form = findForm(wantedId);
      if (form && Array.isArray(form.sections) && form.sections.length > 0) {
        return form;
      }
    }
    const fallback = loadForms()[0];
    if (fallback && Array.isArray(fallback.sections) && fallback.sections.length > 0) {
      return fallback;
    }
    return { sections: defaultLeadFormSections };
  }, [sections, previewFormId, storeForms]);

  const safeSections = useMemo(() => {
    if (resolvedForm) {
      return resolvedForm.sections;
    }
    return defaultLeadFormSections;
  }, [resolvedForm]);

  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const erp = useERP();

  const handleFieldChange = (fieldId, val) => {
    setFormData((prev) => ({ ...prev, [fieldId]: val }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSaveLead = async () => {
    if (isSaving) return;
    for (const sec of safeSections) {
      for (const f of sec.fields || []) {
        if (f.required && !formData[f.id]) {
          setErrorMessage(`Please fill required field: ${f.label}`);
          return;
        }
      }
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name || formData.lead_name || formData.leadName || "New Lead",
        phone: formData.phone || formData.mobile || "",
        email: formData.email || "",
        company: formData.company || formData.company_name || "",
        stage: "Draft",
        status: "Active",
        source: formData.source || "Direct",
        notes: formData.notes || formData.requirement || "",
        custom_fields: formData,
      };
      const createRecord = useCrmStore.getState().createRecord;
      if (createRecord) {
        await createRecord("leads", payload);
      }
      if (erp?.showToast) {
        erp.showToast("Lead created successfully!");
      }
      handleBack();
    } catch (err) {
      setErrorMessage(err.message || "Failed to save lead.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="w-full">
      {/* Top Bar */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-0 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft size={15} />
            Back to Leads
          </button>
          <PageInfoButton title="Create Lead" />
        </div>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleEdit}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            Edit Page Layout
          </button>
          <button
            type="button"
            onClick={handleSaveLead}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-xs transition cursor-pointer"
          >
            <Save size={15} />
            {isSaving ? "Saving..." : "Save Lead"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Sections — only the toggled-on form is shown */}
      {safeSections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-xs text-center">
          <p className="text-sm font-bold text-slate-900">No lead form is switched on</p>
          <p className="mt-1 text-xs text-slate-500">
            Toggle a form on in Manage Lead Create Forms to show it here.
          </p>
          <button
            type="button"
            onClick={() => navigate("/crm/leads/forms")}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            Go to Manage Lead Create Forms
          </button>
        </div>
      ) : (
      <div className="space-y-6">
        {safeSections.map((section) => (
          <section
            key={section.id}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs"
          >
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-100">
              <ChevronDown size={16} className="text-slate-600" />
              <strong className="text-sm font-bold text-slate-900">{section.title}</strong>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(section.fields || []).map((field) => (
                <div
                  key={field.id}
                  className={`flex flex-col gap-1.5 ${
                    field.type === "Multi Line" ? "md:col-span-2" : ""
                  }`}
                >
                  {field.type !== "Lead Image" && (
                    <span className="text-xs font-medium text-slate-700">
                      {field.label}
                      {field.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </span>
                  )}
                  {renderInput(field, formData[field.id], (v) => handleFieldChange(field.id, v))}
                  {field.helpText && (
                    <small className="text-[11px] text-slate-400">{field.helpText}</small>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      )}
    </section>
  );
}
