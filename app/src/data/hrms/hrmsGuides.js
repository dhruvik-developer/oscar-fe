/**
 * Comprehensive Page Guides & Terminology for all HRMS Modules
 * Each guide contains title, subtitle, purpose, workflow, and keyTerms.
 */

export const hrmsGuides = {
  dashboard: {
    title: 'HRMS Dashboard',
    subtitle: 'High-level operational overview of workforce metrics, headcount, presence, and alerts.',
    purpose: 'The HRMS Dashboard provides HR leaders and department heads with real-time visibility into overall employee strength, daily attendance ratios, pending requests, and upcoming organizational events.',
    workflow: ['Review Workforce KPIs', 'Monitor Daily Attendance', 'Action Quick Approvals', 'Track Scheduled Events'],
    keyTerms: [
      { term: 'Present Today', definition: 'The percentage and head count of active employees checked in on-site or logged in remotely.' },
      { term: 'Quick Requests', definition: 'Direct self-service submission portal for rapid leave, shift regularizations, or asset requisitions.' },
      { term: 'Activity Feed', definition: 'Audit log capturing system-wide operational updates, approvals, and employee submissions in real-time.' },
      { term: 'Department Split', definition: 'Visual breakdown of employee headcount across operational engineering, product, marketing, and sales units.' },
    ],
    tips: [
      'Use the Date Range filter to inspect historical trends across quarters.',
      'Check the Upcoming Schedule widget to anticipate interviews and onboarding events.',
    ],
  },

  employees: {
    title: 'Employee Directory',
    subtitle: 'Comprehensive staff registry, profiles, designations, and departmental allocations.',
    purpose: 'The Employee Directory acts as the single source of truth for all employee records, contact information, employment status, departmental mapping, and joining dates.',
    workflow: ['Add / Import Employee', 'Assign Department & Designation', 'Set Reporting Line', 'Manage Lifecycle & Status'],
    keyTerms: [
      { term: 'Employee ID (EMP)', definition: 'Unique organizational identification code assigned sequentially to every staff member.' },
      { term: 'Status Lifecycle', definition: 'Employee current state: Active, On Leave, Probation, or Inactive.' },
      { term: 'Department Allocation', definition: 'Primary operational division responsible for the employee\'s performance and cost-center accounting.' },
      { term: 'Designation / Level', definition: 'Role title and corporate tier specifying responsibilities and compensation hierarchy.' },
    ],
    tips: [
      'Filter by Department or Status to rapidly isolate specific teams.',
      'Click Export to download an updated CSV staff list for reporting.',
    ],
  },

  attendanceOverview: {
    title: 'Attendance Management',
    subtitle: 'Daily attendance monitoring, check-in/out timestamps, hours worked, and shifts.',
    purpose: 'The Attendance Management overview tracks real-time employee check-ins, calculates daily work hours, detects late arrivals, and flags absences for payroll accuracy.',
    workflow: ['Clock In / Out Recorded', 'Shift Window Evaluation', 'Exception & LOP Flagging', 'Manager Regularization', 'Payroll Integration'],
    keyTerms: [
      { term: 'Present / Late / Absent', definition: 'Attendance status determined by comparison between first check-in timestamp and scheduled shift start.' },
      { term: 'Work Hours', definition: 'Effective productive time recorded between morning check-in and evening checkout.' },
      { term: 'Shift Assignment', definition: 'Designated working hours schedule (General 9-6, Flexible, or Night shift).' },
      { term: 'Regularization', definition: 'Correction workflow allowing employees to adjust missed or erroneous punch records with manager approval.' },
    ],
    tips: [
      'Use the Date selector to audit attendance records for any prior working day.',
      'Quick Status cycle allows HR to manually correct anomalous records on the fly.',
    ],
  },

  attendanceMark: {
    title: 'Mark Attendance',
    subtitle: 'Daily manual and batch attendance recording register for supervisors and administrators.',
    purpose: 'Mark Attendance allows HR admins and shift supervisors to record, verify, and lock attendance for on-site personnel who do not punch in through biometric or mobile apps.',
    workflow: ['Select Target Date', 'Filter by Department', 'Mark Status & Timestamps', 'Save & Commit Records'],
    keyTerms: [
      { term: 'Daily Attendance Register', definition: 'Master log capturing attendance status (Present, Late, Absent, Half Day) on a selected date.' },
      { term: 'Select All / Toggle', definition: 'Convenience control to bulk-mark entire departments as Present with standard 09:00 - 18:00 timings.' },
      { term: 'Supervisor Remarks', definition: 'Annotated notes documenting client site visits, field duty, or authorized half-day dispensations.' },
    ],
    tips: [
      'Review Department filter before hitting Save Attendance to ensure all rosters are covered.',
    ],
  },

  attendanceIndividual: {
    title: 'Individual Attendance',
    subtitle: 'In-depth historical timesheets, monthly attendance logs, and hour calculations for a specific employee.',
    purpose: 'Individual Attendance provides an employee-specific drilldown view displaying day-by-day attendance status, check-in/out stamps, overtime, and monthly present percentages.',
    workflow: ['Select Employee', 'Choose Month & Year', 'Review Timesheet Logs', 'Audit Irregularities'],
    keyTerms: [
      { term: 'Monthly Timesheet', definition: 'A calendar breakdown showing all working days, holidays, and recorded check-in times for an individual.' },
      { term: 'Present Ratio', definition: 'Percentage of total working days attended versus scheduled monthly working days.' },
      { term: 'Overtime / Deficit', definition: 'Hours logged beyond or below the standard daily threshold (typically 8.0 hours).' },
    ],
    tips: [
      'Select any employee from the dropdown to immediately inspect their 30-day compliance.',
    ],
  },

  attendanceBulk: {
    title: 'Bulk Attendance',
    subtitle: 'Mass attendance management and multi-employee shift logging.',
    purpose: 'Bulk Attendance streamlines large-scale attendance entry, allowing operations managers to review and update multiple employees simultaneously across facilities.',
    workflow: ['Filter Facility / Dept', 'Apply Batch Preset', 'Verify Exceptions', 'Commit Bulk Entry'],
    keyTerms: [
      { term: 'Batch Presets', definition: 'One-click actions applying Present, Absent, or Half Day across all currently selected rows.' },
      { term: 'Exceptions Verification', definition: 'Selective review to adjust individuals on approved leave before saving bulk entries.' },
    ],
    tips: [
      'Filter by Department before applying batch presets to avoid overwriting remote teams.',
    ],
  },

  attendanceRequests: {
    title: 'Attendance Requests',
    subtitle: 'Review, approve, or reject employee regularization, shift change, and work-from-home requests.',
    purpose: 'Attendance Requests provides a centralized approval inbox where managers and HR review employee requests for attendance adjustments, missed punches, and shift swaps.',
    workflow: ['Employee Request Submitted', 'Manager Reviews Justification', 'Approve / Reject Action', 'Automated Record Sync'],
    keyTerms: [
      { term: 'Regularization Request', definition: 'Formal appeal submitted by an employee to adjust missed or erroneous check-in/check-out stamps.' },
      { term: 'Audit Trail', definition: 'Detailed log recording when the request was raised, reason provided, and who authorized it.' },
      { term: 'Auto-Adjustment', definition: 'Upon approval, the system immediately recalculates effective working hours and updates payroll registers.' },
    ],
    tips: [
      'Use the Status filter to see Pending requests awaiting immediate review.',
    ],
  },

  attendanceFlexibility: {
    title: 'Attendance Flexibility Rules',
    subtitle: 'Organizational grace periods, work shifts, approval gates, and overtime thresholds.',
    purpose: 'Flexibility Rules govern how the HRMS calculates tardiness, allowable grace periods, core working hours, and automated overtime credit thresholds.',
    workflow: ['Define Grace Window', 'Set Shift Core Hours', 'Configure Overtime Rates', 'Apply System-Wide'],
    keyTerms: [
      { term: 'Grace Period', definition: 'Allowable buffer (e.g. 15 minutes) after shift start during which check-in is not marked Late.' },
      { term: 'Core Working Hours', definition: 'Mandatory synchronous working hours during which all team members must be available online or in-office.' },
      { term: 'Half-Day Cutoff', definition: 'Minimum required daily hours below which a shift is automatically categorized as Half Day.' },
    ],
    tips: [
      'Ensure changes are saved and communicated to department leads prior to month-end payroll lock.',
    ],
  },

  leave: {
    title: 'Leave Management',
    subtitle: 'Apply, approve, monitor leave quotas, encashment, and comp-off credits.',
    purpose: 'Leave Management enables staff to submit time-off requests, tracks individual leave balances (Annual, Sick, Casual, Comp-Off), and enforces organizational approval workflows.',
    workflow: ['Leave Application', 'Manager / Delegate Review', 'Approval & Balance Deduction', 'Calendar & Attendance Sync'],
    keyTerms: [
      { term: 'Leave Quota / Balance', definition: 'The remaining number of paid days an employee is entitled to take across each leave category.' },
      { term: 'Sandwich Rule', definition: 'Policy where weekends or holidays between consecutive leave days are counted as deducted leave days.' },
      { term: 'Comp-Off Credit', definition: 'Compensatory day-off credited to an employee for working on designated weekends or gazetted holidays.' },
      { term: 'Leave Encashment', definition: 'Financial conversion of unused annual leave balance into monthly salary disbursement.' },
    ],
    tips: [
      'Use the Balance Cards to view carry-forward quotas and remaining days per category.',
      'Check the coverage delegate before approving extended leave applications.',
    ],
  },

  payroll: {
    title: 'Payroll Management',
    subtitle: 'Salary structures, monthly disbursement processing, attendance LOP deductions, and payslip generation.',
    purpose: 'Payroll Management processes monthly employee compensation, automatically factoring in attendance deductions (Loss of Pay), advances recovered, allowances, and statutory deductions.',
    workflow: ['Verify Working Days & Hours', 'Attendance LOP Calculation', 'Advances & Deductions', 'Director Approval', 'Disbursement & Payslip PDF'],
    keyTerms: [
      { term: 'Standard Agreed CTC', definition: 'Gross contracted monthly cost-to-company before attendance penalties and statutory deductions.' },
      { term: 'Attendance LOP', definition: 'Loss of Pay deduction calculated strictly for days absent or remaining unfulfilled working hours.' },
      { term: 'Net Payable Formula', definition: 'Standard CTC - Attendance LOP + Additional Earnings - Deductions - Salary Advance Recovered.' },
      { term: 'Disbursement Lifecycle', definition: 'Multi-gate approval flow: Draft → In Progress → Ready for Review → Approved → Paid.' },
    ],
    tips: [
      'Click Download Slips to generate compliant PDF salary slips for all staff in one click.',
      'Audit Department Schedules to ensure standard working hours align with monthly targets.',
    ],
  },

  recruitmentDashboard: {
    title: 'Recruitment Operations',
    subtitle: 'End-to-end talent acquisition, candidate pipeline, and hiring lifecycle.',
    purpose: 'The Recruitment module orchestrates job requisition, applicant tracking, interview rounds, offer letter generation, and onboarding handoff into the employee directory.',
    workflow: ['Job Requisition', 'Candidate Ingestion', 'Screening & Interviews', 'Shortlist & Evaluation', 'Offer Letter Issued', 'Onboarding'],
    keyTerms: [
      { term: 'Candidate Pipeline', definition: 'Visual progression tracking candidates across stages from Applied to Hired.' },
      { term: 'Interview Rounds', definition: 'Technical, HR, and managerial evaluations scheduled with real-time video links.' },
      { term: 'Offer Generation', definition: 'Live interactive offer letter authoring, CTC compensation formulation, and PDF issuance.' },
      { term: 'Onboarding Handoff', definition: 'Seamless transition converting hired candidates into active employee directory records.' },
    ],
    tips: [
      'Monitor pipeline stages to prevent candidate drop-offs during intermediate screening rounds.',
    ],
  },

  jobs: {
    title: 'Job Requisitions & Openings',
    subtitle: 'Define staffing requisitions, specifications, target headcount, and published status.',
    purpose: 'Job Openings serve as the central requisition records that candidates apply to, recruiters source for, and interview panels evaluate against.',
    workflow: ['Draft Specification', 'Define Headcount & Budget', 'Publish Requisition', 'Collect Applications', 'Fill & Close Position'],
    keyTerms: [
      { term: 'Requisition Code', definition: 'Unique organizational identifier for auditing and department allocations.' },
      { term: 'Openings Count', definition: 'Total number of approved headcount vacancies for the position.' },
      { term: 'Hiring Manager', definition: 'The departmental leader accountable for final hiring decisions.' },
      { term: 'Work Mode', definition: 'Designation of On-site, Hybrid, or fully Remote operational requirements.' },
    ],
    tips: [
      'Click any job title to inspect applicants, active pipeline distribution, and requisition timeline.',
    ],
  },

  jobDetails: {
    title: 'Job Requisition Details',
    subtitle: 'In-depth overview of target role specifications, timeline, and associated applicant roster.',
    purpose: 'Job Details provides a 360-degree overview of a specific opening, including applicant funnel breakdown, job requirements, and progression milestones.',
    workflow: ['Review Requirements', 'Assess Candidate Pool', 'Advance Applicants Through Pipeline', 'Track Headcount Fill Rate'],
    keyTerms: [
      { term: 'Applicant Funnel', definition: 'Real-time count of candidates in Screening, Interview, Shortlisted, and Offer stages for this role.' },
      { term: 'Requisition Timeline', definition: 'Chronological tracking of role creation, publishing, first interview, and final hire dates.' },
    ],
    tips: [
      'Click on any applicant to jump directly into their evaluation dossier.',
    ],
  },

  candidates: {
    title: 'Candidate Directory & Pipeline',
    subtitle: 'Sourcing, screening, stage management, and offer letter generation.',
    purpose: 'The Candidates directory stores all applicants, tracks their real-time hiring stage, records technical/HR scores, and connects to offer generation.',
    workflow: ['Candidate Ingestion', 'Initial Screening', 'Interview Evaluation', 'Shortlist Selection', 'Offer Letter Issuance', 'Hired & Onboarding'],
    keyTerms: [
      { term: 'Hiring Stage', definition: 'Current status within the recruitment pipeline (Applied, Screening, Interview, Shortlisted, Offer, Hired, Rejected).' },
      { term: 'Interview Status', definition: 'Indicates whether technical or HR interviews are Not Scheduled, Scheduled, Pending, or Completed.' },
      { term: 'Offer Generation', definition: 'Seamlessly launches the official offer letter authoring modal for immediate PDF export.' },
    ],
    tips: [
      'Toggle between List view and Kanban Pipeline view for different operational perspectives.',
    ],
  },

  candidateDetails: {
    title: 'Candidate Profile & Dossier',
    subtitle: 'Comprehensive applicant dossier, resume review, interview scorecards, and offer rollout.',
    purpose: 'Candidate Details provides the full evaluation dossier for an individual applicant, including contact details, past feedback, interview records, and offer generation.',
    workflow: ['Review Resume', 'Schedule Interview', 'Submit Scorecard', 'Issue Offer Letter'],
    keyTerms: [
      { term: 'Evaluation Scorecard', definition: 'Quantitative assessment of candidate technical capability, communication, and culture fit.' },
      { term: 'Interview History', definition: 'Complete timeline of past interview rounds with dates, interviewers, and recommendation notes.' },
    ],
    tips: [
      'Generate an Offer Letter directly from this view once a candidate reaches the Shortlisted stage.',
    ],
  },

  interviews: {
    title: 'Interview Schedules',
    subtitle: 'Manage panel discussions, technical assessments, and interview round statuses.',
    purpose: 'Interviews enables recruitment coordinators to schedule panel sessions, manage room/video links, track interviewer feedback, and record final scores.',
    workflow: ['Select Candidate & Job', 'Assign Interview Panel', 'Set Video / Room Link', 'Conduct Session', 'Submit Scorecard'],
    keyTerms: [
      { term: 'Interview Type', definition: 'Category of assessment (Technical, HR, Managerial, or Final Round).' },
      { term: 'Meeting Link', definition: 'Direct video conference URL (Google Meet, Zoom, Teams) shared with candidate and panel.' },
      { term: 'Scoring Tier', definition: 'Numeric or qualitative rating scale measuring candidate aptitude and role readiness.' },
    ],
    tips: [
      'Switch to Calendar View to visualize all upcoming panels across the month.',
    ],
  },

  interviewDetails: {
    title: 'Interview Assessment Details',
    subtitle: 'Session particulars, meeting connections, interviewer feedback, and scorecard evaluation.',
    purpose: 'Interview Details houses all specifics for a scheduled assessment, including candidate info, panel notes, duration, and direct video conferencing links.',
    workflow: ['Verify Schedule & Link', 'Join Conference', 'Record Candidate Answers', 'Submit Recommendation'],
    keyTerms: [
      { term: 'Evaluation Feedback', definition: 'Written commentary documenting strengths, growth areas, and hiring recommendation.' },
      { term: 'Pass / Fail Verdict', definition: 'Decision determining whether the candidate advances to subsequent rounds or is closed.' },
    ],
    tips: [
      'Use the Join Meeting button for instant 1-click access to the scheduled call.',
    ],
  },

  applications: {
    title: 'Job Applications',
    subtitle: 'Track incoming resumes, application stages, and candidate sourcing channels.',
    purpose: 'Applications provides a consolidated intake view for all job applications submitted across job portals, career sites, and employee referrals.',
    workflow: ['Application Ingested', 'Resume Screening', 'Stage Assignment', 'Direct Interview Hand-off'],
    keyTerms: [
      { term: 'Sourcing Channel', definition: 'Origin of applicant (Direct Website, LinkedIn, Referral, Job Board).' },
      { term: 'Quick Progression', definition: 'Dropdown selector allowing instant stage changes directly from the data table.' },
    ],
    tips: [
      'Filter by Stage to quickly identify incoming unreviewed resumes in the Applied stage.',
    ],
  },

  offers: {
    title: 'Offer Letters & Rollouts',
    subtitle: 'Generate, send, and monitor candidate compensation packages and acceptance.',
    purpose: 'Offers allows HR leaders to draft personalized employment offer letters, configure compensation breakdowns, set joining dates, and generate signed PDF documents.',
    workflow: ['Draft Offer Terms', 'Specify CTC & Reporting Line', 'Generate Official PDF', 'Send to Candidate', 'Track Acceptance'],
    keyTerms: [
      { term: 'Offered Compensation (CTC)', definition: 'Agreed annual or monthly compensation figure detailed in the contractual offer.' },
      { term: 'Offer Validity & Joining', definition: 'Deadline for candidate signature and agreed reporting start date.' },
      { term: 'Status Tracking', definition: 'Progression states: Pending Acceptance, Accepted, Rejected, or Expired.' },
    ],
    tips: [
      'Click Create Offer to open the interactive live offer letter builder and preview the final PDF layout.',
    ],
  },

  onboarding: {
    title: 'Employee Onboarding',
    subtitle: 'Track document verification, IT provisioning, and employee directory induction.',
    purpose: 'Onboarding manages the post-offer journey for hired candidates, ensuring background checks, document verification, hardware allocation, and seamless induction.',
    workflow: ['Offer Accepted', 'Document Verification', 'IT & Asset Provisioning', 'Directory Induction Completed'],
    keyTerms: [
      { term: 'Onboarding Checklist', definition: 'Structured set of onboarding milestones (ID Proof, Bank Info, Laptop Allocation, Email Setup).' },
      { term: 'Induction Handoff', definition: 'Converting an onboarded applicant into an active employee record in the directory.' },
    ],
    tips: [
      'Mark checklist items as completed to maintain full audit compliance for new hires.',
    ],
  },

  career: {
    title: 'Career Portal',
    subtitle: 'Public-facing career page preview for discovering open positions and submitting applications.',
    purpose: 'The Career Portal provides an external-facing preview of company culture, value propositions, and live job vacancies where potential candidates can apply directly.',
    workflow: ['Browse Vacancies', 'Filter by Department / Location', 'View Job Specifications', 'Submit Application'],
    keyTerms: [
      { term: 'Live Openings', definition: 'Job requisitions currently published as active and accepting applicant resumes.' },
      { term: 'Application Form', definition: 'Direct candidate submission portal collecting resume, portfolio, and contact details.' },
    ],
    tips: [
      'Ensure all newly created jobs are marked as Published to appear on the public career site.',
    ],
  },

  customQuestions: {
    title: 'Custom Screening Questions',
    subtitle: 'Design pre-screening questions, compliance checks, and assessment inputs for job applicants.',
    purpose: 'Custom Questions empowers recruitment teams to attach custom prompts, behavioral questions, or eligibility filters to specific job application flows.',
    workflow: ['Create Question', 'Choose Input Type', 'Assign to Job Roles', 'Review Candidate Answers'],
    keyTerms: [
      { term: 'Question Type', definition: 'Format of response: Short Answer, Multiple Choice, Yes/No, or Document Upload.' },
      { term: 'Knockout Criteria', definition: 'Critical questions that automatically disqualify candidates who do not meet prerequisite requirements.' },
    ],
    tips: [
      'Use short, clear questions to minimize candidate drop-off during the application submission.',
    ],
  },

  recruitmentFunnel: {
    title: 'Recruitment Pipeline Funnel',
    subtitle: 'Conversion velocity, bottleneck detection, and stage-by-stage hiring analytics.',
    purpose: 'Recruitment Funnel visualizes candidate conversion rates across sourcing, screening, interviews, and final hire, highlighting process bottlenecks.',
    workflow: ['Sourcing Volume', 'Screening Pass Rate', 'Interview-to-Offer Ratio', 'Offer Acceptance Velocity'],
    keyTerms: [
      { term: 'Conversion Rate', definition: 'Percentage of applicants that advance from one hiring stage to the next.' },
      { term: 'Bottleneck Stage', definition: 'The stage where candidates spend the longest duration awaiting feedback or decision.' },
    ],
    tips: [
      'Examine the interview-to-offer ratio to calibrate interview panel evaluation standards.',
    ],
  },

  performanceDashboard: {
    title: 'Performance Management',
    subtitle: 'Overview of review cycles, appraisal workflows, indicators, and department ratings.',
    purpose: 'Performance Management coordinates company-wide review cycles, provides 360 multi-rater feedback, tracks appraisal completion, and calibrates final staff ratings.',
    workflow: ['Launch Review Cycle', 'Employee Self-Review', 'Manager Evaluation', 'HR Calibration', 'Rating Synced to Profile'],
    keyTerms: [
      { term: 'Appraisal Cycle', definition: 'Designated evaluation window (e.g. Q4 2026 Review Cycle) with fixed start and due dates.' },
      { term: '5-Tier Rating Scale', definition: 'Standardized performance scale (1-Unsatisfactory to 5-Exceptional).' },
      { term: 'Role Perspectives', definition: 'Simulate the portal as an Employee (self-assessment), Manager (evaluator), or HR (governor).' },
    ],
    tips: [
      'Use the Role Switcher at the top to test workflows from both Manager and Employee perspectives.',
    ],
  },

  indicators: {
    title: 'Performance Indicators',
    subtitle: 'Technical and organizational indicators with benchmarks, measurement types, and weightages.',
    purpose: 'Performance Indicators establish objective competencies and benchmarks used by evaluators to assess role-specific deliverables and organizational culture.',
    workflow: ['Define Indicator', 'Assign Department & Level', 'Set Target & Weightage', 'Evaluate in Appraisals'],
    keyTerms: [
      { term: 'Measurement Type', definition: 'Metric format: Percentage (%), Numerical Target, or Qualitative Scale.' },
      { term: 'Indicator Weightage', definition: 'Relative contribution (out of 100%) of this specific indicator to the overall score.' },
    ],
    tips: [
      'Ensure total weightages for a given role sum to 100% for accurate appraisal scoring.',
    ],
  },

  kpiData: {
    title: 'Key Performance Indicators (KPI Data)',
    subtitle: 'Define organizational KPIs with targets, measurement scales, and department/role assignments.',
    purpose: 'KPI Data manages key performance metric definitions, threshold goals, and departmental alignments to drive quantitative performance evaluations.',
    workflow: ['Set KPI Objective', 'Define Target Value', 'Assign Responsible Role', 'Track Fulfillment'],
    keyTerms: [
      { term: 'Target Threshold', definition: 'Specific quantitative goal to be met within the evaluation cycle.' },
      { term: 'Assigned Scope', definition: 'Application scope (Department-wide, team-level, or individual role).' },
    ],
    tips: [
      'Align KPIs with company-wide strategic goals for maximum operational impact.',
    ],
  },

  appraisal: {
    title: 'Performance Appraisal',
    subtitle: 'Execute self-reviews, manager evaluations, 5-tier scoring, and profile rating sync.',
    purpose: 'Performance Appraisal handles the execution of employee review forms, manager evaluations, scoring rubrics, and the official commitment of final ratings.',
    workflow: ['Employee Fills Self-Review', 'Manager Evaluates & Scores', 'HR Review & Calibrates', 'Finalize & Sync'],
    keyTerms: [
      { term: 'Weighted Overall Score', definition: 'Calculated score summing indicator scores multiplied by their designated weightages.' },
      { term: 'Rating Tier', definition: 'Tier categorization: Unsatisfactory, Needs Improvement, Meets Expectations, Exceeds, Exceptional.' },
      { term: 'Rating Sync', definition: 'Commits finalized appraisal score directly into the employee\'s master directory record.' },
    ],
    tips: [
      'Click the Rating Scale button for quick reference to standard grading criteria.',
    ],
  },

  appraisalFunnel: {
    title: 'Appraisal Funnel',
    subtitle: 'Live workflow progression from initiation to finalized rating sync.',
    purpose: 'Appraisal Funnel tracks organizational progress across appraisal stages, identifying lagging managers or departments with pending reviews.',
    workflow: ['Initiation', 'Self Review', 'Manager Review', 'HR Calibration', 'Finalization & Sync'],
    keyTerms: [
      { term: 'Bottleneck Stage', definition: 'Stage with the highest count of overdue review submissions.' },
      { term: 'Completion Ratio', definition: 'Percentage of total organization appraisals that have reached final closure.' },
    ],
    tips: [
      'Check the Workflow Insights card for recommended reminder actions.',
    ],
  },

  goalTracking: {
    title: 'Goal Tracking',
    subtitle: 'Track and manage individual employee goals, progress bars, and completion deadlines.',
    purpose: 'Goal Tracking provides continuous goal monitoring, allowing employees and supervisors to update milestone percentages and status throughout the year.',
    workflow: ['Define SMART Goal', 'Set Target Metric & Date', 'Update Progress (%)', 'Mark Completed'],
    keyTerms: [
      { term: 'Progress Percentage', definition: 'Interactive completion metric indicating real-time task progression.' },
      { term: 'At Risk Status', definition: 'Warning state triggered when goal milestone deadlines are overdue.' },
    ],
    tips: [
      'Use the progress slider in edit modal to update goal completion percentages.',
    ],
  },

  goalFunnel: {
    title: 'Goal Funnel',
    subtitle: 'Goal completion progression and at-risk visibility funnel.',
    purpose: 'Goal Funnel highlights organizational achievement velocity and flags overdue or stalled objectives across departments.',
    workflow: ['Created', 'Assigned', 'In Progress', 'At Risk', 'Completed'],
    keyTerms: [
      { term: 'At-Risk Callout', definition: 'Critical list of high-priority objectives currently behind schedule.' },
      { term: 'Quarterly Conversion', definition: 'Proportion of goals initiated at quarter start that reached completion.' },
    ],
    tips: [
      'Review at-risk items during weekly 1-on-1 meetings to unblock team members.',
    ],
  },

  trainingDashboard: {
    title: 'Training Management',
    subtitle: 'Unified training setup: programs overview, course catalog, funnel progression, and trainer directory.',
    purpose: 'Training Management coordinates employee learning and development, tracks professional certifications, assigns internal/external instructors, and monitors course completion.',
    workflow: ['Identify Skill Gap', 'Create Program & Assign Trainer', 'Enroll Participants', 'Conduct Sessions', 'Issue Certificates'],
    keyTerms: [
      { term: 'Training Program', definition: 'Structured curriculum designed to elevate employee competencies in leadership, tech, or compliance.' },
      { term: 'Enrollment Headcount', definition: 'Total staff members registered to attend the program.' },
      { term: 'Completion Rate', definition: 'Percentage of enrolled employees who attended all mandatory modules and passed evaluations.' },
    ],
    tips: [
      'Switch between Overview, Training Programs, Funnel, and Trainer Directory tabs to manage all training operations.',
    ],
  },

  trainingList: {
    title: 'Training Programs',
    subtitle: 'Catalog of scheduled courses, syllabus details, costs, and participant enrollment.',
    purpose: 'Training Programs provides a full searchable directory of training initiatives, schedules, budget costs, and assigned instructors.',
    workflow: ['Create Program', 'Specify Budget & Dates', 'Assign Participants', 'Manage Status'],
    keyTerms: [
      { term: 'Program Category', definition: 'Specialization area (Leadership, Technical, Security, Soft Skills).' },
      { term: 'Session Cost', definition: 'Direct expenditure budgeted for external instructors, materials, or platform licenses.' },
    ],
    tips: [
      'Click Add Training to schedule new workshops for upcoming quarters.',
    ],
  },

  trainingFunnel: {
    title: 'Training Funnel',
    subtitle: 'Kanban board and stage progression tracking training programs from request to certification.',
    purpose: 'Training Funnel provides interactive Kanban visual tracking of all active courses moving through Requested, Scheduled, Ongoing, and Evaluated stages.',
    workflow: ['Requested', 'Trainer Assigned', 'Scheduled', 'Ongoing', 'Completed', 'Evaluated'],
    keyTerms: [
      { term: 'Kanban Stages', definition: 'Visual columns representing the operational state of each learning program.' },
      { term: 'Drag & Drop Progression', definition: 'Quickly advance programs between stages as prerequisites are fulfilled.' },
    ],
    tips: [
      'Toggle between Kanban and List views using the switcher in the upper right.',
    ],
  },

  trainers: {
    title: 'Trainer Directory',
    subtitle: 'Roster of certified internal mentors and external corporate instructors.',
    purpose: 'Trainer Directory stores profiles, specializations, contact details, and program assignments for all training instructors.',
    workflow: ['Add Instructor', 'Specify Specialization', 'Assign to Programs', 'Track Feedback'],
    keyTerms: [
      { term: 'Trainer Specialization', definition: 'Core domain expertise (Leadership, Cloud Architecture, UX, Compliance).' },
      { term: 'Assigned Programs', definition: 'Count of active training courses led by this instructor.' },
    ],
    tips: [
      'Check trainer status before assigning them to overlapping training dates.',
    ],
  },

  orgChart: {
    title: 'Organization Chart',
    subtitle: 'Hierarchical reporting lines, leadership structure, and departmental team trees.',
    purpose: 'The Org Chart provides an interactive graphical visualization of corporate hierarchy, showing leadership nodes, direct reports, and cross-department structures.',
    workflow: ['Review Leadership Tree', 'Expand / Collapse Branches', 'Search Specific Employees', 'Export Tree Diagram'],
    keyTerms: [
      { term: 'Reporting Line', definition: 'Direct managerial relationship connecting an employee to their supervisor.' },
      { term: 'Span of Control', definition: 'The number of direct reports reporting to an individual manager or executive.' },
      { term: 'Executive Node', definition: 'Top-level leadership roles (CEO, CTO, CFO, Head of People).' },
    ],
    tips: [
      'Use the Search bar to jump straight to any team member and highlight their reporting chain.',
      'Click Print / Save as PDF to export high-resolution org chart documents.',
    ],
  },

  departments: {
    title: 'Departments',
    subtitle: 'Manage organizational structure, operational units, department heads, and allocated budgets.',
    purpose: 'Departments organizes the enterprise into functional operational units (Engineering, Design, HR, Finance) and establishes departmental leadership accountability.',
    workflow: ['Create Department', 'Designate Department Head', 'Allocate Budget', 'Assign Staff'],
    keyTerms: [
      { term: 'Department Head', definition: 'Senior executive responsible for departmental operations, approvals, and performance.' },
      { term: 'Allocated Budget', definition: 'Approved annual operating expenditure assigned to the functional unit.' },
    ],
    tips: [
      'Switch between Table and Grid view for different structural representations.',
    ],
  },

  designations: {
    title: 'Designations',
    subtitle: 'Define corporate job roles, leveling framework, and departmental allocations.',
    purpose: 'Designations establishes standardized job titles and career levels (L1 through L7) across the enterprise to ensure equitable leveling and compensation grading.',
    workflow: ['Define Designation Title', 'Assign Hierarchy Level', 'Map to Department', 'Assign to Roles'],
    keyTerms: [
      { term: 'Job Level (L1 - L7)', definition: 'Standardized grading tier representing seniority, experience, and authority.' },
      { term: 'Headcount Allocation', definition: 'Number of active employees currently occupying this designation.' },
    ],
    tips: [
      'Click Add Designation to introduce new career ladders as teams scale.',
    ],
  },

  locations: {
    title: 'Locations',
    subtitle: 'Global corporate offices, regional hubs, timezones, and distributed workforce centers.',
    purpose: 'Locations tracks all physical corporate offices, co-working spaces, and remote geographical clusters with their respective timezones and headcount.',
    workflow: ['Add Office Location', 'Set Address & Timezone', 'Assign Type (HQ, Branch, Remote)', 'Map Employees'],
    keyTerms: [
      { term: 'Location Type', definition: 'Classification: Global Headquarters, Regional Branch Office, or Distributed Remote.' },
      { term: 'Timezone Offset', definition: 'Standard operational timezone (e.g. EST, GMT, GST, IST) governing shift definitions.' },
    ],
    tips: [
      'Ensure timezone offsets are accurate for proper cross-office calendar coordination.',
    ],
  },

  assets: {
    title: 'Asset Setup & Inventory',
    subtitle: 'Lifecycle management, hardware provisioning, allocations, repairs & return audits.',
    purpose: 'Asset Setup manages corporate physical and digital property (Laptops, Monitors, Mobile Devices, Furniture), tracking custody, maintenance cycles, and employee requisitions.',
    workflow: ['Add Asset to Inventory', 'Employee Requisition', 'Approval & Fulfillment', 'Routine Audit', 'Return & Decommission'],
    keyTerms: [
      { term: 'Asset Tag / Serial', definition: 'Unique organizational code and manufacturer serial number identifying physical hardware.' },
      { term: 'Custody Status', definition: 'Current state: Available in Stock, Assigned to Employee, Under Maintenance, or Lost/Damaged.' },
      { term: 'Fulfillment Handshake', definition: 'Official handover process recording employee sign-off on allocated hardware.' },
    ],
    tips: [
      'Filter by Status to quickly audit available devices ready for new hire onboarding.',
    ],
  },

  documents: {
    title: 'Document Management',
    subtitle: 'Manage company compliance policies, employee personnel dossiers, and personal records in PDF format.',
    purpose: 'Document Management provides an encrypted corporate document repository for employment contracts, government IDs, certificates, and compliance policies with validity monitoring.',
    workflow: ['Upload PDF from Device', 'Assign Scope (Staff / Individual)', 'Verify Authenticity', 'Monitor Expiry Dates'],
    keyTerms: [
      { term: 'PDF Vault', definition: 'Secure electronic storage for official signed records and personnel credentials.' },
      { term: 'Verification Status', definition: 'Audit state: Valid, Expiring Soon, Expired, or Pending HR Verification.' },
      { term: 'Scope Tagging', definition: 'Access permissions determining whether a document is company-wide or employee-private.' },
    ],
    tips: [
      'Drag and drop PDF files directly into the upload dropzone for instant upload.',
    ],
  },

  companyPolicy: {
    title: 'Company Policy',
    subtitle: 'Enterprise compliance repository, version lifecycle, staff acknowledgements, and regulatory governance.',
    purpose: 'Company Policy publishes official corporate rules, ethical standards, security policies, and benefits guidelines, tracking mandatory employee sign-offs.',
    workflow: ['Draft Policy Version', 'Internal Review & Approval', 'Publish to Staff', 'Track Acknowledgements', 'Archive Revisions'],
    keyTerms: [
      { term: 'Version Lifecycle', definition: 'Policy evolution states: Draft → Pending Approval → Active → Archived.' },
      { term: 'Staff Acknowledgement', definition: 'Legally binding digital confirmation from an employee verifying they have read and agreed to adhere to the policy.' },
      { term: 'Employee View Mode', definition: 'Clean reading interface for staff members to review policies and sign acknowledgements.' },
    ],
    tips: [
      'Toggle Employee View to inspect how policy documents appear to staff members.',
    ],
  },

  calendar: {
    title: 'Personal & Team Calendar',
    subtitle: 'Track leaves, company public holidays, scheduled training sessions, and key milestones.',
    purpose: 'The Calendar consolidates all organizational schedules, public holidays, scheduled trainings, and employee leaves into synchronized Month, Week, and Agenda views.',
    workflow: ['View Scheduled Events', 'Filter by Department / Event Type', 'Schedule New Event', 'Export to iCal (.ics)'],
    keyTerms: [
      { term: 'Public Holidays', definition: 'Official company-wide non-working days gazetted by management.' },
      { term: 'Leave Sync', definition: 'Approved employee leaves automatically appear as Out of Office entries on the calendar.' },
      { term: 'iCal Export', definition: 'Download standard .ics calendar files compatible with Google Calendar, Outlook, and Apple Calendar.' },
    ],
    tips: [
      'Switch between Month, Week, and Schedule List views using the top switcher.',
    ],
  },

  hrAdmin: {
    title: 'HR Admin Setup & Governance',
    subtitle: 'Configure organization settings, approval chains, offer letters, exits, grievances, and holiday calendars.',
    purpose: 'HR Admin serves as the governance nerve center, establishing multi-tier approval chains, exit clearance workflows, termination letters, and official holiday schedules.',
    workflow: ['Configure Department Working Days', 'Establish Approval Chains', 'Manage Exits & Resignations', 'Publish Holiday Calendar'],
    keyTerms: [
      { term: 'Approval Chains', definition: 'Configurable multi-tier sign-off workflows (Tier 1 Manager, Tier 2 Head, Tier 3 Director).' },
      { term: 'Exit Clearance & Severance', definition: 'Protocols for managing voluntary resignations and involuntary terminations with legal compliance.' },
      { term: 'Working Days Schedule', definition: 'Baseline days per month and daily hours per department feeding into payroll calculations.' },
    ],
    tips: [
      'Review Department Working Days at the start of each fiscal year to calibrate payroll baselines.',
    ],
  },
};

export default hrmsGuides;
