import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, PenTool, Upload, RotateCcw, Check, AlertCircle } from 'lucide-react';

export default function DigitalSignatureModal({
  isOpen,
  onClose,
  signatoryType = 'authorized',
  documentTitle = 'Job Work Order Voucher',
  defaultName = '',
  defaultDesignation = '',
  onSave,
  isSaving = false,
}) {
  const [activeTab, setActiveTab] = useState('digital_stamp'); // 'digital_stamp' | 'draw' | 'upload'
  const [signerName, setSignerName] = useState(defaultName);
  const [signerDesignation, setSignerDesignation] = useState(defaultDesignation);
  const [penColor, setPenColor] = useState('#1e3a8a'); // Navy Blue
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setSignerName(defaultName || (signatoryType === 'authorized' ? 'Authorized Officer' : 'Vendor Representative'));
      setSignerDesignation(
        defaultDesignation ||
          (signatoryType === 'authorized' ? 'Authorized Signatory — Operations' : 'Receiver / Vendor Representative')
      );
      setHasDrawn(false);
      setUploadedImage(null);
      setErrorMsg('');
      setActiveTab('digital_stamp');
    }
  }, [isOpen, defaultName, defaultDesignation, signatoryType]);

  // Setup canvas when tab changes to 'draw'
  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = penColor;
      }
    }
  }, [isOpen, activeTab, penColor]);

  if (!isOpen) return null;

  // Drawing event handlers
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Upload handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, SVG).');
      return;
    }
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    setErrorMsg('');
    if (!signerName.trim()) {
      setErrorMsg('Please enter the signer name.');
      return;
    }

    let signatureData = '';
    if (activeTab === 'draw') {
      if (!hasDrawn) {
        setErrorMsg('Please draw your signature on the pad before applying.');
        return;
      }
      signatureData = canvasRef.current.toDataURL('image/png');
    } else if (activeTab === 'upload') {
      if (!uploadedImage) {
        setErrorMsg('Please choose an image of your signature or stamp.');
        return;
      }
      signatureData = uploadedImage;
    }

    try {
      await onSave({
        type: activeTab,
        name: signerName.trim(),
        designation: signerDesignation.trim(),
        signatureData,
        signedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to apply signature.');
    }
  };

  const isAuth = signatoryType === 'authorized';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAuth ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              <PenTool size={16} />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isAuth ? 'Apply Authorized Signature' : "Record Vendor / Receiver's Signature"}
              </h3>
              <p className="text-[11px] text-slate-500">{documentTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Signer Identity Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Signer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                value={signerDesignation}
                onChange={(e) => setSignerDesignation(e.target.value)}
                placeholder={isAuth ? 'e.g. Authorized Signatory' : 'e.g. Vendor Representative'}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Select Signature Method
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('digital_stamp')}
                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'digital_stamp'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck size={13} className="text-emerald-600" /> Digital Stamp
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('draw')}
                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'draw'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool size={13} className="text-blue-600" /> Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'upload'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload size={13} className="text-indigo-600" /> Upload Image
              </button>
            </div>
          </div>

          {/* Tab 1: Digital E-Stamp Live Preview */}
          {activeTab === 'digital_stamp' && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                  <ShieldCheck size={14} className="text-emerald-600" /> OSCAR VERIFIED E-SIGNATURE
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                  256-BIT ENCRYPTED
                </span>
              </div>
              <div className="space-y-1 pt-1 text-slate-700">
                <div className="font-extrabold text-slate-900 text-sm">{signerName || '—'}</div>
                <div className="text-[11px] text-slate-600">{signerDesignation || '—'}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Timestamp: {new Date().toLocaleString()}
                </div>
              </div>
              <p className="text-[10px] text-emerald-700/80 italic pt-1">
                ✓ Stamped with authenticated user credentials, enterprise client seal, and immutable audit log.
              </p>
            </div>
          )}

          {/* Tab 2: HTML5 Canvas Pad */}
          {activeTab === 'draw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Draw your handwritten signature below:</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px]">Ink:</span>
                  <button
                    type="button"
                    onClick={() => setPenColor('#1e3a8a')}
                    className={`w-4 h-4 rounded-full bg-blue-900 ring-offset-1 ${penColor === '#1e3a8a' ? 'ring-2 ring-blue-500' : ''}`}
                    title="Blue Ink"
                  />
                  <button
                    type="button"
                    onClick={() => setPenColor('#0f172a')}
                    className={`w-4 h-4 rounded-full bg-slate-900 ring-offset-1 ${penColor === '#0f172a' ? 'ring-2 ring-slate-500' : ''}`}
                    title="Black Ink"
                  />
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="ml-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-600 hover:text-rose-700"
                  >
                    <RotateCcw size={11} /> Clear
                  </button>
                </div>
              </div>
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 relative">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[150px] cursor-crosshair touch-none bg-white"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                    ✍️ Sign here using mouse or finger...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Upload Image */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition">
                <Upload size={22} className="text-slate-400 mb-1" />
                <span className="font-bold text-slate-700 text-xs">Choose Signature / Seal Image</span>
                <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, or SVG (Transparent PNG recommended)</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {uploadedImage && (
                <div className="border border-slate-200 rounded-xl p-3 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={uploadedImage} alt="Uploaded signature" className="h-12 max-w-[140px] object-contain border rounded p-1 bg-slate-50" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Signature Image Loaded</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">✓ Ready to apply</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    className="text-rose-600 hover:text-rose-800 text-[11px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className={`px-4 py-1.5 rounded-lg font-bold text-xs text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
              isAuth ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              'Applying...'
            ) : (
              <>
                <Check size={13} /> Apply & Save Signature
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
