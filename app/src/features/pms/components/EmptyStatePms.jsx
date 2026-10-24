import React from 'react';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  FolderOpen,
  ListChecks,
  FileText,
  AlertTriangle,
  History,
  Layers,
} from 'lucide-react';

/**
 * EmptyStatePms — PMS-calibrated zero-data prompts.
 *
 * Thin wrapper over the shared components/ui/EmptyState so every PMS surface
 * says something useful when it has no rows, instead of the generic
 * "No records found". Pass a `variant` for the presets, or override any of
 * icon / title / description directly.
 */

const VARIANTS = {
  projects: {
    icon: FolderOpen,
    title: 'No projects yet',
    description:
      'Projects appear here once a confirmed CRM order is converted into a PMS project.',
  },
  myProjects: {
    icon: FolderOpen,
    title: 'Nothing assigned to you',
    description: 'Projects where you are the assigned project manager will show up here.',
  },
  tasks: {
    icon: ListChecks,
    title: 'No open tasks',
    description: 'Tasks assigned to you across active stages will appear here.',
  },
  stages: {
    icon: Layers,
    title: 'No stages configured',
    description:
      'Add stage templates to define the workflow every project runs through.',
  },
  documents: {
    icon: FileText,
    title: 'No design proofs uploaded',
    description: 'Uploaded proof PDFs and their revision history will be listed here.',
  },
  delays: {
    icon: AlertTriangle,
    title: 'Nothing running late',
    description: 'Overdue and at-risk stages will surface here as soon as one slips.',
  },
  activity: {
    icon: History,
    title: 'No activity recorded',
    description: 'Stage assignments, approvals and delays are logged here as they happen.',
  },
};

export function EmptyStatePms({ variant = 'projects', icon, title, description, action, className = '' }) {
  const preset = VARIANTS[variant] ?? VARIANTS.projects;

  return (
    <EmptyState
      icon={icon ?? preset.icon}
      title={title ?? preset.title}
      description={description ?? preset.description}
      action={action}
      className={className}
    />
  );
}

export default EmptyStatePms;
