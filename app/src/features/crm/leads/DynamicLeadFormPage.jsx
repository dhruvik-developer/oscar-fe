import { useEffect, useMemo } from "react";
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

function renderInput(field) {
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
        placeholder={field.placeholder}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
      />
    );
  }

  if (field.type === "Dropdown") {
    return (
      <div className="relative flex items-center">
        <select
          defaultValue=""
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none pr-8 cursor-pointer"
        >
          <option value="" disabled>
            {field.placeholder}
          </option>
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
        <ChevronDown size={15} className="absolute right-3 text-slate-400 pointer-events-none" />
      </div>
    );
  }

  if (field.type === "Checkbox") {
    return (
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300" />
        <span className="text-xs font-medium text-slate-700">{field.placeholder || field.label}</span>
      </label>
    );
  }

  if (field.type === "Date") {
    return (
      <div className="relative flex items-center">
        <input
          type="text"
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

  return (
    <div className="relative flex items-center">
      <input
        type={inputType}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs transition cursor-pointer"
          >
            <Save size={15} />
            Save Lead
          </button>
        </div>
      </div>

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
                  {renderInput(field)}
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
