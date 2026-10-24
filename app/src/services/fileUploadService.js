import api from './api';
import { isBackendEnabled } from './resourceSync';

/**
 * Uploads a file (File or Blob) to the backend using the 3-step file protocol:
 * 1. POST /files/upload-url/   -> { uploadUrl, fileId, expiresAt }
 * 2. PUT  <uploadUrl>          -> binary file payload
 * 3. POST /files/{fileId}/commit/ -> flips pending to committed
 *
 * @param {File|Blob} file
 * @param {string} fileName
 * @param {string} scope - default 'pms_document'
 * @returns {Promise<string>} fileId
 */
export async function uploadFileToBackend(file, fileName, scope = 'pms_document') {
  if (!isBackendEnabled()) return null;
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const resolvedName = fileName || file.name || 'document.pdf';
  const size = file.size || 1024;
  const contentType =
    file.type ||
    (resolvedName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');

  // Step 1: Request signed upload URL
  const uploadInit = await api.post('/files/upload-url/', {
    fileName: resolvedName,
    contentType,
    size,
    scope,
  });

  const payload = uploadInit?.data || uploadInit;
  const fileId = payload?.fileId || uploadInit?.fileId;
  const uploadUrl = payload?.uploadUrl || uploadInit?.uploadUrl;

  if (!fileId || !uploadUrl) {
    throw new Error('Server failed to initiate file upload (missing fileId or uploadUrl).');
  }

  // Determine target URL: if uploadUrl is pointing to backend absolute host, route through Vite proxy in dev
  let targetUrl = uploadUrl;
  try {
    const parsed = new URL(uploadUrl, window.location.origin);
    if (parsed.pathname.startsWith('/api/')) {
      targetUrl = `${parsed.pathname}${parsed.search}`;
    }
  } catch {}

  // Step 2: Upload file data via PUT
  const formData = new FormData();
  formData.append('file', file, resolvedName);

  const putRes = await fetch(targetUrl, {
    method: 'PUT',
    body: formData,
  });

  if (!putRes.ok) {
    const errorText = await putRes.text().catch(() => '');
    throw new Error(`Upload storage transfer failed (${putRes.status}): ${errorText || 'Unknown error'}`);
  }

  // Step 3: Commit the upload
  await api.post(`/files/${fileId}/commit/`, {});

  return fileId;
}

export default uploadFileToBackend;
