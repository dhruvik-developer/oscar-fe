export const FIELD_LIBRARY = [
  "Single Line",
  "Multi Line",
  "Number",
  "Email",
  "Phone",
  "Date",
  "Dropdown",
  "Multi Select",
  "Checkbox",
  "Radio",
  "File Upload",
  "Currency",
  "User",
  "Lookup",
  "Lead Image",
];

const FIELD_TEMPLATES = {
  "Single Line": { label: "Single Line", placeholder: "Enter value" },
  "Multi Line": { label: "Multi Line", placeholder: "Enter details here..." },
  Number: { label: "Number", placeholder: "Enter number" },
  Email: { label: "Email", placeholder: "Enter email address" },
  Phone: { label: "Phone", placeholder: "Enter phone number" },
  Date: { label: "Date", placeholder: "Select date" },
  Dropdown: { label: "Dropdown", placeholder: "Select option" },
  "Multi Select": { label: "Multi Select", placeholder: "Select one or more options" },
  Checkbox: { label: "Checkbox", placeholder: "Enable this field" },
  Radio: { label: "Radio", placeholder: "Select one option" },
  "File Upload": { label: "File Upload", placeholder: "Upload file" },
  Currency: { label: "Currency", placeholder: "Enter amount" },
  User: { label: "User", placeholder: "Select user" },
  Lookup: { label: "Lookup", placeholder: "Search related record" },
  "Lead Image": { label: "Lead Image", placeholder: "Upload lead photo" },
};

function createField(id, type, overrides = {}) {
  return {
    id,
    type,
    label: FIELD_TEMPLATES[type]?.label ?? type,
    placeholder: FIELD_TEMPLATES[type]?.placeholder ?? "Enter value",
    required: false,
    showInList: false,
    uniqueValue: false,
    defaultValue: "None",
    helpText: "",
    ...overrides,
  };
}

export function createFieldFromType(type, seed = Date.now()) {
  const normalized = type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return createField(`${normalized}-${seed}`, type);
}

// Dump data for the textile catalogue: the Products/Fabric ("Febric")
// multi-select ships with these options instead of the old medical-device
// placeholders.
export const TEXTILE_FABRIC_OPTIONS = [];

// The previous placeholder set — saved forms still carrying exactly these
// are healed to the textile set on read (see CreateLeadModal).
export const LEGACY_FABRIC_OPTIONS = [
  "Endoscopy System",
  "OT Light",
  "Patient Monitor",
  "X-Ray Machine",
  "Ventilator",
];

export const defaultLeadFormSections = [
  {
    id: "lead-information",
    title: "Lead Information",
    fields: [
      createField("lead-name", "Single Line", { label: "Lead Name", placeholder: "Enter lead name", required: true, showInList: true, locked: true }),
      createField("lead-photo", "Lead Image", { label: "Lead Photo", placeholder: "Upload lead photo", locked: true }),
      createField("company", "Single Line", { label: "Company", placeholder: "Enter company name", showInList: true }),
      createField("email", "Email", { label: "Email", placeholder: "Enter email address", showInList: true, uniqueValue: true }),
      createField("phone", "Phone", { label: "Phone", placeholder: "Enter phone number", showInList: true }),
      createField("lead-source", "Dropdown", { label: "Lead Source", placeholder: "Select source", showInList: true }),
      createField("title", "Single Line", { label: "Title", placeholder: "Enter title" }),
      createField("industry", "Single Line", { label: "Industry", placeholder: "Enter industry" }),
      createField("lead-owner", "User", { label: "Lead Owner", placeholder: "Select User", showInList: true }),
      createField("created-on", "Date", { label: "Created On", placeholder: "Select created date" }),
      createField("products", "Multi Select", { label: "Products", placeholder: "Select Products", options: [] }),
      createField("lead-users", "User", { label: "Lead Users", placeholder: "Select Users" }),
      createField("task-date", "Date", { label: "Task Date (Optional)", placeholder: "dd-mm-yyyy", helpText: "Leave blank to allocate the first form task immediately." }),
      createField("task-time", "Single Line", { label: "Task Time (Optional)", placeholder: "--:--", helpText: "Optional time for the scheduled task." }),
    ],
  },
];
