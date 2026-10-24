import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import LotTakaRegisterPage from '../../../inventory/LotTakaRegisterPage';

export function Stage4LotTakaWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
}) {
  const projectId = project?.id;
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectPurchaseOrders(projectId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setPurchaseOrders(list);
      })
      .catch((err) => console.error('Failed to load project POs for lot taka:', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const fetchReceipts = async () => {
      try {
        const res = await api.get('/purchase/receipts/', {
          params: { projectId, limit: 10 },
        });
        const list = Array.isArray(res?.data?.results)
          ? res.data.results
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];
        setReceipts(list);
      } catch (err) {
        console.warn('Failed to load GRNs for lot taka:', err);
      }
    };
    fetchReceipts();
  }, [projectId]);

  const activePo = purchaseOrders[0] || null;
  const activeGrn = receipts[0] || null;

  return (
    <div className="space-y-4">
      {/* Embedded Live OSCAR Lot / Taka Register with PO & GRN Context */}
      <LotTakaRegisterPage
        key={activePo?.id || 'lot-reg-loading'}
        initialPo={activePo}
        initialGrn={activeGrn}
        poId={activePo?.id}
        grnId={activeGrn?.id}
        isEmbedded={true}
        onSelectStage={onSelectStage}
      />
    </div>
  );
}

export default Stage4LotTakaWorkspace;
