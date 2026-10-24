import { useState, useEffect, useCallback } from 'react';
import { approvalService } from '../services/domainServices';

// Who may give how much discount (PDF §12). The server enforces it; the UI
// reads the same policy to show, per line, whose approval a discount needs.
const DEFAULTS = {
  autoAllowPct: 1,
  salespersonMaxPct: 2,
  managerMaxPct: 5,
  minMarginPct: 5,
  managerRoleCode: 'SALES_MGR',
  ownerRoleCode: 'OWNER',
  myLevel: 'salesperson',
  myMaxDiscountPct: 2,
};

const RANK = { none: 0, salesperson: 1, manager: 2, owner: 3 };

function parsePolicy(res) {
  const n = (v, d) => {
    const x = parseFloat(v);
    return Number.isFinite(x) ? x : d;
  };
  return {
    autoAllowPct: n(res?.autoAllowPct, DEFAULTS.autoAllowPct),
    salespersonMaxPct: n(res?.salespersonMaxPct ?? res?.max_discount_pct, DEFAULTS.salespersonMaxPct),
    managerMaxPct: n(res?.managerMaxPct, DEFAULTS.managerMaxPct),
    minMarginPct: n(res?.minMarginPct, DEFAULTS.minMarginPct),
    managerRoleCode: res?.managerRoleCode || res?.approver_role_code || DEFAULTS.managerRoleCode,
    ownerRoleCode: res?.ownerRoleCode || DEFAULTS.ownerRoleCode,
    myLevel: res?.myLevel || DEFAULTS.myLevel,
    myMaxDiscountPct: n(res?.myMaxDiscountPct, DEFAULTS.myMaxDiscountPct),
    partyOverrides: Array.isArray(res?.partyOverrides) ? res.partyOverrides : [],
  };
}

/** The approver a discount % needs: 'none' | 'salesperson' | 'manager' | 'owner'. */
export function requiredLevel(pct, policy, { belowCost = false, belowMargin = false } = {}) {
  if (belowCost || belowMargin) return 'owner';
  const p = Number(pct) || 0;
  if (p <= policy.autoAllowPct) return 'none';
  if (p <= policy.salespersonMaxPct) return 'salesperson';
  if (p <= policy.managerMaxPct) return 'manager';
  return 'owner';
}

/** True when `level` is above what the current user may approve themselves. */
export function needsApprovalFor(level, policy) {
  return RANK[level] >= RANK.manager && RANK[level] > RANK[policy.myLevel || 'salesperson'];
}

export const APPROVER_LABEL = { manager: 'Sales Manager', owner: 'Owner' };

export function useDiscountPolicy() {
  const [policy, setPolicy] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    approvalService.getDiscountPolicy()
      .then((res) => { if (active) setPolicy(parsePolicy(res)); })
      .catch((err) => { if (active) setError(err?.message || 'Could not load the discount policy.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Accepts the full policy object, or the older (pct, role) pair.
  const savePolicy = useCallback(async (pctOrPolicy, role) => {
    const body = typeof pctOrPolicy === 'object' && pctOrPolicy !== null
      ? pctOrPolicy
      : { salespersonMaxPct: parseFloat(pctOrPolicy), ...(role ? { managerRoleCode: role } : {}) };
    const res = await approvalService.updateDiscountPolicy(body);
    const next = parsePolicy(res);
    setPolicy(next);
    return next;
  }, []);

  return {
    ...policy,
    policy,
    // Older callers: the salesperson threshold and the manager approver.
    maxDiscountPct: policy.salespersonMaxPct,
    approverRole: policy.managerRoleCode,
    loading,
    error,
    savePolicy,
  };
}
