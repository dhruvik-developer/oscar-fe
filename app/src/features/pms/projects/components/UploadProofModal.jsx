import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Upload, Layers, FileText, Image, X, FileUp, Check, Tag } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { usePmsStore, getLatestDocument } from '../../../../stores/pmsStore';
import { uploadFileToBackend } from '../../../../services/fileUploadService';
import { isBackendEnabled } from '../../../../services/resourceSync';
import { uploadProjectDocument } from '../../../../services/jobWorkSync';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

/**
 * UploadProofModal — register the next version of a design proof or project document.
 *
 * Supports selecting or drag-and-dropping PDF documents and photos/drawings
 * directly from the user's PC or system. Reads the file as a Data URL to enable
 * immediate client-side preview, zooming, and downloading.
 * Supports document types (Design Proof, Fabric Photo, Shade Sample, QC Report, etc.).
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function suggestName(project, stage, nextVersion) {
  const base = (project?.customerName ?? 'Proof').split(' ')[0];
  const part = (stage?.name ?? 'Design').replace(/[^A-Za-z]+/g, '');
  return `${base}_${part}_v${nextVersion}.0.pdf`;
}

const DOCUMENT_TYPES = [
  'Design Proof',
  'Fabric Photograph',
  'Shade Sample',
  'QC Inspection Report',
  'Processing Specification',
  'Delivery Challan',
  'LR Transport Copy',
  'Inward Receipt',
  'Vendor Bill',
  'Sales / Tax Invoice',
  'Purchase PO',
  'GRN',
  'Other Project Document',
];

export function UploadProofModal({ isOpen, onClose, project, stage, onUploaded }) {
  const employees = usePmsStore((s) => s.employees);
  const addDocument = usePmsStore((s) => s.addDocument);
  const showToast = usePmsStore((s) => s.showToast);

  const latest = getLatestDocument(stage);
  const nextVersion = (latest?.version ?? 0) + 1;

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState('');
  const [fileSizeFormatted, setFileSizeFormatted] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const [docType, setDocType] = useState('Design Proof');
  const [docKey, setDocKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploaderId, setUploaderId] = useState('');
  const [comments, setComments] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFile(null);
    setFileData(null);
    setFilePreview(null);
    setFileType('');
    setFileSizeFormatted('');
    setIsDragOver(false);
    setIsSubmitting(false);
    setDocType('Design Proof');
    setDocKey(latest?.docKey || suggestName(project, stage, nextVersion).replace(/\.pdf$/i, ''));
    setFileName(suggestName(project, stage, nextVersion));
    setUploaderId(stage?.assignedUser?.id ?? '');
    setComments('');
    setErrors({});
  }, [isOpen, project, stage, nextVersion, latest?.docKey]);

  function processFile(file) {
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);

    if (!isPdf && !isImage) {
      setErrors((prev) => ({
        ...prev,
        file: 'Please upload a PDF document (.pdf) or photo/image (.png, .jpg, .jpeg, .webp).',
      }));
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setDocKey(file.name.replace(/\.[^/.]+$/, ''));
    setFileType(file.type || (isPdf ? 'application/pdf' : 'image/png'));
    setFileSizeFormatted(formatBytes(file.size));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.file;
      delete next.fileName;
      delete next.submit;
      return next;
    });

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setFileData(result);
      if (isImage) {
        setFilePreview(result);
      } else {
        setFilePreview(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleRemoveFile(e) {
    e.stopPropagation();
    setSelectedFile(null);
    setFileData(null);
    setFilePreview(null);
    setFileType('');
    setFileSizeFormatted('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFileName(suggestName(project, stage, nextVersion));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const found = {};
    if (!fileName.trim()) found.fileName = 'A file name is required.';
    if (!selectedFile) found.file = 'Choose a document file to upload.';
    if (!uploaderId) found.uploaderId = 'Record who uploaded this version.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSubmitting(true);

    try {
      const uploader = employees.find((emp) => emp.id === uploaderId);
      const resolvedType = fileType || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');
      const resolvedSize = fileSizeFormatted || '';

      let fileId = null;
      if (isBackendEnabled() && selectedFile) {
        try {
          fileId = await uploadFileToBackend(selectedFile, fileName.trim(), 'pms_document');
        } catch (uploadErr) {
          console.warn('[UploadProofModal] uploadFileToBackend fallback:', uploadErr);
        }
      }

      // 1. Direct Django backend persistence
      const isProofType = docType === 'Design Proof' || docType === 'Fabric Photograph' || docType === 'Shade Sample';
      try {
        await uploadProjectDocument(project.id, {
          stage_id: stage.id,
          file_name: fileName.trim(),
          file_size: selectedFile?.size || 0,
          file_data: fileData || null,
          file_id: fileId,
          doc_type: docType,
          doc_key: docKey.trim() || fileName.replace(/\.[^/.]+$/, ''),
          comments: comments.trim(),
          is_proof: isProofType,
        });
      } catch (beErr) {
        console.warn('[UploadProofModal] Backend upload notification:', beErr);
      }

      // 2. Client store state sync
      addDocument(
        project.id,
        stage.id,
        {
          fileId,
          fileName: fileName.trim(),
          fileSize: resolvedSize,
          fileType: resolvedType,
          fileData: fileData || null,
          previewUrl: fileData || null,
          uploadedBy: { id: uploader?.id || 'admin', name: uploader?.name || 'Admin' },
          comments: comments.trim(),
          doc_type: docType,
          is_proof: isProofType,
        },
        project.projectManager
      );

      showToast(`v${nextVersion}.0 (${docType}) uploaded.`);
      onUploaded?.();
      onClose?.();
    } catch (err) {
      console.error('[PMS Upload Proof] error:', err);
      setErrors((prev) => ({ ...prev, submit: err?.message || 'Failed to upload document.' }));
      showToast(`Upload failed — ${err?.message || err}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!project || !stage) return null;

  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Upload Version ${nextVersion}.0`}
      subtitle={`${stage.name} — ${project.code || project.id}`}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="pms-upload-proof" icon={Upload} disabled={isSubmitting}>
            {isSubmitting ? 'Uploading…' : 'Upload Version'}
          </Button>
        </>
      }
    >
      <form id="pms-upload-proof" onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errors.submit && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle size={14} className="shrink-0 text-rose-500" />
            <span>{errors.submit}</span>
          </div>
        )}
        {latest && (
          <div className="flex items-start gap-2 rounded-lg border border-[#dce5f4] bg-[#f6f9ff] px-3 py-2">
            <Layers size={12} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600">
              Current latest is <strong>v{latest.version}.0</strong> ({latest.approvalStatus}). This
              upload becomes <strong>v{nextVersion}.0</strong> — earlier versions stay untouched.
              {latest.revisionReason && (
                <>
                  <br />
                  <span className="text-orange-700">To address: {latest.revisionReason}</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Hidden input for local file selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,image/*"
          onChange={handleFileChange}
          className="hidden"
          id="proof-file-picker"
        />

        {/* Drag-and-drop or Browse dropzone */}
        <div>
          <label className={labelClass}>
            Select or Drop Document File <span className="text-rose-500">*</span>
          </label>

          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70'
              }`}
            >
              <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <FileUp size={20} />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                Click to browse or drag and drop document
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                PDF documents (.pdf) or design/fabric photos (.png, .jpg, .webp) up to 25 MB
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3 min-w-0">
                {isImage && filePreview ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-11 h-11 object-cover rounded-lg border border-slate-200 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-red-100 text-red-600 flex flex-col items-center justify-center shrink-0">
                    <FileText size={18} />
                    <span className="text-[8px] uppercase tracking-wider mt-0.5">PDF</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-500">{fileSizeFormatted}</span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                      {isImage ? 'Photo / Image' : 'PDF Document'}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium ml-1">
                      <Check size={11} /> Ready
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline px-2 py-1"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Remove file"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {errors.file && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.file}
            </p>
          )}
        </div>

        {/* Document Type Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="doc-type-select">
              Document Type <span className="text-rose-500">*</span>
            </label>
            <select
              id="doc-type-select"
              className={fieldClass}
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="doc-key-input">
              Document Group Key (For Versioning)
            </label>
            <input
              id="doc-key-input"
              type="text"
              className={fieldClass}
              value={docKey}
              onChange={(e) => setDocKey(e.target.value)}
              placeholder="e.g. Navy_Fabric_Proof"
              title="Documents with matching group key form a version series v1, v2..."
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="proof-file">
            Display File Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="proof-file"
            type="text"
            className={fieldClass}
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
          {errors.fileName && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.fileName}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelClass + ' mb-0'} htmlFor="proof-by">
              Uploaded by <span className="text-rose-500">*</span>
            </label>
            <MasterSourceLink source="users" />
          </div>
          <select
            id="proof-by"
            className={fieldClass}
            value={uploaderId}
            onChange={(e) => setUploaderId(e.target.value)}
          >
            <option value="">Select the uploader…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>
            ))}
          </select>
          {errors.uploaderId && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.uploaderId}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="proof-notes">Document Notes & Specifications</label>
          <textarea
            id="proof-notes"
            rows={2}
            className={fieldClass}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. Shade scan matching Pantone 19-4052 TCX, lab dip pass, etc."
          />
        </div>
      </form>
    </Modal>
  );
}

export default UploadProofModal;
