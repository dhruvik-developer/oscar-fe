import { useEffect } from 'react';
import { usePmsStore } from '../../../stores/pmsStore';
import { useProofShareStore } from '../../../stores/proofShareStore';

/**
 * Keeps this tab in step with a decision taken in another one.
 *
 * A generated approval link opens in its own tab, so the client's Approve or
 * Reject is written to localStorage by a different document. The `storage` event
 * fires only in the *other* tabs, which is exactly what is needed here: the
 * project manager's open Design Proofs view picks the decision up without a
 * reload. Only the persisted slices are replaced — in-flight UI state is left
 * alone.
 */

const PMS_KEY = 'pms_store_v1';
const SHARES_KEY = 'pms_proof_shares_v1';

const PMS_SLICES = [
  'projects',
  'stageConfigs',
  'departments',
  'statusColors',
  'employees',
  'settings',
  'currentUserId',
];

export function useProofApprovalSync() {
  useEffect(() => {
    function handleStorage(event) {
      if (!event.newValue) return;

      if (event.key === PMS_KEY) {
        try {
          const next = JSON.parse(event.newValue);
          const patch = {};
          for (const slice of PMS_SLICES) {
            if (next[slice] !== undefined) patch[slice] = next[slice];
          }
          if (Object.keys(patch).length > 0) usePmsStore.setState(patch);
        } catch {
          /* another tab wrote something unparseable — keep what we have */
        }
        return;
      }

      if (event.key === SHARES_KEY) {
        try {
          const next = JSON.parse(event.newValue);
          if (Array.isArray(next?.shares)) useProofShareStore.setState({ shares: next.shares });
        } catch {
          /* same */
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
}

export default useProofApprovalSync;
