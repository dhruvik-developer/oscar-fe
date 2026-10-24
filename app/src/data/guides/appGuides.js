import { hrmsGuides } from '../hrms/hrmsGuides';

/**
 * Comprehensive Master Guide Registry for all Evenmore ERP modules:
 * - CRM & Lead Operations
 * - Sales & Revenue Operations
 * - Procurement & Purchase Operations
 * - Inventory & Warehouse Management
 * - Fabric & Textile Masters (Slides 1 to 10)
 * - Quality Control (QC Inspection, Testing, & Disposition)
 * - Job Work & Dyeing/Finishing Processing (PMS Processing)
 * - Project Management (PMS) & Production Execution
 * - Financial Accounts, Treasury & General Ledger
 * - Commercial Parties (Customers, Vendors, Brokers)
 * - Administration, Governance, & Executive Reports
 */

export const appGuides = {
  // Merge all existing HRMS guides first
  ...hrmsGuides,

  // ────────────────────────────────────────────────────────────
  // FABRIC & TEXTILE MASTERS (Slides 1 to 10)
  // ────────────────────────────────────────────────────────────
  fabricQuality: {
    title: 'Fabric Quality Master',
    subtitle: 'Base fabric specifications, yarn counts, GSM, construction weave, and grading.',
    purpose: 'The Fabric Quality Master defines the baseline textile construction attributes (warp/weft yarn counts, weave type, target GSM, blend composition, and finish parameters). It acts as the technical blueprint for procurement, job-work planning, and inventory valuation.',
    workflow: ['Define Quality Code & Weave', 'Input Composition & GSM', 'Specify Tolerances & Shrinkage', 'Publish to Fabric Variant Master'],
    keyTerms: [
      { term: 'Quality Code', definition: 'Unique alphanumeric identifier representing a distinct fabric construction (e.g., POP-4040, RAY-3030).' },
      { term: 'Yarn Count (Warp × Weft)', definition: 'Linear density measurement specifying yarn fineness across longitudinal and transverse threads.' },
      { term: 'GSM (Grams per Sq Meter)', definition: 'Total fabric weight per square meter used to determine density, hand-feel, and commercial classification.' },
      { term: 'Composition Blend', definition: 'Ratio of fibers comprising the yarn (e.g., 100% Cotton, 80/20 Poly-Viscose, 100% Linen).' },
    ],
    tips: [
      'Set accurate warp and weft counts; these are used by job-work formulas to calculate theoretical weight.',
      'Mark discontinued fabric constructions as Inactive to preserve historical order traceability while hiding them from new orders.',
    ],
  },

  designMaster: {
    title: 'Design Master',
    subtitle: 'Fabric surface patterns, print motifs, repeat dimensions, and mill design numbers.',
    purpose: 'The Design Master catalogs all aesthetic pattern artwork, rotary/screen print motifs, jacquard weaves, and digital prints applied to fabric qualities. It governs design registration, repeat dimensions, screen counts, and client exclusivity arrangements.',
    workflow: ['Register Design Code & Name', 'Upload Motif Image & Artwork', 'Set Repeat Dimensions & Process', 'Link to Fabric Variants'],
    keyTerms: [
      { term: 'Design / Motif Code', definition: 'Unique mill reference code assigned to a specific print pattern or artwork layout.' },
      { term: 'Repeat Size (Vertical × Horizontal)', definition: 'Dimensional interval in inches or centimeters at which the print or woven pattern repeats.' },
      { term: 'Screen Count / Rollers', definition: 'The number of rotary screens or flatbed blocks required to print all colors in the motif.' },
      { term: 'Design Category', definition: 'Classification by design style (e.g., Floral, Geometric, Abstract, Traditional Buta, Stripes).' },
    ],
    tips: [
      'Upload high-resolution design swatch photos to facilitate visual confirmation during QC inspections.',
      'Specify the maximum allowable screen misalignment tolerance in the design notes.',
    ],
  },

  colourShadeMaster: {
    title: 'Colour / Shade Master',
    subtitle: 'Color formulations, Pantone matching, lab dip approval, and dye recipe references.',
    purpose: 'The Colour / Shade Master manages the enterprise library of color variations, standard Pantone codes, hex coordinates, and approved mill lab-dip recipe records. It ensures exact shade repeatability across multiple dye lots and process cycles.',
    workflow: ['Select Base Color & Hex', 'Assign Pantone / Shade Code', 'Link Approved Lab Dip Formula', 'Deploy to Processing & Orders'],
    keyTerms: [
      { term: 'Shade / Color Code', definition: 'Standardized nomenclature for a specific hue (e.g., NAVY-04, MAROON-D9, SAGE-21).' },
      { term: 'Hex & RGB Swatch', definition: 'Digital color representation for screen UI matching and client quotation mockups.' },
      { term: 'Lab Dip Reference', definition: 'Physically approved laboratory beaker dye sample number signed off by client QC.' },
      { term: 'Dye Group / Class', definition: 'Chemical dye classification (Reactive, Disperse, Vat, Acid) determining wash fastness.' },
    ],
    tips: [
      'Use the interactive Hue and 2D saturation picker to approximate the real textile swatch on digital previews.',
      'Record client-specific shade codes in aliases for frictionless customer invoice matching.',
    ],
  },

  fabricVariant: {
    title: 'Fabric Item / Variant Master',
    subtitle: 'Sellable and stockable finished fabric SKUs combining quality, design, and color shade.',
    purpose: 'The Fabric Variant Master connects a base Fabric Quality with a Design Motif and Color Shade to produce a unique finished fabric SKU. It manages sales price lists, minimum order quantities (MOQ), barcode tags, and finished roll inventory.',
    workflow: ['Select Quality + Design + Shade', 'System Generates Variant SKU', 'Set Purchase / Sale Tariffs', 'Enable for Production & Orders'],
    keyTerms: [
      { term: 'Finished Fabric SKU', definition: 'The composite item code tracked in warehouse inventory and commercial quotations.' },
      { term: 'Cuttable Width', definition: 'Usable fabric width excluding selvedge edges (e.g., 44", 58", 60").' },
      { term: 'Finish Treatment', definition: 'Chemical or mechanical finish applied (e.g., Bio-Wash, Mercerized, Peach Finish, Water Repellent).' },
      { term: 'Base UOM', definition: 'Standard stock tracking unit (Meters, Yards, or Kilograms).' },
    ],
    tips: [
      'Variant SKUs auto-generate based on standard taxonomy to maintain catalog naming consistency.',
      'Link minimum stock thresholds so auto-PO triggers notify procurement before stockouts occur.',
    ],
  },

  fabricType: {
    title: 'Fabric Type / Classification',
    subtitle: 'Broad fiber classes, weaving categories, and commercial group definitions.',
    purpose: 'The Fabric Type Master establishes the high-level hierarchy of textile goods (e.g., Cotton Woven, Silk Brocade, Synthetic Knits, Denim, Linen). It drives financial reporting segmentation, GST tax slab categorization, and warehouse zone allocation.',
    workflow: ['Create Fabric Category Code', 'Define Fiber Family & Weave Type', 'Set Default Tax & UOM', 'Organize Item Sub-Classes'],
    keyTerms: [
      { term: 'Fiber Family', definition: 'Natural, Synthetic, Regenerated, or Blended origin of the primary yarn material.' },
      { term: 'HSN / SAC Code', definition: 'Statutory Harmonized System of Nomenclature code defining GST tax slabs (typically 5208, 5407, 5513).' },
      { term: 'Knit vs. Woven', definition: 'Structural category determining elongation, shrinkage allowances, and inspection point scales.' },
    ],
    tips: [
      'Ensure HSN codes match current GST statutory tables to prevent tax discrepancy warnings during e-invoicing.',
    ],
  },

  uomMaster: {
    title: 'Units of Measurement (UOM)',
    subtitle: 'Standard measurement units, precision decimal rules, and metric conversions.',
    purpose: 'The UOM Master defines all operational and commercial units of measurement (Meters, Kilograms, Yards, Rolls, Pieces, Boxes) and establishes universal conversion equations to enable dual-unit inventory tracking (e.g., rolls to meters or meters to weight).',
    workflow: ['Register Unit Symbol & Code', 'Set Decimal Precision (0-4)', 'Configure Conversion Multipliers', 'Assign Default Category UOM'],
    keyTerms: [
      { term: 'Base Unit', definition: 'The canonical reference unit in which general ledger stock valuation is recorded.' },
      { term: 'Secondary / Dual Unit', definition: 'Parallel unit captured during physical intake (e.g., Pieces / Rolls alongside Meters).' },
      { term: 'Conversion Factor', definition: 'Mathematical multiplier used to calculate base units from packaging units.' },
    ],
    tips: [
      'Maintain at least 2 decimal places for linear meters and 3 decimal places for kilogram-based raw materials.',
      'Do not modify conversion ratios of active units with open transactions; create a new unit instead.',
    ],
  },

  fabricCategories: {
    title: 'Fabric Categories & Taxonomies',
    subtitle: 'Multi-tier hierarchical category taxonomy for items, raw materials, and finished goods.',
    purpose: 'The Categories Master organizes all products, components, machines, and textile rolls into a structured parent-child taxonomy. It streamlines catalog browsing, automated price tier applications, and category-level inventory valuation audits.',
    workflow: ['Establish Root Category', 'Add Nested Sub-Categories', 'Map Default Expense / Revenue Accounts', 'Assign Items'],
    keyTerms: [
      { term: 'Parent Category', definition: 'Top-level group (e.g., Grey Fabric, Finished Goods, Chemicals & Dyes).' },
      { term: 'Category Code', definition: 'Structured code indicating department and taxonomy level (e.g., CAT-TEX-01).' },
      { term: 'Ledger Mapping', definition: 'Default sales and purchase GL accounts automatically populated on invoices for items in this category.' },
    ],
    tips: [
      'Use the Tree view to review deep hierarchies before publishing new sub-categories.',
    ],
  },

  textileMasters: {
    title: 'Textile Masters Directory',
    subtitle: 'Central hub for agencies, processors, brokers, processes, and contracted jobwork rates.',
    purpose: 'The Textile Masters Hub serves as the unified administrative console for all external textile stakeholders: grey fabric agencies, dyeing and printing mills, commission brokers, standard manufacturing processes, contracted rates, and defect codes.',
    workflow: ['Manage Agencies & Processors', 'Configure Process Definitions', 'Set Contracted Rate Matrix', 'Define Defects & Loss Codes'],
    keyTerms: [
      { term: 'Processor / Job Worker', definition: 'External industrial mill contracted to perform dyeing, printing, bleaching, or finishing.' },
      { term: 'Process Master', definition: 'Standardized operational processing stage (e.g., RFD, Jet Dyeing, Rotary Printing, Stenter).' },
      { term: 'Job-Work Rate Matrix', definition: 'Three-way contracted price matrix based on Processor × Process × Fabric Quality.' },
      { term: 'Defect Taxonomy', definition: 'Catalog of visual and structural faults used in 4-Point QC inspection scoring.' },
    ],
    tips: [
      'Update contracted rates with effective dates to ensure job work orders calculate accurate job charges automatically.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // QUALITY CONTROL (QC)
  // ────────────────────────────────────────────────────────────
  qcRegister: {
    title: 'QC Inspection Register',
    subtitle: 'Roll-by-roll fabric inspection, 4-Point defect scoring, length verification, and grading.',
    purpose: 'The QC Inspection Register records comprehensive quality audits of inward grey or finished fabric rolls using the international 4-Point System. It calculates penalty points per 100 sq meters, assigns commercial roll grades (A, B, C, Reject), and flags shrinkage deviations.',
    workflow: ['Scan Roll / Taka Barcode', 'Log Defect Coordinates & Sizes', 'Calculate Penalty Points / Grade', 'Approve for Warehouse Binning'],
    keyTerms: [
      { term: '4-Point System', definition: 'Standard textile scoring: defects <3" = 1pt, 3-6" = 2pts, 6-9" = 3pts, >9" = 4pts. Max 4 points per linear yard.' },
      { term: 'Penalty Points / 100m²', definition: 'Normalized defect density index used to determine if a roll qualifies as Fresh (Grade A) or Seconds.' },
      { term: 'Taka / Roll Tag', definition: 'Physical barcode label affixed to the roll identifying mill, lot, quality, and inspected length.' },
      { term: 'Inspected vs Billed Mtrs', definition: 'Discrepancy audit between supplier delivery note meters and actual measured roll meters.' },
    ],
    tips: [
      'Use keyboard shortcuts to log defects during continuous fabric roll rolling on inspection tables.',
      'Rolls scoring Grade C or Reject automatically isolate into the Quarantine godown to prevent accidental dispatch.',
    ],
  },

  qcPending: {
    title: 'QC Pending Inspections',
    subtitle: 'Goods dock receipts awaiting formal quality audit and laboratory verification.',
    purpose: 'QC Pending Inspections provides a prioritized triage queue of inward goods receipt notes (GRN) and processed fabric delivery lots that require physical testing, shade approval, or 4-point roll inspection before stock release.',
    workflow: ['Triage by Priority & Aging', 'Assign Inspector / Workstation', 'Begin Measurement & Testing', 'Generate Inspection Certificate'],
    keyTerms: [
      { term: 'Dock Holding Area', definition: 'Temporary physical staging buffer where uninspected pallets remain quarantined.' },
      { term: 'Inspection SLA', definition: 'Target turnaround time (e.g., 24 hours) between dock intake and QC pass/fail disposition.' },
    ],
    tips: [
      'Prioritize lots linked to urgent customer sales orders flagged with the Urgent badge.',
    ],
  },

  qcReinspection: {
    title: 'QC Reinspection / Reprocess',
    subtitle: 'Secondary audit of disputed lots, re-rolled fabric, or reprocessed batches.',
    purpose: 'Manages lots that previously failed initial inspection or were returned by clients for defect re-evaluation. It allows quality teams to re-measure rolls after chemical stripping, re-dyeing, or edge trimming to determine secondary commercial grade.',
    workflow: ['Select Disputed Lot', 'Audit Corrective Action Performed', 'Execute Re-Inspection Audit', 'Assign Revised Commercial Grade'],
    keyTerms: [
      { term: 'Re-Inspection Reason', definition: 'Root cause for secondary review (e.g., Supplier Dispute, Strip & Redye, Client Return).' },
      { term: 'Downgraded Sale', definition: 'Authorization to sell seconds fabric at clearance salvage price.' },
    ],
    tips: [
      'Document previous inspection numbers in the audit notes for transparent warranty and supplier debit tracking.',
    ],
  },

  qcDisposition: {
    title: 'QC Results & Disposition',
    subtitle: 'Commercial dispositioning: Accepted, Debit Note to Vendor, Concession, or Scrap.',
    purpose: 'The QC Disposition engine converts technical inspection verdicts into commercial business decisions. When fabric fails tolerances, quality managers decide whether to accept with commercial discount, raise supplier debit notes, or return for reprocessing.',
    workflow: ['Review Failed Inspection Data', 'Select Commercial Resolution', 'Trigger Automated Debit Note / RMA', 'Release Stock to Destination'],
    keyTerms: [
      { term: 'Commercial Concession', definition: 'Accepting sub-optimal fabric with negotiated supplier discount or price reduction.' },
      { term: 'Debit Note Trigger', definition: 'Automated accounts payable deduction for short length, high shrinkage, or defect rate.' },
      { term: 'Return to Vendor (RTV)', definition: 'Immediate physical rejection and outward dispatch of non-conforming goods.' },
    ],
    tips: [
      'Debit notes generated here automatically post directly to Accounts Payable for supplier reconciliation.',
    ],
  },

  qcReports: {
    title: 'QC Analytics & Defect Reports',
    subtitle: 'Supplier quality ratings, defect Pareto analysis, and shrinkage trend analytics.',
    purpose: 'Provides statistical quality intelligence across suppliers, processors, and fabric constructions. Identifies recurring manufacturing faults (e.g., oil stains, weft bars, color patchiness) to guide vendor renegotiations and process improvements.',
    workflow: ['Select Date Range & Mill', 'Analyze Defect Pareto Distribution', 'Review Supplier Quality Scorecard', 'Export Executive Audit Report'],
    keyTerms: [
      { term: 'Defect Pareto Chart', definition: 'Identifies the top 20% of defect types contributing to 80% of total quality deductions.' },
      { term: 'Vendor Pass Rate (%)', definition: 'Percentage of delivered lots meeting Grade A fresh commercial specifications.' },
    ],
    tips: [
      'Export quarterly supplier scorecards prior to annual vendor rate contract renewals.',
    ],
  },

  qcDashboard: {
    title: 'Quality Control Dashboard',
    subtitle: 'Real-time overview of inspection volume, pass/fail ratios, and defect trends.',
    purpose: 'The QC Dashboard gives operations executives immediate bird’s-eye visibility into daily dock inspection throughput, active quarantine hold balances, inspector workloads, and real-time pass/fail rates across all warehouses.',
    workflow: ['Monitor Real-Time Inspection KPIs', 'Track Quarantine Hold Balances', 'Action Escalated Dispositions', 'Review Shift Throughput'],
    keyTerms: [
      { term: 'First-Pass Yield', definition: 'The proportion of rolls passing inspection on the first attempt without rework.' },
      { term: 'Quarantine Hold Value', definition: 'Total inventory capital locked in unresolved quality disputes.' },
    ],
    tips: [
      'Set alert notifications for any lot spending over 48 hours in unresolved quarantine.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // JOB WORK & PROCESSING (PMS PROCESSING)
  // ────────────────────────────────────────────────────────────
  jobWorkOrders: {
    title: 'Job Work Orders (JWO)',
    subtitle: 'Subcontracting grey fabric processing to external dye houses, printers, and finish mills.',
    purpose: 'The Job Work Order (JWO) is an official manufacturing subcontract issued to external processors (dyeing, printing, bleaching, finishing). It specifies grey input lot meters, chemical processing instructions, expected yield/shrinkage percentages, and contracted processing rates.',
    workflow: ['Draft Job Work Order', 'Specify Process & Input Grey Lots', 'Set Contracted Rate & Date', 'Issue JWO & Dispatch Grey Fabric'],
    keyTerms: [
      { term: 'Job Work Order (JWO)', definition: 'A legally binding subcontract specifying fabric processing instructions and rates.' },
      { term: 'Process Type', definition: 'Specific chemical or mechanical operation (e.g., Jet Dyeing, Rotary Print, Stenter Finishing).' },
      { term: 'Process Loss / Shrinkage (%)', definition: 'Contracted allowable shrinkage allowance (typically 3% to 8% depending on fabric quality).' },
      { term: 'Balance Pending', definition: 'Remaining processed meters expected to be delivered back by the processor.' },
    ],
    tips: [
      'Rates auto-populate from the contracted Job-Work Rate Matrix when selecting processor, process, and quality.',
      'Check the Grey Stock Position before creating JWOs to verify physical grey lot availability.',
    ],
  },

  jobWorkInward: {
    title: 'Job Work Inward (Processed Intake)',
    subtitle: 'Intake of finished/processed fabric rolls returned by external processing mills.',
    purpose: 'Job Work Inward logs the physical return of finished fabric from external processors. It captures incoming delivery challan numbers, actual received meters/weight, checks shrinkage against contracted limits, and routes rolls directly to QC inspection.',
    workflow: ['Select JWO & Processor', 'Enter Received Meters & Roll Count', 'Verify Shrinkage Tolerance', 'Post Inward & Forward to QC'],
    keyTerms: [
      { term: 'Inward Delivery Challan', definition: 'The processor\'s shipping document accompanying the returned processed rolls.' },
      { term: 'Actual vs. Expected Yield', definition: 'Comparison between calculated finished meters and actual delivered meters.' },
      { term: 'Excess Shrinkage Penalty', definition: 'Deductions charged to processor for fabric loss exceeding contracted allowable percentage.' },
    ],
    tips: [
      'Record roll count alongside linear meters to ensure all physical pieces match the processor delivery slip.',
    ],
  },

  jobWorkOutward: {
    title: 'Job Work Outward (Grey Dispatch)',
    subtitle: 'Physical dispatch of grey fabric rolls from warehouse dock to external processors.',
    purpose: 'Generates official statutory Delivery Challans and Gate Passes for dispatching raw grey fabric rolls to outside processing mills under statutory GST provisions. It tracks transporter LR numbers, vehicle details, and deducts goods from on-hand warehouse stock.',
    workflow: ['Select JWO & Reserve Grey Lots', 'Scan Taka Barcodes for Dispatch', 'Generate GST Delivery Challan', 'Issue Gate Pass & Handover to Transporter'],
    keyTerms: [
      { term: 'Outward Delivery Challan', definition: 'Mandatory GST shipping document allowing movement of goods without tax invoice.' },
      { term: 'Transporter LR Number', definition: 'Lorry Receipt reference number issued by the freight carrier.' },
      { term: 'Goods with Processor', definition: 'Inventory ledger state indicating company-owned stock temporarily situated at third-party premises.' },
    ],
    tips: [
      'Print triplicate copies of the delivery challan: one for transporter, one for processor acknowledgment, and one for security gate records.',
    ],
  },

  processPlanList: {
    title: 'Process Plans Directory',
    subtitle: 'Standardized operational recipes, sequential manufacturing routings, and stage flows.',
    purpose: 'The Process Plan defines the multi-step technical routing required to convert raw grey material into a finished textile product. It specifies operational steps (Scouring → Bleaching → Dyeing → Printing → Curing → Finishing), standard process durations, and machine parameters.',
    workflow: ['Create Process Plan Code', 'Sequence Manufacturing Stages', 'Define Standard Yields & Loss %', 'Link to Fabric Qualities'],
    keyTerms: [
      { term: 'Process Routing', definition: 'The sequential path of operations through which material travels during conversion.' },
      { term: 'Stage Duration (SLA)', definition: 'Standard expected business hours required to complete a specific process stage.' },
      { term: 'Yield Parameter', definition: 'Theoretical recovery percentage expected at the conclusion of the process plan.' },
    ],
    tips: [
      'Link process plans to fabric qualities to auto-populate production instructions on custom project orders.',
    ],
  },

  pendingJobWork: {
    title: 'Pending Job Work Register',
    subtitle: 'Real-time ledger of company grey fabric currently situated with external processors.',
    purpose: 'The Pending Job Work Register provides real-time audit control over all outstanding job work orders. It highlights lots overdue for return, processor-wise material holding balances, and tracks statutory 1-year GST return compliance windows.',
    workflow: ['Filter by Processor & Aging', 'Identify Delayed Returns', 'Issue Expedite Reminders', 'Audit Physical Floor Balances'],
    keyTerms: [
      { term: 'Aging Days', definition: 'Calendar days elapsed since grey fabric was dispatched to the processor.' },
      { term: 'Statutory 1-Year Limit', definition: 'GST regulation requiring job-work goods to return within 1 year to avoid tax reversal.' },
    ],
    tips: [
      'Export the monthly aging report to send formal reconciliation statements to all external processing partners.',
    ],
  },

  processorLedger: {
    title: 'Processor Ledger & Commercials',
    subtitle: 'Processing charges, bill approvals, debit note offsets, and financial disbursements.',
    purpose: 'The Processor Ledger manages commercial billing and financial statements for external job-workers. It reconciles completed inward deliveries with processor invoices, verifies billed rates against contracted matrices, applies shrinkage penalty debit notes, and tracks net payables.',
    workflow: ['Receive Processor Invoice', 'Match with Inward Deliveries', 'Apply Debit Notes & TDS', 'Approve for Accounts Payable'],
    keyTerms: [
      { term: 'Processing Charges', definition: 'Cost per meter or kilogram billed by the processor for conversion services.' },
      { term: 'Penalty Offset', definition: 'Debit note deductions applied against processor bills for damage or excessive loss.' },
    ],
    tips: [
      'Cross-check inward delivery dates with billing periods to prevent duplicate bill submissions.',
    ],
  },

  reprocessPage: {
    title: 'Fabric Reprocess & Corrections',
    subtitle: 'Strip-and-redye workflows, corrective washing, and remedial lot reprocessing.',
    purpose: 'Manages lots rejected during QC inspection due to shade variance, patchy dyeing, or surface blemishes. It creates specialized Reprocess Orders to instruct mills on corrective procedures (e.g., chemical stripping, over-dyeing, re-finishing).',
    workflow: ['Select Rejected Lot', 'Specify Corrective Process & Recipe', 'Dispatch for Remedial Run', 'Inspect Corrected Return'],
    keyTerms: [
      { term: 'Strip & Redye', definition: 'Chemical discharge of existing dye followed by fresh dye application to achieve target shade.' },
      { term: 'Secondary Yield Loss', definition: 'Additional length or weight lost during remedial processing.' },
    ],
    tips: [
      'Maintain separate accounting tags for reprocess costs to evaluate processor accountability.',
    ],
  },

  itc04Report: {
    title: 'ITC-04 Statutory GST Annexure',
    subtitle: 'Quarterly statutory tax filing report for inputs and capital goods sent to job workers.',
    purpose: 'Generates the official government GST ITC-04 quarterly compliance statement detailing inputs and capital goods sent to job workers, received back from job workers, or supplied directly from job worker premises under GST Act provisions.',
    workflow: ['Select Quarter & Fiscal Year', 'Auto-Populate Inward / Outward Records', 'Verify HSN Codes & Values', 'Export Government JSON / Excel'],
    keyTerms: [
      { term: 'Table 1 (Goods Sent)', definition: 'Statutory schedule of inputs dispatched to job workers during the quarter.' },
      { term: 'Table 2 (Goods Received)', definition: 'Statutory schedule of processed inputs received back or dispatched to clients.' },
      { term: 'Challan Reversal Alert', definition: 'Automatic warning for goods approaching the 1-year statutory return deadline.' },
    ],
    tips: [
      'Run reconciliation at least 5 days prior to the statutory GST ITC-04 quarterly filing deadline.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT SYSTEM (PMS) & PRODUCTION
  // ────────────────────────────────────────────────────────────
  pmsDashboard: {
    title: 'PMS Execution Dashboard',
    subtitle: 'Project delivery tracking, critical path milestones, stage status, and bottleneck alerts.',
    purpose: 'The PMS Dashboard is the executive mission control center for custom textile, apparel, and printing manufacturing projects. It tracks overall project completion velocities, active stage distributions, critical path delays, and resource allocations.',
    workflow: ['Review High-Level KPIs', 'Inspect Delayed Stages', 'Prioritize Urgent Milestones', 'Track Production Output'],
    keyTerms: [
      { term: 'Project Completion %', definition: 'Weighted progress derived from completed vs planned milestone stages.' },
      { term: 'Critical Path', definition: 'The sequence of dependent project stages determining the earliest possible completion date.' },
      { term: 'At Risk Milestone', definition: 'A stage whose projected finish date threatens downstream delivery deadlines.' },
    ],
    tips: [
      'Filter by Project Manager to review team workloads during weekly production planning reviews.',
    ],
  },

  projectsList: {
    title: 'Projects Directory',
    subtitle: 'Comprehensive master registry of customer custom manufacturing projects and orders.',
    purpose: 'The Projects Directory catalogs all active, pending, and completed custom production projects. It provides search, multi-criteria filtering, budget tracking, delivery date monitoring, and one-click access to complete project workspaces.',
    workflow: ['Create Project from Sales Order', 'Assign Project Lead & Team', 'Configure Custom Stages & Dates', 'Monitor Execution to Delivery'],
    keyTerms: [
      { term: 'Project Code (PRJ-)', definition: 'Unique tracking code tying customer orders, BOM parts, and production tasks together.' },
      { term: 'Customer Reference', definition: 'Linked commercial client account governing project specifications and invoicing.' },
      { term: 'Target Handover Date', definition: 'Committed commercial delivery date promised to the client.' },
    ],
    tips: [
      'Use the Status toggle to switch between Active, At Risk, Delayed, and Completed project views.',
    ],
  },

  projectDetail: {
    title: 'Project Workspace & Details',
    subtitle: 'End-to-end project execution hub: timeline, approvals, documents, and task handoffs.',
    purpose: 'The Project Workspace provides an interactive four-tab command console for an individual project: Stage Timeline & Gantt, Client & Internal Approvals, Activity Audit Trails, and Document Proofs.',
    workflow: ['Track Stage Progression', 'Complete Checklist Tasks', 'Secure Client Proof Sign-Off', 'Handoff to Next Stage'],
    keyTerms: [
      { term: 'Stage Handoff', definition: 'Formal sign-off transferring responsibility from one operational department to the next.' },
      { term: 'Proof Approval', definition: 'Digital customer sign-off on artwork, lab dip, or pre-production sample.' },
    ],
    tips: [
      'All stage transitions, delay logs, and approvals are permanently immutably recorded in the Activity tab.',
    ],
  },

  myTasks: {
    title: 'My Actionable Tasks',
    subtitle: 'Personalized task queue, checklist items, completion sliders, and stage handoffs.',
    purpose: 'The My Tasks interface filters the enterprise work breakdown structure to display only tasks and stage deliverables directly assigned to the logged-in user. Features inline progress sliders, priority tags, and quick completion toggles.',
    workflow: ['Review High-Priority Tasks', 'Update Completion % Slider', 'Add Task Execution Notes', 'Mark Done & Handoff'],
    keyTerms: [
      { term: 'Due Today / Overdue', definition: 'Tasks requiring immediate action to prevent project timeline slippage.' },
      { term: 'Task Checklist', definition: 'Sub-action items that must all be checked before completing the parent task.' },
    ],
    tips: [
      'Moving the progress slider immediately synchronizes the project\'s overall completion percentage.',
    ],
  },

  stageConfig: {
    title: 'Project Stages Configuration',
    subtitle: 'Define standardized project workflow templates, stage sequences, and SLA milestones.',
    purpose: 'Allows administrators to configure standard project stage pipelines (e.g., Fabric Sourcing → Lab Dip Approval → Dyeing → Printing → Stitching → QC → Packaging). Defines required approval gates, default durations, and weighted progress percentages.',
    workflow: ['Create Pipeline Template', 'Add & Order Stages', 'Define Default SLA Days & Weight %', 'Publish for New Projects'],
    keyTerms: [
      { term: 'Stage Weight (%)', definition: 'Contribution of an individual stage to the total 100% completion gauge.' },
      { term: 'Mandatory Approval Gate', definition: 'Requirement blocking stage progression until designated manager or client signs off.' },
    ],
    tips: [
      'Ensure the sum of all stage weights in a template equals exactly 100%.',
    ],
  },

  timelineGantt: {
    title: 'Milestone Timeline & Gantt',
    subtitle: 'Interactive schedule visualization, stage dependencies, and critical path analysis.',
    purpose: 'Visualizes all active project stages on an interactive horizontal Gantt calendar timeline. Enables managers to identify scheduling overlaps, track dependencies, detect bottlenecks early, and adjust timelines via drag-and-drop.',
    workflow: ['Switch Zoom (Days/Weeks/Months)', 'Review Stage Dependencies', 'Identify Schedule Overlaps', 'Adjust Deadlines as Needed'],
    keyTerms: [
      { term: 'Dependency Link', definition: 'Predecessor-successor relationship (e.g., Printing cannot begin before Lab Dip is Approved).' },
      { term: 'Slack / Buffer Time', definition: 'Available leeway before a stage delay impacts the final delivery date.' },
    ],
    tips: [
      'Use the zoom controls to inspect daily shift timelines or monthly executive roadmaps.',
    ],
  },

  delayDashboard: {
    title: 'Delay Root-Cause Dashboard',
    subtitle: 'Bottleneck tracking, delay cause categorization, and resolution action logs.',
    purpose: 'Analyzes root causes of project and production schedule delays (e.g., Raw Material Stockout, Machine Breakdown, Client Design Revision, External Processor Delay). Facilitates root-cause mitigation and corrective action plans.',
    workflow: ['Log Delay Event & Reason', 'Assign Responsible Party', 'Formulate Mitigation Plan', 'Track Resolution Timeline'],
    keyTerms: [
      { term: 'Delay Category', definition: 'Taxonomy of slippage reasons: Supplier, Technical, Client, Logistics, or Internal.' },
      { term: 'Mitigation Plan', definition: 'Documented corrective strategy to recover lost schedule time.' },
    ],
    tips: [
      'Review monthly delay trends to renegotiate supplier lead times that repeatedly cause production stoppages.',
    ],
  },

  clientProofApproval: {
    title: 'Client Proof Approval & Sign-Off',
    subtitle: 'Digital artwork, sample photo, and specification proof approval workflow for clients.',
    purpose: 'Manages the pre-production design approval cycle. Upload PDF proofs, CAD drawings, lab-dip photos, or measurement spec sheets, generate a secure client review link, and record timestamped client sign-offs or revision requests.',
    workflow: ['Upload Design Proof / Spec Sheet', 'Generate Secure Share Link', 'Client Reviews & Approves/Revises', 'Production Release Triggered'],
    keyTerms: [
      { term: 'Digital Proof', definition: 'Visual representation of the final product requiring client validation before production cut.' },
      { term: 'Timestamped Audit Trail', definition: 'Legally defensible log of client IP, timestamp, and sign-off signature.' },
    ],
    tips: [
      'Lock production instructions until client proof approval is formally recorded as Approved.',
    ],
  },

  productionDashboard: {
    title: 'Production Operations Dashboard',
    subtitle: 'Shop-floor machine status, shift outputs, active work orders, and efficiency metrics.',
    purpose: 'The Production Dashboard provides factory floor managers with real-time insight into manufacturing capacity, active job order progress, machine utilization rates, scrap generation, and daily shift target achievements.',
    workflow: ['Monitor Live Machine Output', 'Track Shift Target Achievement', 'Identify Idle / Down Lines', 'Balance Work-in-Progress (WIP)'],
    keyTerms: [
      { term: 'Work-in-Progress (WIP)', definition: 'Fabric units and garments currently undergoing conversion on the shop floor.' },
      { term: 'OEE (Overall Equipment Effectiveness)', definition: 'Composite benchmark of machine Availability, Performance, and Quality yield.' },
    ],
    tips: [
      'Review downtime logs at shift changeover meetings to address maintenance bottlenecks.',
    ],
  },

  productionInstructions: {
    title: 'Production Instructions & Routing',
    subtitle: 'Job routing cards, cutting orders, stitch batch instructions, and operator specs.',
    purpose: 'Issues official work instruction routing sheets to shop floor operators. Specifies fabric lot numbers, cut ratios, stitch construction, thread types, packaging guidelines, and required inline quality check points.',
    workflow: ['Generate Job Card from Project', 'Specify Cut Ratios & Fabric Lots', 'Print Shop Floor Routing Sheet', 'Track Completed Batch Intake'],
    keyTerms: [
      { term: 'Job Card / Route Sheet', definition: 'Physical or digital work instruction following material across assembly operations.' },
      { term: 'Cut Ratio / Marker Spec', definition: 'Size-wise breakdown of garment cuts planned from a given fabric roll lot.' },
    ],
    tips: [
      'Print barcodes on job cards to allow operators to log stage completions via handheld scanners.',
    ],
  },

  dailyProduction: {
    title: 'Daily Production Entry',
    subtitle: 'Operator and supervisor shift output logging, machine hours, and defect recording.',
    purpose: 'Daily manual and scanner entry register for factory supervisors to record completed units, productive machine hours, downtime reasons, and scrap counts across individual machines and assembly lines.',
    workflow: ['Select Shift & Machine Line', 'Enter Output Quantities', 'Log Downtime & Scrap Counts', 'Submit for Supervisor Approval'],
    keyTerms: [
      { term: 'Shift Output', definition: 'Number of verified units produced during a standard 8-hour or 12-hour factory shift.' },
      { term: 'Unplanned Downtime', definition: 'Minutes lost to power failure, mechanical breakdown, or material shortage.' },
    ],
    tips: [
      'Record downtime immediately with precise reason codes for accurate maintenance scheduling.',
    ],
  },

  productionCompletion: {
    title: 'Production Completion & Verification',
    subtitle: 'Final assembly sign-off, packaging verification, and finished goods warehouse handover.',
    purpose: 'Executes the final quality and quantity reconciliation when a production job concludes. Verifies finished unit counts against issued BOM materials, packages finished goods into tagged master cartons, and posts finished inventory into warehouse stock.',
    workflow: ['Count Finished Units', 'Execute Final QA Inspection', 'Package & Affix Master Carton Tags', 'Post Handover to Finished Goods Warehouse'],
    keyTerms: [
      { term: 'Finished Goods Handover', definition: 'Transfer of custody from factory production team to central warehouse dispatch.' },
      { term: 'Material Variance Reconciliation', definition: 'Comparison of planned vs actual raw material consumption.' },
    ],
    tips: [
      'Discrepancies exceeding 2% between cut quantity and finished pack quantity require supervisor sign-off.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // ERP INVENTORY & WAREHOUSE
  // ────────────────────────────────────────────────────────────
  inventoryDashboard: {
    title: 'Inventory Dashboard',
    subtitle: 'Total stock valuation, warehouse capacities, low stock warnings, and turnover ratios.',
    purpose: 'The central command dashboard for supply chain executives. Delivers real-time valuation metrics across raw materials, grey cloth, and finished stock, alerts on reorder deficits, and tracks warehouse capacity utilization.',
    workflow: ['Review Total Stock Value', 'Address Low Stock Reorder Alerts', 'Monitor Stock Turnovers', 'Audit Fast vs Slow Moving SKUs'],
    keyTerms: [
      { term: 'Total Inventory Valuation', definition: 'Cumulative financial worth of on-hand stock calculated via FIFO / Weighted Average.' },
      { term: 'Reorder Deficit Alert', definition: 'Automated notification triggered when available stock dips below safety thresholds.' },
    ],
    tips: [
      'Check the Auto-PO alert card daily to issue supplier orders before production halts occur.',
    ],
  },

  itemsMaster: {
    title: 'Items & SKU Master Catalog',
    subtitle: 'Comprehensive catalog of products, raw materials, machine parts, and textile rolls.',
    purpose: 'The single source of truth for all physical materials managed by the ERP. Defines SKU codes, barcodes, descriptions, purchasing tariffs, selling price lists, HSN tax classifications, safety reorder levels, and preferred vendors.',
    workflow: ['Create Item Record & SKU', 'Define Base & Secondary Units', 'Set Cost & Sales Pricing', 'Assign HSN Code & Warehouse Bin'],
    keyTerms: [
      { term: 'SKU (Stock Keeping Unit)', definition: 'Unique internal inventory identifier assigned to each distinct physical item.' },
      { term: 'Reorder Point (ROP)', definition: 'Inventory level that automatically triggers a purchase replenishment recommendation.' },
      { term: 'Safety Stock', definition: 'Buffer inventory held to protect against unexpected supplier lead-time spikes.' },
    ],
    tips: [
      'Attach technical spec sheets and images to SKUs for instant operator reference on shop floor tablets.',
    ],
  },

  stockPosition: {
    title: 'Warehouse Stock Position',
    subtitle: 'Live on-hand, reserved, allocated, in-transit, and available stock levels.',
    purpose: 'Provides granular visibility into real-time stock balances across all company warehouses. Differentiates between physical on-hand stock, stock reserved for confirmed sales orders, and uncommitted stock available for immediate promise.',
    workflow: ['Search by SKU, Lot or Warehouse', 'Audit Reserved vs Available Balances', 'Export CSV Stock Ledger', 'Initiate Stock Transfer if Deficit'],
    keyTerms: [
      { term: 'On-Hand Stock', definition: 'Total physical quantity residing inside warehouse bins.' },
      { term: 'Allocated / Reserved Stock', definition: 'Stock committed to open sales orders or active production cutting orders.' },
      { term: 'Available to Promise (ATP)', definition: 'Uncommitted stock available for immediate quotation and customer sale.' },
    ],
    tips: [
      'Click on any SKU balance to view its complete inward-outward transaction card history.',
    ],
  },

  stockTransfers: {
    title: 'Inter-Warehouse Stock Transfers',
    subtitle: 'Moving stock between central godowns, assembly bays, and regional branches.',
    purpose: 'Manages authorized stock movements between warehouses, branch offices, and job-worker docks. Enforces dual-step security: Outward Dispatch from sending warehouse, In-Transit custody tracking, and Gate Intake verification at destination.',
    workflow: ['Create Transfer Requisition', 'Pack & Dispatch from Origin', 'Track In-Transit Movement', 'Receive & Reconcile at Destination'],
    keyTerms: [
      { term: 'Transfer Order (STO)', definition: 'Formal authorization document instructing warehouse staff to move specified goods.' },
      { term: 'In-Transit Inventory', definition: 'Goods that have left origin warehouse dock but have not yet been intake-confirmed at destination.' },
    ],
    tips: [
      'Always verify physical package counts before confirming destination goods intake.',
    ],
  },

  locationsPage: {
    title: 'Godown & Rack Locations',
    subtitle: 'Warehouse layout, bin coordinates, capacity limits, and storage zones.',
    purpose: 'Defines the structural physical storage architecture of all company warehouses (Godowns, Zones, Aisles, Racks, Shelves, and Bins). Facilitates directed pick-and-pack operations and prevents warehouse congestion.',
    workflow: ['Create Godown / Facility', 'Map Storage Aisles & Racks', 'Assign Specific Bin Coordinates', 'Set Capacity Constraints'],
    keyTerms: [
      { term: 'Bin Coordinate (e.g., WH1-A-04-B)', definition: 'Precise physical address of a shelf compartment for rapid item retrieval.' },
      { term: 'Storage Zone', definition: 'Designated area tailored for specific goods (e.g., Grey Godown, Chemical Store, Quarantine).' },
    ],
    tips: [
      'Print barcode labels for all bin locations to enable barcode-guided warehouse picking.',
    ],
  },

  lotTakaRegister: {
    title: 'Lot / Taka Register',
    subtitle: 'Individual roll-by-roll textile piece tracking, piece length, grade, and bin location.',
    purpose: 'Provides piece-level textile roll tracking for high-value fabrics. Tracks individual taka numbers, mill lot certificates, exact piece lengths, inspected commercial grade, and precise warehouse rack coordinates.',
    workflow: ['Scan Roll Taka Tag', 'View Piece Length & Quality Grade', 'Check Mill Lot Certificate', 'Assign to Order Picking List'],
    keyTerms: [
      { term: 'Taka / Piece Number', definition: 'Unique sequential identifier stamped on individual fabric rolls.' },
      { term: 'Piece Length', definition: 'Individual measured length of a single roll (typically 80m to 120m).' },
      { term: 'Lot Consistency', definition: 'Ensuring all rolls picked for a single customer order come from the same dye lot to avoid shade variation.' },
    ],
    tips: [
      'Always pick rolls from identical dye lots for garments requiring multi-panel assembly.',
    ],
  },

  tripList: {
    title: 'Logistics & Trip Register',
    subtitle: 'Vehicle dispatch, route tracking, delivery confirmation, and driver assignments.',
    purpose: 'Manages outward logistics, company delivery tempos, external freight carriers, and multi-drop delivery manifests. Tracks driver assignment, vehicle registration, dispatch timestamps, and digital proof-of-delivery (POD) confirmations.',
    workflow: ['Create Trip Manifest', 'Assign Orders, Vehicle & Driver', 'Dispatch Vehicle with Gate Pass', 'Confirm Delivery & Collect POD'],
    keyTerms: [
      { term: 'Trip Manifest', definition: 'Consolidated list of customer delivery challans assigned to a single vehicle run.' },
      { term: 'Proof of Delivery (POD)', definition: 'Customer signed-and-stamped delivery challan acknowledging physical receipt of goods.' },
    ],
    tips: [
      'Upload signed POD photos immediately upon driver return to release billing holds.',
    ],
  },

  sampleList: {
    title: 'Sample Register & Swatch Dispatch',
    subtitle: 'Prospect fabric swatch sampling, showroom hangers, and client sample tracking.',
    purpose: 'Tracks complimentary and billed fabric swatches, sample yardage, and showroom hanger cards provided to prospective fashion clients. Tracks prospect conversion rates from sample dispatches.',
    workflow: ['Log Sample Request', 'Cut & Prepare Swatch / Yardage', 'Dispatch to Prospect / Client', 'Track Follow-Up & Order Conversion'],
    keyTerms: [
      { term: 'Swatch Card', definition: 'Small mounted fabric cuttings displaying all available color shades for a fabric quality.' },
      { term: 'Sample Yardage', definition: 'Short length (1m to 5m) provided to designer clients for pre-production garment prototyping.' },
    ],
    tips: [
      'Review sample conversion ratios monthly to see which fabric qualities generate the highest sales order closures.',
    ],
  },

  faultyParts: {
    title: 'Quarantine & Faulty Parts',
    subtitle: 'Isolation of damaged goods, vendor RMA claim processing, and salvage disposition.',
    purpose: 'Segregates defective materials, transit-damaged rolls, and rejected machine components into a dedicated quarantine ledger. Prevents accidental allocation to customer orders while warranty replacements or vendor credit notes are processed.',
    workflow: ['Isolate Defective Goods', 'Log Failure / Damage Reason', 'Initiate Vendor RMA / Claim', 'Process Replacement or Salvage Scrap'],
    keyTerms: [
      { term: 'RMA (Return Merchandise Authorization)', definition: 'Vendor reference authorizing return of defective materials for credit.' },
      { term: 'Scrap Write-Off', definition: 'Financial write-down of unusable materials beyond recovery.' },
    ],
    tips: [
      'Attach photographs of transit damage to support commercial insurance and vendor claims.',
    ],
  },

  zoneRequests: {
    title: 'Assembly Bay & Zone Requisitions',
    subtitle: 'Internal staging requests for shop-floor lines, assembly bays, and packing stations.',
    purpose: 'Manages internal material requests from factory workstations, assembly bays, and sample rooms. Warehouse staff pick requested materials, verify lot numbers, and deliver goods to designated shop-floor staging zones.',
    workflow: ['Station Issues Requisition', 'Warehouse Reviews & Picks Stock', 'Stage at Workstation Bay', 'Supervisor Acknowledges Intake'],
    keyTerms: [
      { term: 'Staging Bay', definition: 'Buffer area adjacent to assembly line where picked components wait for daily production.' },
      { term: 'Material Requisition Slip (MRS)', definition: 'Internal voucher authorizing stock movement from warehouse to shop floor.' },
    ],
    tips: [
      'Issue zone requisitions at least one shift in advance to maintain continuous assembly flow.',
    ],
  },

  valuationAgeing: {
    title: 'Stock Valuation & Ageing',
    subtitle: 'FIFO / Weighted average valuation, slow-moving inventory, and dead stock analysis.',
    purpose: 'Provides executive financial analysis of warehouse capital investment. Classifies stock into age brackets (0-30 days, 31-60 days, 61-90 days, >90 days) to identify capital locked in stagnant goods and drive clearance campaigns.',
    workflow: ['Select Valuation Method', 'Inspect Aging Bracket Distribution', 'Identify Stagnant / Dead SKUs', 'Plan Clearance / Repurpose'],
    keyTerms: [
      { term: 'Slow-Moving Stock', definition: 'Inventory with zero sales or transfer movement over a 60-day observation window.' },
      { term: 'Dead Stock Provision', definition: 'Accounting reserve for anticipated loss on obsolete fabric or discontinued parts.' },
    ],
    tips: [
      'Create promotional clearance discounts for inventory exceeding 90 days of storage aging.',
    ],
  },

  monthEndAudit: {
    title: 'Month-End Physical Stock Audit',
    subtitle: 'Cycle counting, book vs physical reconciliation, and inventory variance adjustments.',
    purpose: 'Guides the physical inventory counting process during periodic and month-end audits. Compares physical blind counts against ERP system records, quantifies discrepancies, and posts authorized inventory adjustment journal vouchers.',
    workflow: ['Freeze Warehouse Operations', 'Execute Blind Physical Counts', 'Identify Count Variances', 'Post Authorized Stock Adjustments'],
    keyTerms: [
      { term: 'Blind Count', definition: 'Physical counting conducted without showing counters the expected system quantity to ensure honest tally.' },
      { term: 'Stock Adjustment Voucher', definition: 'General ledger journal balancing book inventory with physical stock count.' },
    ],
    tips: [
      'Lock warehouse transaction postings during physical stock count to prevent variance calculation errors.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // ERP SALES & REVENUE OPERATIONS
  // ────────────────────────────────────────────────────────────
  salesDashboard: {
    title: 'Sales Operations Dashboard',
    subtitle: 'Real-time revenue metrics, quotation pipelines, top customers, and dispatch trends.',
    purpose: 'The central executive overview of commercial revenue operations. Tracks monthly revenue against targets, quotation conversion rates, pending dispatch values, customer payment aging, and sales representative league tables.',
    workflow: ['Review Monthly Revenue Target', 'Track Open Quotations Pipeline', 'Accelerate Pending Dispatches', 'Monitor Receivables Aging'],
    keyTerms: [
      { term: 'Order-to-Cash Cycle', definition: 'Elapsed time from initial quotation acceptance to final customer payment realization.' },
      { term: 'Quotation Conversion Rate', definition: 'Percentage of submitted sales proposals successfully converted into confirmed Sales Orders.' },
    ],
    tips: [
      'Focus daily follow-up calls on quotations in Negotiation stage with values above average deal size.',
    ],
  },

  quotations: {
    title: 'Sales Quotations & Estimates',
    subtitle: 'Customer commercial proposals, custom machine BOM pricing, and discount authorizations.',
    purpose: 'Drafts, approves, and manages official price proposals sent to prospective buyers. Supports multi-tier pricing, customer credit limit validation, machine assembly component explosion, terms & conditions, and 1-click conversion to confirmed Sales Orders.',
    workflow: ['Select Customer & Terms', 'Add Item Variants & Machine BOMs', 'Apply Approved Discount & Tax', 'Issue PDF Proposal & Convert to SO'],
    keyTerms: [
      { term: 'Quotation Validity', definition: 'Specified calendar period during which quoted commercial pricing remains legally binding.' },
      { term: 'Credit Limit Check', definition: 'Automated warning if proposed order value would push customer outstanding balance over credit limit.' },
      { term: 'BOM Component Explosion', definition: 'Automatic expansion of composite machinery items into individual sub-assembly parts.' },
    ],
    tips: [
      'Use the Duplicate / Clone action to generate new proposals rapidly from previous winning estimates.',
      'Always verify customer GSTIN status before applying inter-state (IGST) vs intra-state (CGST+SGST) tax rates.',
    ],
  },

  salesOrders: {
    title: 'Sales Orders',
    subtitle: 'Confirmed client purchase commitments driving warehouse allocation and manufacturing.',
    purpose: 'The binding operational order confirming customer intent to purchase. Triggers stock reservations in the warehouse, initiates Auto-PO shortage replenishment if stock is insufficient, and generates production work orders.',
    workflow: ['Convert from Quotation / Create Direct', 'System Checks Stock Availability', 'Reserve On-Hand Stock or Trigger Auto-PO', 'Approve for Picking & Dispatch'],
    keyTerms: [
      { term: 'Sales Order (SO)', definition: 'Official commercial contract binding the enterprise to deliver goods at specified prices.' },
      { term: 'Auto-PO Trigger', definition: 'Instant procurement requisition automatically created when ordered quantities exceed available stock.' },
      { term: 'Picking List', definition: 'Warehouse dispatch document instructing staff which exact rolls or items to pick.' },
    ],
    tips: [
      'Check the Order Fulfillment pill to see if all line items are physically ready for dispatch.',
    ],
  },

  deliveryChallans: {
    title: 'Delivery Challans & Gate Passes',
    subtitle: 'Outward warehouse dispatch documentation, transporter LR details, and gate passes.',
    purpose: 'Generates the official shipping documents that accompany goods leaving company premises. Records package counts, gross weight, transport carrier details, vehicle numbers, and E-Way bill credentials.',
    workflow: ['Select Confirmed Sales Order', 'Verify Picked Serial Numbers / Taka', 'Generate Delivery Challan & Gate Pass', 'Handover to Transporter with E-Way Bill'],
    keyTerms: [
      { term: 'Delivery Challan (DC)', definition: 'Physical delivery document proving transfer of goods to freight carrier.' },
      { term: 'E-Way Bill', definition: 'Mandatory statutory GST document required for transporting goods valued over statutory limits.' },
    ],
    tips: [
      'Always obtain the driver signature and security gate stamp on the gate pass copy.',
    ],
  },

  proformaInvoices: {
    title: 'Proforma Invoices',
    subtitle: 'Advance payment requests, bank wire instructions, and formal commercial estimates.',
    purpose: 'Issues formal advance commercial invoices to customers requiring upfront deposit or wire transfer before order production or shipment dispatch. Does not post to official Accounts Receivable until converted into a final Tax Invoice.',
    workflow: ['Generate Proforma from SO', 'Send to Client with Bank Details', 'Record Advance Payment Receipt', 'Convert to Tax Invoice upon Dispatch'],
    keyTerms: [
      { term: 'Proforma Invoice (PI)', definition: 'Preliminary invoice used to request advance payment without generating tax liability.' },
      { term: 'Advance Deposit', definition: 'Upfront customer funds received prior to goods shipment.' },
    ],
    tips: [
      'Proforma invoices do not impact general ledger revenue; convert them to Tax Invoices to post sales entries.',
    ],
  },

  salesInvoices: {
    title: 'Tax Invoices & Accounts Receivable',
    subtitle: 'GST-compliant tax invoices, accounts receivable posting, and e-invoicing compliance.',
    purpose: 'The official statutory billing document that records revenue in the general ledger and creates an Accounts Receivable asset. Calculates exact CGST/SGST/IGST tax breakdowns, supports e-Invoice QR code generation, and manages customer payment terms.',
    workflow: ['Generate from Delivery Challan', 'Verify Tax & HSN Calculations', 'Generate Government e-Invoice / QR', 'Post to General Ledger & Send PDF'],
    keyTerms: [
      { term: 'Tax Invoice', definition: 'Statutory legal invoice that creates enforceable debt and accounts receivable.' },
      { term: 'IRN (Invoice Reference Number)', definition: 'Unique 64-character hash generated by the government Invoice Registration Portal (IRP).' },
      { term: 'Due Date', definition: 'Final payment deadline calculated by adding credit terms days to the invoice date.' },
    ],
    tips: [
      'Check the E-Invoice Status badge to ensure statutory IRN and QR codes are successfully generated.',
    ],
  },

  paymentIn: {
    title: 'Payment In & Customer Receipts',
    subtitle: 'Recording client settlements, bank wire matching, and clearing invoice balances due.',
    purpose: 'Records customer cash, cheque, NEFT/RTGS, and UPI payments. Automatically applies funds against open customer tax invoices, reduces accounts receivable balance, and synchronizes bank and cash account ledgers.',
    workflow: ['Select Customer & Payment Mode', 'Enter Amount & Transaction Ref', 'Allocate Across Open Invoices', 'Post Receipt & Reconcile Bank'],
    keyTerms: [
      { term: 'Payment Allocation', definition: 'Distributing a single lump-sum customer payment across multiple open invoices.' },
      { term: 'Unallocated Advance', definition: 'Excess customer funds held on account to apply against future invoices.' },
    ],
    tips: [
      'Always enter the bank UTR / reference number to make bank statement reconciliation seamless.',
    ],
  },

  salesReturns: {
    title: 'Sales Returns & Credit Notes',
    subtitle: 'Managing customer returned goods, credit note issuance, and inventory restock.',
    purpose: 'Handles customer goods returns for damage, specification mismatch, or commercial dispute. Automatically generates statutory GST Credit Notes to reverse accounts receivable and returns inspected goods back into warehouse inventory.',
    workflow: ['Select Original Tax Invoice', 'Enter Returned Quantities & Reason', 'Execute QC Intake Inspection', 'Issue Credit Note & Restock Goods'],
    keyTerms: [
      { term: 'Credit Note', definition: 'Statutory accounting voucher reducing the amount owed by a customer on a previously issued invoice.' },
      { term: 'Restock vs Quarantine', definition: 'Deciding whether returned goods return to active stock or isolate for salvage.' },
    ],
    tips: [
      'Always link credit notes to the original tax invoice number to comply with statutory GST filing rules.',
    ],
  },

  warrantyList: {
    title: 'Machine Warranties & AMC Directory',
    subtitle: 'Serialized equipment warranties, annual maintenance contracts, and claim histories.',
    purpose: 'Tracks post-sale machine warranties, serial numbers, preventive maintenance schedules, and Annual Maintenance Contracts (AMC) for industrial equipment. Logs customer service calls and warranty claim replacement parts.',
    workflow: ['Register Machine Serial Number', 'Define Warranty Period & Terms', 'Track Scheduled Maintenance', 'Log Service Claims & Parts'],
    keyTerms: [
      { term: 'AMC (Annual Maintenance Contract)', definition: 'Post-warranty service contract covering periodic servicing and repairs.' },
      { term: 'Serial Number Tracking', definition: 'Individual machine identity tracking to prevent fraudulent warranty claims.' },
    ],
    tips: [
      'Set automated renewal notifications 30 days prior to AMC contract expiration.',
    ],
  },

  brokerCommission: {
    title: 'Broker Commission Ledger',
    subtitle: 'Sales agent commission calculations, trade broker ledgers, and payout approvals.',
    purpose: 'Calculates commission payables owed to external fabric brokers and commercial sales agents. Calculates brokerage percentages based on realized customer invoice collections, applies TDS deductions, and approves commission disbursements.',
    workflow: ['Map Broker to Sales Orders', 'Commission Accrues upon Invoicing', 'Approve upon Customer Payment', 'Disburse Brokerage with TDS'],
    keyTerms: [
      { term: 'Brokerage Rate (%)', definition: 'Agreed percentage of order value payable to the sales intermediary (typically 1% to 2%).' },
      { term: 'TDS (Tax Deducted at Source)', definition: 'Statutory income tax deducted from broker commission payments (Section 194H).' },
    ],
    tips: [
      'Only release broker commission after the corresponding customer tax invoice is fully settled.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // ERP PURCHASE & PROCUREMENT
  // ────────────────────────────────────────────────────────────
  purchaseOrders: {
    title: 'Purchase Orders',
    subtitle: 'Supplier procurement contracts driving inventory replenishment and vendor billing.',
    purpose: 'A Purchase Order (PO) is an official commercial document issued by your business to an external supplier, committing to buy specified quantities of goods at negotiated prices. It serves as the baseline for warehouse goods intake and 3-way matching.',
    workflow: ['Auto-Generated / Draft PO', 'Issued to Vendor', 'Goods Intake & Vendor Bill', '3-Way Match Verified', 'Disbursement Settlement'],
    keyTerms: [
      { term: 'Purchase Order (PO)', definition: 'A legally binding procurement contract sent to a vendor before goods are shipped.' },
      { term: 'Vendor Lead Time', definition: 'The expected days between issuing the PO and receiving physical delivery at the warehouse dock.' },
      { term: 'PO to Bill Conversion', definition: 'Converts the verified order into a vendor invoice and automatically increases warehouse inventory on-hand.' },
    ],
    tips: [
      'Use the Clone button on frequent supplier orders to duplicate items into a new draft in 1 click.',
      'Once goods arrive at the dock, click "Create Bill" to post inventory intake and record Accounts Payable.',
    ],
  },

  goodsReceipt: {
    title: 'Goods Receipt Notes (GRN)',
    subtitle: 'Dockside warehouse intake, packing slip verification, and physical inspection receipts.',
    purpose: 'The Goods Receipt Note (GRN) documents the physical arrival of vendor goods at the warehouse loading dock. Verifies delivered quantities against open Purchase Orders, inspects packaging integrity, and routes materials to QC inspection.',
    workflow: ['Match with Supplier Delivery Note', 'Verify Physical Quantities & Lots', 'Execute Dock Inspection', 'Generate GRN & Release to Stock'],
    keyTerms: [
      { term: 'Goods Receipt Note (GRN)', definition: 'Official warehouse intake document proving physical receipt of vendor materials.' },
      { term: 'Shortage / Excess Delivery', definition: 'Variance between purchase order quantity and actual physical count delivered.' },
    ],
    tips: [
      'Never accept damaged master cartons without documenting photographic proof on the GRN intake record.',
    ],
  },

  purchaseBills: {
    title: 'Purchase Bills & Accounts Payable',
    subtitle: 'Vendor invoices, purchase expense accruals, and Accounts Payable ledger liabilities.',
    purpose: 'Records official vendor commercial bills into the Accounts Payable sub-ledger. Performs 3-way matching against purchase orders and goods receipt notes, verifies GST tax credits, and schedules vendor disbursement payments.',
    workflow: ['Receive Vendor Commercial Bill', 'Perform 3-Way Match with GRN & PO', 'Verify GST Input Tax Credit (ITC)', 'Approve & Schedule Payment'],
    keyTerms: [
      { term: 'Accounts Payable (AP)', definition: 'Short-term debt owed by the enterprise to commercial suppliers and vendors.' },
      { term: 'Input Tax Credit (ITC)', definition: 'GST paid on purchases eligible to offset output GST liability on sales.' },
    ],
    tips: [
      'Verify the vendor GSTIN and invoice date to ensure full statutory Input Tax Credit (ITC) eligibility on GSTR-2B.',
    ],
  },

  paymentOut: {
    title: 'Payment Out & Vendor Disbursements',
    subtitle: 'Vendor disbursements, bank wire transfers, cheque printing, and AP balance clearing.',
    purpose: 'Manages outward payments to suppliers, service providers, and processors. Generates bank transfer manifests (NEFT/RTGS), prints account payee cheques, applies early payment discounts, and clears open purchase bills.',
    workflow: ['Select Vendor & Due Bills', 'Review Cash Flow & Payment Mode', 'Execute Bank Wire / Cheque', 'Post Disbursement & Clear AP'],
    keyTerms: [
      { term: 'Payment Out Voucher', definition: 'Accounting document recording financial disbursement to a commercial vendor.' },
      { term: 'Bank Reconciliation Match', definition: 'Tying issued payments to cleared debit transactions on bank statements.' },
    ],
    tips: [
      'Prioritize payments with vendor cash discount terms to capture savings on raw material procurements.',
    ],
  },

  purchaseReturns: {
    title: 'Purchase Returns & Debit Notes',
    subtitle: 'Returning rejected supplier goods, debit note generation, and AP balance deductions.',
    purpose: 'Manages goods returned to suppliers due to quality inspection failure, short delivery, or commercial dispute. Automatically issues statutory Debit Notes to deduct the supplier’s Accounts Payable balance.',
    workflow: ['Select Original Bill & PO', 'Enter Returned Quantities & Reason', 'Generate Vendor Debit Note', 'Dispatch Goods Back with Gate Pass'],
    keyTerms: [
      { term: 'Debit Note', definition: 'Statutory accounting voucher issued by buyer to vendor reducing accounts payable balance.' },
      { term: 'Rejection Gate Pass', definition: 'Security shipping permit authorizing returned goods to leave company premises.' },
    ],
    tips: [
      'Ensure debit notes are acknowledged in writing by vendor representatives to prevent reconciliation disputes.',
    ],
  },

  expensesPage: {
    title: 'Operating Expenses Management',
    subtitle: 'Factory overheads, administrative expenses, utility bills, and petty cash vouchers.',
    purpose: 'Tracks recurring operational expenses (factory electricity, machinery maintenance, freight inward, travel expenses, office rent, consumables). Allocates costs to operational cost centers and reconciles petty cash drawers.',
    workflow: ['Log Expense Voucher', 'Categorize Expense Ledger Account', 'Attach Invoice / Cash Receipt', 'Approve & Reimburse / Settle'],
    keyTerms: [
      { term: 'Cost Center Allocation', definition: 'Assigning expense amounts to specific departments (Weaving, Dyeing, Admin, Sales).' },
      { term: 'Petty Cash Voucher', definition: 'Small cash disbursement recorded for daily miscellaneous workshop purchases.' },
    ],
    tips: [
      'Attach receipts for all cash purchases exceeding nominal thresholds to maintain audit compliance.',
    ],
  },

  billMatching: {
    title: 'Bill Matching (3-Way Match)',
    subtitle: 'Automated 3-way reconciliation between Purchase Order, Goods Receipt, and Vendor Bill.',
    purpose: 'The automated 3-way match engine compares quantities and unit rates across the Purchase Order, Dock Goods Receipt Note (GRN), and Supplier Invoice. Flags discrepancies exceeding tolerance thresholds before payment approval.',
    workflow: ['System Compares PO vs GRN vs Bill', 'Identify Price or Quantity Variances', 'Investigate Discrepancy Flags', 'Approve Matched Bills for Payout'],
    keyTerms: [
      { term: '3-Way Match', definition: 'Audit control ensuring company only pays for goods that were actually ordered AND physically received.' },
      { term: 'Price Variance Flag', definition: 'Discrepancy alert raised when billed unit rate exceeds contracted purchase order rate.' },
    ],
    tips: [
      'Set tolerance thresholds (e.g. ±1%) to prevent automatic holds on minor rounding variations.',
    ],
  },

  supplierLedger: {
    title: 'Supplier Ledger & Statement',
    subtitle: 'Complete chronological vendor statement of bills, payments, debit notes, and balance due.',
    purpose: 'Provides a running chronological ledger statement for any supplier. Displays all historical bills, payments, debit notes, and running balance due. Facilitates monthly commercial statement reconciliations with vendors.',
    workflow: ['Select Supplier & Date Range', 'Review Chronological Ledger', 'Identify Unreconciled Items', 'Export Official Statement PDF'],
    keyTerms: [
      { term: 'Running Balance', definition: 'Cumulative net balance owed to the supplier at each point in transaction history.' },
      { term: 'Closing Payable', definition: 'Net unsettled liability owed to the vendor as of the statement end date.' },
    ],
    tips: [
      'Send monthly supplier ledger statements to key raw material vendors to prevent billing discrepancies.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // CRM & CUSTOMER LIFECYCLE
  // ────────────────────────────────────────────────────────────
  crmDashboard: {
    title: 'CRM Sales Pipeline Dashboard',
    subtitle: 'Pipeline velocity, funnel conversion rates, sales rep performance, and lead sources.',
    purpose: 'The CRM executive dashboard provides bird’s-eye visibility into new inbound leads, stage-by-stage pipeline velocity, sales rep conversion leaderboards, deal values, and source attribution analytics.',
    workflow: ['Monitor Daily Lead Inflow', 'Analyze Funnel Drop-Off Points', 'Review Sales Rep League Tables', 'Identify High-Value Deals'],
    keyTerms: [
      { term: 'Pipeline Velocity', definition: 'The speed at which prospect leads move from initial capture to closed-won revenue.' },
      { term: 'Lead Attribution', definition: 'Identifying the marketing channel (Web, Exhibition, Referral) generating the lead.' },
    ],
    tips: [
      'Examine stages where leads dwell longest to identify training opportunities for sales reps.',
    ],
  },

  crmLeads: {
    title: 'CRM Leads Directory',
    subtitle: 'Prospect capture, qualification scoring, stage progression, and customer conversion.',
    purpose: 'Central database of all sales inquiries, prospective clients, and trade leads. Manages contact records, lead qualification scores, stage progressions (New Lead → Demo → Proposal → Negotiation), and 1-click conversion into permanent customer trade parties.',
    workflow: ['Capture Lead Inbound', 'Qualify & Score Potential', 'Assign Sales Representative', 'Progress Stages & Convert to Customer'],
    keyTerms: [
      { term: 'Lead Score', definition: 'Numerical rating reflecting prospect purchase budget, authority, need, and timeline (BANT).' },
      { term: 'Lead-to-Customer Conversion', definition: 'Promoting a qualified prospect into an official Trade Party with credit terms.' },
    ],
    tips: [
      'Use the Command Palette (Ctrl+K) or + New button to log inbound phone leads instantly.',
    ],
  },

  leadDetails: {
    title: 'Lead 360 & Dossier',
    subtitle: 'Prospect profile, communication timeline, activity history, and quotation trail.',
    purpose: 'The 360-degree command dossier for a single sales prospect. Displays contact cards, company background, activity notes, scheduled meetings, associated tasks, quotation proposals, and status stage toggles.',
    workflow: ['Review Prospect Background', 'Log Call Notes & Client Needs', 'Schedule Follow-Up Task / Meeting', 'Draft Proposal & Track Status'],
    keyTerms: [
      { term: 'Activity Timeline', definition: 'Reverse-chronological log of all calls, emails, notes, and stage changes for the lead.' },
      { term: 'Primary Contact', definition: 'Designated key decision-maker responsible for commercial negotiations.' },
    ],
    tips: [
      'Log detailed meeting notes immediately following client calls to preserve institutional deal context.',
    ],
  },

  crmTasks: {
    title: 'CRM Tasks & Follow-Ups',
    subtitle: 'Sales activity scheduling, client meetings, demo reminders, and task allocations.',
    purpose: 'Manages sales activities and follow-up schedules. Automatically creates standardized stage tasks (e.g. Send Brochure, Schedule Machine Demo, Collect Trade References) as leads advance through pipeline stages.',
    workflow: ['Review Today\'s Action Items', 'Execute Call / Client Meeting', 'Log Outcome & Schedule Next Step', 'Mark Task Complete'],
    keyTerms: [
      { term: 'Stage Auto-Task', definition: 'Standard operating task blueprint automatically instantiated when a lead enters a stage.' },
      { term: 'Overdue Activity', definition: 'Follow-up commitment past its scheduled execution window.' },
    ],
    tips: [
      'Complete all high-priority follow-up tasks by mid-day to maintain high prospect engagement rates.',
    ],
  },

  dealsPage: {
    title: 'Deals & Sales Pipeline (Kanban)',
    subtitle: 'Drag-and-drop opportunity board, weighted pipeline forecasts, and expected close dates.',
    purpose: 'Visual Kanban pipeline representing active commercial opportunities across deal stages (Discovery, Proposal, Negotiation, Won, Lost). Enables sales leadership to forecast revenue, manage deal aging, and reallocate accounts.',
    workflow: ['Drag Deal Cards Across Stages', 'Update Expected Close Dates', 'Review Weighted Pipeline Forecast', 'Celebrate Closed-Won Milestones'],
    keyTerms: [
      { term: 'Weighted Deal Value', definition: 'Total deal amount multiplied by the probability of closing at its current stage.' },
      { term: 'Deal Slippage', definition: 'An opportunity whose close date has rolled over into subsequent months.' },
    ],
    tips: [
      'Keep expected close dates accurate to produce reliable monthly cash inflow forecasts.',
    ],
  },

  contractsPage: {
    title: 'Contracts & Supply Agreements',
    subtitle: 'Long-term customer supply agreements, contracted price lists, and SLA terms.',
    purpose: 'Manages institutional client supply contracts, annual rate agreements, and minimum volume commitments. Ensures quotations and sales orders automatically reference agreed contracted price ceilings and payment terms.',
    workflow: ['Draft Commercial Agreement', 'Upload Signed Legal Contract', 'Configure Contracted Price Rules', 'Track Renewal Deadlines'],
    keyTerms: [
      { term: 'Rate Agreement', definition: 'Fixed price guarantee protecting client from raw material market fluctuations.' },
      { term: 'Volume Commitment', definition: 'Minimum aggregate meters or value client agrees to procure across contract term.' },
    ],
    tips: [
      'Set automated contract renewal notifications 60 days prior to agreement expiry.',
    ],
  },

  leadFormBuilder: {
    title: 'Lead Form Builder & Dynamic Forms',
    subtitle: 'Visual drag-and-drop web form builder for website lead capture and trade fairs.',
    purpose: 'A visual drag-and-drop form designer that lets marketing teams construct customized web inquiry forms, trade-fair exhibition lead capture surveys, and dynamic customer qualification forms without writing code.',
    workflow: ['Drag Form Fields onto Canvas', 'Configure Validation Rules', 'Set Target Pipeline & Stage', 'Publish & Embed on Website'],
    keyTerms: [
      { term: 'Dynamic Form Schema', definition: 'JSON configuration defining form fields, types, mandatory flags, and layouts.' },
      { term: 'Auto-Assignment Rule', definition: 'Routing newly captured web form leads to designated sales reps based on region.' },
    ],
    tips: [
      'Keep public website lead forms short (under 5 fields) to maximize prospect submission conversion rates.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // FINANCIAL ACCOUNTS & TREASURY
  // ────────────────────────────────────────────────────────────
  cashBank: {
    title: 'Cash & Bank Accounts (Treasury)',
    subtitle: 'Multi-currency bank ledgers, petty cash drawers, bank reconciliation, and cash flow.',
    purpose: 'The central treasury console managing all corporate bank accounts, fixed deposit accounts, and physical petty cash drawers. Records internal bank transfers, tracks live cleared balances, and executes bank statement reconciliations.',
    workflow: ['Select Bank / Cash Account', 'View Transaction Journal', 'Execute Contra Transfer', 'Reconcile against Bank Statement'],
    keyTerms: [
      { term: 'Contra Entry', definition: 'Internal financial transfer moving money between company accounts (e.g., Bank to Cash).' },
      { term: 'Cleared vs Book Balance', definition: 'Difference between transactions recorded in ERP and funds cleared by the bank.' },
    ],
    tips: [
      'Perform daily contra reconciliations to detect banking discrepancies or unauthorized charges early.',
    ],
  },

  generalLedger: {
    title: 'General Ledger & Journal Entries',
    subtitle: 'Double-entry accounting journal, chart of accounts, debit/credit audit trails.',
    purpose: 'The financial foundation of the enterprise. Maintains the double-entry Chart of Accounts, records manual adjustment journal vouchers, and automatically aggregates transactions posted from sales, purchase, inventory, and payroll.',
    workflow: ['Draft Journal Voucher (JV)', 'Select Debit & Credit Accounts', 'Verify Balanced Amounts', 'Post to Ledger & Audit Trail'],
    keyTerms: [
      { term: 'Chart of Accounts (COA)', definition: 'Hierarchical structure of all Assets, Liabilities, Equity, Revenue, and Expense accounts.' },
      { term: 'Journal Voucher (JV)', definition: 'Double-entry accounting entry balancing debits and credits with an audit narration.' },
    ],
    tips: [
      'Always enter detailed narration on manual journal entries to ensure clear year-end statutory audit trails.',
    ],
  },

  dayBook: {
    title: 'Day Book & Daily Transactions',
    subtitle: 'Chronological audit trail of all financial transactions recorded on any calendar date.',
    purpose: 'The Day Book provides an unedited chronological ledger of every financial entry posted across the enterprise on a selected working day. Used by accountants to audit daily cash drawers, verify posted sales invoices, and reconcile receipts.',
    workflow: ['Select Calendar Date', 'Filter by Transaction Type', 'Audit Debits & Credits', 'Print Daily Summary Sheet'],
    keyTerms: [
      { term: 'Daily Debit / Credit Total', definition: 'Gross sum of all financial transactions posted during the business day.' },
      { term: 'Voucher Reference', definition: 'Internal sequential voucher number identifying the source document.' },
    ],
    tips: [
      'Review the Day Book at close of business daily to ensure all counter cash settlements match system postings.',
    ],
  },

  financialReports: {
    title: 'Financial Statements & Reports',
    subtitle: 'Real-time Profit & Loss statement, Balance Sheet summary, Trial Balance, and cash flow.',
    purpose: 'Generates real-time, audit-grade financial statements derived dynamically from the general ledger: Profit & Loss Statement (P&L), Balance Sheet, Trial Balance, and Cash Flow Statement. Supports multi-period comparison and department segmentation.',
    workflow: ['Select Fiscal Period & Basis', 'Generate Real-Time Statement', 'Drill Down into Account Sub-Ledgers', 'Export Certified Financial PDF'],
    keyTerms: [
      { term: 'Balance Sheet', definition: 'Financial snapshot of company Assets, Liabilities, and Equity at a specific point in time.' },
      { term: 'Profit & Loss (P&L)', definition: 'Summary of company revenues, cost of goods sold (COGS), and operational expenses.' },
      { term: 'Trial Balance', definition: 'Worksheet verifying that total debits equal total credits across all ledger accounts.' },
    ],
    tips: [
      'Use the drill-down feature to click on any P&L expense line to see its underlying journal entries.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // COMMERCIAL PARTIES & DIRECTORY
  // ────────────────────────────────────────────────────────────
  partiesPage: {
    title: 'Commercial Parties & Directory',
    subtitle: 'Unified enterprise registry of Customers, Vendors, Job Workers, and Trade Brokers.',
    purpose: 'The single master directory for all external commercial entities that transact with the business. Tracks legal entity names, GSTIN credentials, PAN numbers, credit limits, standard payment terms, shipping addresses, and bank accounts.',
    workflow: ['Register Commercial Party', 'Select Party Roles (Customer/Vendor/Broker)', 'Configure Credit Limits & GSTIN', 'Manage Address & Contact Cards'],
    keyTerms: [
      { term: 'Multi-Role Party', definition: 'An entity acting simultaneously as both Customer and Supplier (e.g. trading and jobwork).' },
      { term: 'Credit Limit', definition: 'Maximum approved outstanding receivable balance permitted before order creation locks.' },
      { term: 'GSTIN Validation', definition: 'Verifying 15-digit statutory Goods and Services Tax Identification Number.' },
    ],
    tips: [
      'Enable party role checkboxes to allow a single business entity to be selected in both Sales and Purchase modules.',
    ],
  },

  customersPage: {
    title: 'Customer Accounts & Statements',
    subtitle: 'Client directory, outstanding balances, credit limits, and sales transaction histories.',
    purpose: 'Specialized commercial directory focused exclusively on purchasing clients. Displays live accounts receivable balances, credit limit utilization gauges, overdue invoices, and complete sales document histories.',
    workflow: ['Search Customer Account', 'Review Outstanding Receivables', 'Inspect Credit Limit Health', 'Export Statement of Accounts'],
    keyTerms: [
      { term: 'Accounts Receivable (AR)', definition: 'Total money currently owed to your business by the customer.' },
      { term: 'Credit Overdue Days', definition: 'Number of calendar days an unpaid invoice has exceeded agreed credit terms.' },
    ],
    tips: [
      'Review the credit limit gauge before approving high-value custom production orders.',
    ],
  },

  vendorsPage: {
    title: 'Vendor Master & Supplier Directory',
    subtitle: 'Supplier directory, purchasing terms, bank wire details, and Accounts Payable ledger.',
    purpose: 'Dedicated directory of raw material suppliers, equipment manufacturers, and service contractors. Manages vendor payment terms, bank wire credentials, lead times, tax exemption certificates, and purchase order histories.',
    workflow: ['Search Vendor Record', 'Review Accounts Payable Balance', 'Verify Bank Wire Coordinates', 'Track Procurement Histories'],
    keyTerms: [
      { term: 'Preferred Supplier', definition: 'Designated primary vendor for a given material SKU offering optimal pricing and lead time.' },
      { term: 'MSME Category', definition: 'Statutory small enterprise registration requiring statutory payment settlement within 45 days.' },
    ],
    tips: [
      'Tag MSME registered vendors to ensure payment prioritization within statutory 45-day compliance windows.',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // ADMINISTRATION, GOVERNANCE & REPORTS
  // ────────────────────────────────────────────────────────────
  usersPage: {
    title: 'User Management & Logins',
    subtitle: 'System user accounts, credentials, department assignments, and active session status.',
    purpose: 'Manages user identities, employee logins, temporary password resets, email credentials, departmental allocations, and active session states across the entire enterprise platform.',
    workflow: ['Create User Account', 'Assign Primary Department & Role', 'Set Login Credentials', 'Manage Account Status & Security'],
    keyTerms: [
      { term: 'User Account', definition: 'Authenticated corporate login profile granting access to ERP application features.' },
      { term: 'Account Status', definition: 'Active, Suspended, or Inactive status governing login capability.' },
    ],
    tips: [
      'Always deactivate user accounts immediately upon employee departure to maintain security compliance.',
    ],
  },

  rolesPage: {
    title: 'Roles & Permissions (RBAC)',
    subtitle: 'Role-Based Access Control matrix, module view/edit/delete privileges, and security governance.',
    purpose: 'Defines Role-Based Access Control (RBAC) security policies. Configures granular view, create, edit, delete, export, and approval permissions for each user role (e.g. Sales Rep, Factory Manager, Chief Accountant, HR Lead).',
    workflow: ['Create Corporate Role', 'Configure Module Permissions Matrix', 'Set Financial Approval Ceilings', 'Assign Users to Role'],
    keyTerms: [
      { term: 'RBAC (Role-Based Access Control)', definition: 'Security architecture restricting system access to authorized user tiers.' },
      { term: 'Granular Permissions', definition: 'Field-level or action-level authorization rules (e.g. Can View Cost Price vs Hidden).' },
    ],
    tips: [
      'Follow the principle of least privilege: only grant delete and export permissions to department leaders.',
    ],
  },

  settingsPage: {
    title: 'System Preferences & Organization',
    subtitle: 'Legal entity details, GSTIN, base currency, fiscal periods, and global configurations.',
    purpose: 'The central system configuration hub. Manages company legal entity information, registered GSTIN, base currency (INR, USD, EUR, GBP), active fiscal year calendar, company branding logos, and system-wide default settings.',
    workflow: ['Update Legal Entity Profile', 'Set Base Operating Currency', 'Define Fiscal Year Periods', 'Configure Global Defaults'],
    keyTerms: [
      { term: 'Base Currency', definition: 'Default accounting currency in which all general ledger entries and valuations are recorded.' },
      { term: 'Fiscal Year', definition: 'The 12-month financial accounting period (e.g., April 1 to March 31).' },
    ],
    tips: [
      'Updating company address and GSTIN immediately updates all future printed quotations, invoices, and challans.',
    ],
  },

  alertCenter: {
    title: 'Alert Center & Exception Monitoring',
    subtitle: 'Automated notification center for stockouts, overdue bills, delayed milestones, and approvals.',
    purpose: 'Centralized exception monitoring hub that aggregates automated alerts across all modules: low-stock deficits, overdue customer payments, delayed project milestones, and pending managerial approvals.',
    workflow: ['Inspect Critical Exception Alerts', 'Click Direct Record Link', 'Execute Corrective Action', 'Dismiss / Resolve Alert'],
    keyTerms: [
      { term: 'Exception Alert', definition: 'System-generated warning raised when a business metric breaches preconfigured thresholds.' },
      { term: 'Actionable Notification', definition: 'Alert containing one-click navigation to resolve the underlying condition.' },
    ],
    tips: [
      'Review the Alert Center at the start of each working day to address high-severity operational exceptions.',
    ],
  },

  approvalsInbox: {
    title: 'Approvals Inbox & Authorizations',
    subtitle: 'Centralized queue for purchase orders, credit overrides, discounts, and leave requests.',
    purpose: 'A unified executive authorization inbox consolidating all pending approval requests across departments: Purchase Orders exceeding threshold limits, special quotation discounts, customer credit limit overrides, and staff leave.',
    workflow: ['Review Pending Requests', 'Inspect Document Context & Amounts', 'Approve or Reject with Reason', 'Notify Requester Automatically'],
    keyTerms: [
      { term: 'Approval Threshold', definition: 'Monetary or operational boundary requiring designated managerial sign-off.' },
      { term: 'Delegated Authorization', definition: 'Temporarily transferring approval authority to a peer during manager absence.' },
    ],
    tips: [
      'Provide explanatory comments when rejecting requests to guide team members on required adjustments.',
    ],
  },

  reportsHub: {
    title: 'Reports & Intelligence Hub',
    subtitle: 'Cross-module analytics, business intelligence exports, and executive summaries.',
    purpose: 'The enterprise reporting center providing customizable tabular and visual reports across Sales, Purchase, Inventory, Production, CRM, and Accounts. Supports multi-parameter filtering, scheduling, and Excel/CSV/PDF exports.',
    workflow: ['Select Report Category', 'Configure Filters & Date Range', 'Generate Real-Time Table & Visuals', 'Export or Schedule Distribution'],
    keyTerms: [
      { term: 'Executive Report', definition: 'Curated business intelligence synthesis highlighting top-line KPIs.' },
      { term: 'Export Format', definition: 'Standard data file (CSV, Excel, PDF) generated for external auditing.' },
    ],
    tips: [
      'Bookmark frequently generated reports for quick one-click access from the main navigation.',
    ],
  },

  ownerMIS: {
    title: 'Owner Executive MIS Dashboard',
    subtitle: 'Top-level management information system with consolidated company KPIs and health.',
    purpose: 'The executive briefing dashboard built exclusively for business owners and C-suite executives. Synthesizes overall business health: cash & bank balances, accounts receivable aging, net profit margins, order backlog values, and factory utilization.',
    workflow: ['Review Top-Line Financial Health', 'Audit Cash & Working Capital', 'Examine Revenue Backlog', 'Inspect Departmental Performance'],
    keyTerms: [
      { term: 'Working Capital', definition: 'Current Assets minus Current Liabilities; indicator of short-term financial strength.' },
      { term: 'Order Backlog', definition: 'Total value of confirmed sales orders pending warehouse fulfillment and dispatch.' },
    ],
    tips: [
      'Review the Cash Burn vs Collection ratio weekly to ensure robust working capital liquidity.',
    ],
  },

  dashboardOverview: {
    title: 'Evenmore ERP Main Dashboard',
    subtitle: 'Enterprise-wide operational overview connecting Sales, Purchase, Inventory, CRM, and Finance.',
    purpose: 'The central landing command center of Evenmore ERP. Provides unified visibility into daily business operations, quick creation shortcuts, active orders, pending shipments, urgent approvals, and system notifications.',
    workflow: ['Check System Announcements', 'Use Quick Action Shortcuts', 'Monitor Operational Tiles', 'Navigate to Target Modules'],
    keyTerms: [
      { term: 'Quick Actions (+ New)', definition: 'Universal header button triggering rapid creation of Leads, Orders, Invoices, and SKUs.' },
      { term: 'Live Sync', definition: 'Real-time database connectivity ensuring entries immediately reflect across all modules.' },
    ],
    tips: [
      'Press Ctrl+K anywhere in the application to bring up universal search and instant navigation.',
    ],
  },
};

/**
 * Universal key resolution mapping from friendly page titles, slugs, and URL tokens
 * to guide dictionary entries.
 */
export const TITLE_MAP = {
  // Existing HRMS mappings
  'Dashboard Overview': 'dashboardOverview',
  'Main Dashboard': 'dashboardOverview',
  'Business Position': 'dashboardOverview',
  'HRMS Dashboard': 'dashboard',
  'Employee Directory': 'employees',
  'Attendance Management': 'attendanceOverview',
  'Mark Attendance': 'attendanceMark',
  'Individual Attendance': 'attendanceIndividual',
  'Bulk Attendance': 'attendanceBulk',
  'Attendance Requests': 'attendanceRequests',
  'Attendance Flexibility Rules': 'attendanceFlexibility',
  'Leave Management': 'leave',
  'Payroll Management': 'payroll',
  'Recruitment Operations': 'recruitmentDashboard',
  'Recruitment & Talent Hub': 'recruitmentDashboard',
  'Recruitment': 'recruitmentDashboard',
  'Job Requisitions': 'jobs',
  'Job Requisitions & Openings': 'jobs',
  'Job Openings': 'jobs',
  'Jobs': 'jobs',
  'Job Details': 'jobDetails',
  'Job Requisition Details': 'jobDetails',
  'Candidate Directory & Pipeline': 'candidates',
  'Candidates': 'candidates',
  'Candidate Profile': 'candidateDetails',
  'Candidate Profile & Dossier': 'candidateDetails',
  'Interview Schedules': 'interviews',
  'Interviews': 'interviews',
  'Interview Details': 'interviewDetails',
  'Interview Assessment Details': 'interviewDetails',
  'Job Applications': 'applications',
  'Applications': 'applications',
  'Offer Letters & Rollouts': 'offers',
  'Offer Letters & Approvals': 'offers',
  'Offers': 'offers',
  'Candidate Onboarding': 'onboarding',
  'Onboarding': 'onboarding',
  'Career Portal': 'career',
  'Careers': 'career',
  'Custom Screening Questions': 'customQuestions',
  'Custom Questions': 'customQuestions',
  'Recruitment Pipeline Funnel': 'recruitmentFunnel',
  'Recruitment Funnel & Conversion': 'recruitmentFunnel',
  'Recruitment Funnel': 'recruitmentFunnel',
  'Performance Management': 'performanceDashboard',
  'Performance': 'performanceDashboard',
  'Performance Indicators': 'indicators',
  'Indicators': 'indicators',
  'Key Performance Indicators (KPI Data)': 'kpiData',
  'KPI Data': 'kpiData',
  'Performance Appraisal': 'appraisal',
  'Appraisal': 'appraisal',
  'Appraisal Funnel': 'appraisalFunnel',
  'Goal Tracking': 'goalTracking',
  'Goals': 'goalTracking',
  'Goal Funnel': 'goalFunnel',
  'Training Management': 'trainingDashboard',
  'Training Setup': 'trainingDashboard',
  'Training': 'trainingDashboard',
  'Training Programs': 'trainingList',
  'Training Funnel': 'trainingFunnel',
  'Trainer Directory': 'trainers',
  'Trainers': 'trainers',
  'Org Chart': 'orgChart',
  'Organization Chart': 'orgChart',
  'Organization': 'orgChart',
  'Departments': 'departments',
  'Designations': 'designations',
  'Locations': 'locations',
  'Asset Setup & Inventory': 'assets',
  'Asset Setup': 'assets',
  'Assets': 'assets',
  'Document Management': 'documents',
  'Documents': 'documents',
  'Company Policy': 'companyPolicy',
  'Company Policies': 'companyPolicy',
  'Personal & Team Calendar': 'calendar',
  'Calendar': 'calendar',
  'HR Admin Setup & Governance': 'hrAdmin',
  'HR Admin': 'hrAdmin',

  // Fabric & Textile Masters (Slides 1 to 10)
  'Fabric Quality Master': 'fabricQuality',
  'Fabric Quality': 'fabricQuality',
  'Quality Master': 'fabricQuality',
  'Design Master': 'designMaster',
  'Design Master – List': 'designMaster',
  'Design Master - List': 'designMaster',
  'Colour / Shade Master': 'colourShadeMaster',
  'Colour / Shade Master – List': 'colourShadeMaster',
  'Colour / Shade Master - List': 'colourShadeMaster',
  'Color / Shade Master': 'colourShadeMaster',
  'Shade Master': 'colourShadeMaster',
  'Fabric Item / Variant Master': 'fabricVariant',
  'Fabric Item / Variant Master – List': 'fabricVariant',
  'Fabric Item / Variant Master - List': 'fabricVariant',
  'Fabric Variant Master': 'fabricVariant',
  'Fabric Variants': 'fabricVariant',
  'Fabric Type / Classification': 'fabricType',
  'Fabric Type / Classification – List': 'fabricType',
  'Fabric Type / Classification - List': 'fabricType',
  'Fabric Type Master': 'fabricType',
  'Units of Measurement (UOM)': 'uomMaster',
  'Units of Measurement (UOM) – List': 'uomMaster',
  'Units of Measurement (UOM) - List': 'uomMaster',
  'Units of Measurement': 'uomMaster',
  'UOM Master': 'uomMaster',
  'Fabric Categories': 'fabricCategories',
  'Fabric Categories – List': 'fabricCategories',
  'Fabric Categories - List': 'fabricCategories',
  'Categories Master': 'fabricCategories',
  'Categories': 'fabricCategories',
  'Textile Masters': 'textileMasters',
  'Textile Masters Hub': 'textileMasters',
  'Textile Master': 'textileMasters',

  // Quality Control (QC)
  'QC Inspection Register': 'qcRegister',
  'QC Register': 'qcRegister',
  'Pending Inspections': 'qcPending',
  'QC Pending Inspections': 'qcPending',
  'Reinspection / Reprocess': 'qcReinspection',
  'QC Reinspection': 'qcReinspection',
  'QC Results & Disposition': 'qcDisposition',
  'QC Disposition': 'qcDisposition',
  'QC Reports': 'qcReports',
  'QC Analytics & Defect Reports': 'qcReports',
  'QC Dashboard': 'qcDashboard',
  'Quality Control Dashboard': 'qcDashboard',

  // Job Work & Processing (PMS Processing)
  'Job Work Orders': 'jobWorkOrders',
  'Job Work Orders (JWO)': 'jobWorkOrders',
  'Job Work Inward': 'jobWorkInward',
  'Job Work Inward (Processed Intake)': 'jobWorkInward',
  'Job Work Outward': 'jobWorkOutward',
  'Job Work Outward (Grey Dispatch)': 'jobWorkOutward',
  'Job Work Order Detail': 'jobWorkOrders',
  'Process Plans': 'processPlanList',
  'Process Plan List': 'processPlanList',
  'Process Plan Detail': 'processPlanList',
  'Process Plans Directory': 'processPlanList',
  'Pending Job Work Register': 'pendingJobWork',
  'Pending Register': 'pendingJobWork',
  'Pending Job Work': 'pendingJobWork',
  'Processor Ledger': 'processorLedger',
  'Processor Ledger & Commercials': 'processorLedger',
  'Job Work Vendor Reconciliation': 'processorLedger',
  'Vendor Reconciliation': 'processorLedger',
  'Reprocess': 'reprocessPage',
  'Fabric Reprocess': 'reprocessPage',
  'Reprocess & Corrections': 'reprocessPage',
  'ITC-04 Report': 'itc04Report',
  'ITC-04 Statutory Report': 'itc04Report',
  'ITC-04': 'itc04Report',
  'Job Work / Processing': 'jobWorkOrders',

  // PMS & Production
  'PMS Dashboard': 'pmsDashboard',
  'PMS Execution Dashboard': 'pmsDashboard',
  'Projects': 'projectsList',
  'Projects Directory': 'projectsList',
  'All Projects': 'projectsList',
  'My Projects': 'projectsList',
  'Project Details': 'projectDetail',
  'Project Workspace': 'projectDetail',
  'My Tasks': 'myTasks',
  'My Actionable Tasks': 'myTasks',
  'Stage Configuration': 'stageConfig',
  'Stage Config': 'stageConfig',
  'Timeline': 'timelineGantt',
  'Timeline / Gantt': 'timelineGantt',
  'Milestone Timeline & Gantt': 'timelineGantt',
  'Delay Dashboard': 'delayDashboard',
  'PMS Delay Dashboard': 'delayDashboard',
  'PMS Reports': 'pmsDashboard',
  'Client Proof Approval': 'clientProofApproval',
  'Proof Approval': 'clientProofApproval',
  'Production Dashboard': 'productionDashboard',
  'Production Instructions': 'productionInstructions',
  'Daily Production': 'dailyProduction',
  'Daily Production Entry': 'dailyProduction',
  'Production Completion': 'productionCompletion',
  'Production Completion Verification': 'productionCompletion',

  // Inventory & Warehouse
  'Inventory Dashboard': 'inventoryDashboard',
  'Items Master': 'itemsMaster',
  'Costing & Items Master': 'itemsMaster',
  'Items': 'itemsMaster',
  'Item Catalog': 'itemsMaster',
  'Stock Position': 'stockPosition',
  'Sample Stock': 'stockPosition',
  'Warehouse Stock Position': 'stockPosition',
  'Stock Transfers': 'stockTransfers',
  'Inter-Warehouse Stock Transfers': 'stockTransfers',
  'Transfers': 'stockTransfers',
  'Godown / Rack - Locations Management': 'locationsPage',
  'Locations Management': 'locationsPage',
  'Warehouse Locations': 'locationsPage',
  'Lot / Taka Register': 'lotTakaRegister',
  'Taka Register': 'lotTakaRegister',
  'Logistics & Tempo Register': 'tripList',
  'Logistics & Trip Register': 'tripList',
  'Logistics': 'tripList',
  'Sampling Register & Expense': 'sampleList',
  'Sample Register & Expense': 'sampleList',
  'Sample Register': 'sampleList',
  'Quarantine & Defective Parts Management': 'faultyParts',
  'Faulty Parts': 'faultyParts',
  'Assembly Bay & Zone Requisitions': 'zoneRequests',
  'Zone Requests': 'zoneRequests',
  'Stock Valuation & Ageing': 'valuationAgeing',
  'Valuation & Ageing': 'valuationAgeing',
  'Month-End Audit': 'monthEndAudit',
  'Month-End Physical Stock Audit': 'monthEndAudit',
  'Service Usage': 'itemsMaster',

  // Sales & Revenue
  'Sales Dashboard': 'salesDashboard',
  'Sales Quotations': 'quotations',
  'Quotations': 'quotations',
  'Quotations & Estimates': 'quotations',
  'Sales Orders': 'salesOrders',
  'Delivery Challans': 'deliveryChallans',
  'Delivery Challan': 'deliveryChallans',
  'Proforma Invoices': 'proformaInvoices',
  'Sales Invoices': 'salesInvoices',
  'Tax Invoices': 'salesInvoices',
  'Invoices': 'salesInvoices',
  'Payment In': 'paymentIn',
  'Payment In & Customer Receipts': 'paymentIn',
  'Sales Returns': 'salesReturns',
  'Sales Returns & Credit Notes': 'salesReturns',
  'Warranty Directory': 'warrantyList',
  'Machine Warranties': 'warrantyList',
  'Broker Commission': 'brokerCommission',
  'Broker Commission Ledger': 'brokerCommission',

  // Purchase & Procurement
  'Purchase Orders': 'purchaseOrders',
  'Goods Receipt Notes (GRN)': 'goodsReceipt',
  'Goods Receipt': 'goodsReceipt',
  'Purchase Bills': 'purchaseBills',
  'Purchase Bills & Accounts Payable': 'purchaseBills',
  'Vendor Bills': 'purchaseBills',
  'Payment Out': 'paymentOut',
  'Payment Out & Vendor Disbursements': 'paymentOut',
  'Purchase Returns': 'purchaseReturns',
  'Purchase Returns & Debit Notes': 'purchaseReturns',
  'Operating Expenses': 'expensesPage',
  'Operating Expenses Management': 'expensesPage',
  'Expenses': 'expensesPage',
  'Bill Matching': 'billMatching',
  'Bill Matching (3-Way Match)': 'billMatching',
  'Supplier Ledger': 'supplierLedger',
  'Supplier Ledger & Statement': 'supplierLedger',
  'Supplier Reconciliation': 'supplierLedger',

  // CRM
  'CRM Dashboard': 'crmDashboard',
  'CRM Leads': 'crmLeads',
  'Leads': 'crmLeads',
  'Lost Leads': 'crmLeads',
  'Lead Details': 'leadDetails',
  'Create Lead': 'crmLeads',
  'CRM Tasks': 'crmTasks',
  'Master Tasks': 'crmTasks',
  'Lead Stage Tasks': 'crmTasks',
  'Task Allocation': 'crmTasks',
  'Deals': 'dealsPage',
  'Contracts': 'contractsPage',
  'CRM System Setup': 'crmDashboard',
  'Lead Forms': 'leadFormBuilder',
  'Lead Form Builder': 'leadFormBuilder',
  'Lead Create Form': 'leadFormBuilder',
  'Task Form Builder': 'leadFormBuilder',

  // Accounts & Treasury
  'Cash & Bank Accounts (Treasury)': 'cashBank',
  'Cash & Bank': 'cashBank',
  'General Ledger & Journal Entries': 'generalLedger',
  'General Ledger': 'generalLedger',
  'Day Book & Business Position': 'dayBook',
  'Day Book': 'dayBook',
  'Financial Reports': 'financialReports',
  'Financial Statements & Reports': 'financialReports',

  // Commercial Parties
  'Commercial Parties & Directory': 'partiesPage',
  'Parties': 'partiesPage',
  'Trade Parties': 'partiesPage',
  'Customer Accounts & Statements': 'customersPage',
  'Customers': 'customersPage',
  'Vendor Master & Supplier Directory': 'vendorsPage',
  'Vendors': 'vendorsPage',

  // Administration & Governance
  'Users': 'usersPage',
  'User Management': 'usersPage',
  'Roles': 'rolesPage',
  'Roles & Permissions': 'rolesPage',
  'System Preferences': 'settingsPage',
  'Settings': 'settingsPage',
  'Alert Center': 'alertCenter',
  'Approvals Inbox': 'approvalsInbox',
  'Reports': 'reportsHub',
  'Reports Hub': 'reportsHub',
  'Owner MIS Dashboard': 'ownerMIS',
  'Owner Executive MIS': 'ownerMIS',
};

/**
 * Universal resolver that guarantees a rich, accurate Guide object
 * for ANY page title across the entire system.
 */
export function resolveGuide({ guide, title }) {
  if (typeof guide === 'object' && guide !== null) {
    return guide;
  }

  const cleanTitle = (typeof title === 'string' ? title.trim() : '');

  // 1. Direct key match in guide prop (string)
  if (typeof guide === 'string' && appGuides[guide]) {
    return appGuides[guide];
  }

  // 2. Exact match in TITLE_MAP
  const mappedKey = TITLE_MAP[cleanTitle];
  if (mappedKey && appGuides[mappedKey]) {
    return appGuides[mappedKey];
  }

  // 3. Direct match in appGuides
  if (cleanTitle && appGuides[cleanTitle]) {
    return appGuides[cleanTitle];
  }

  // 4. Case-insensitive or normalized check
  const lowerTitle = cleanTitle.toLowerCase();
  for (const [key, item] of Object.entries(appGuides)) {
    if (
      key.toLowerCase() === lowerTitle ||
      (item.title && item.title.toLowerCase() === lowerTitle)
    ) {
      return item;
    }
  }

  // 5. Fuzzy / Substring match in TITLE_MAP
  for (const [mapTitle, targetKey] of Object.entries(TITLE_MAP)) {
    if (
      lowerTitle.includes(mapTitle.toLowerCase()) ||
      mapTitle.toLowerCase().includes(lowerTitle)
    ) {
      if (appGuides[targetKey]) return appGuides[targetKey];
    }
  }

  // 6. Dynamic intelligent fallback generator for any custom or dynamic title
  const displayTitle = cleanTitle || 'Evenmore ERP Workspace';
  return {
    title: displayTitle,
    subtitle: `Standard operating procedures, governance guidelines, and terminology for ${displayTitle}.`,
    purpose: `The ${displayTitle} interface provides dedicated tools for operational tracking, transaction processing, and data verification within the unified ERP ecosystem.`,
    workflow: [
      'Search & Filter Existing Records',
      'Initialize New Transaction / Entry',
      'Verify Mandatory Data Fields',
      'Submit & Synchronize Downstream Accounts',
    ],
    keyTerms: [
      { term: 'Standard Operating Procedure (SOP)', definition: `Governing operational rules and approval hierarchies for ${displayTitle}.` },
      { term: 'Audit Trail', definition: 'Timestamped record tracking creation, modifications, and user identity for compliance.' },
      { term: 'Status Lifecycle', definition: 'The operational state (Draft, In-Progress, Approved, or Completed) of records on this screen.' },
    ],
    tips: [
      'Use the search bar and filter controls to quickly isolate historical records.',
      'Check all required data fields before submitting to prevent ledger validation errors.',
    ],
  };
}

export default appGuides;
