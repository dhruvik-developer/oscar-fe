import { useEffect, useState } from 'react';
import api from '../services/api';
import { useDocumentStore } from '../stores/documentStore';

/**
 * Object URL for an HRMS document's stored file, for an <iframe>/<img>
 * preview. Fetched as a Blob so the viewer stays same-origin; revoked when
 * the document changes or the viewer closes.
 */
export function useDocumentFileUrl(doc) {
  const [state, setState] = useState({ url: null, loading: false, error: '' });

  useEffect(() => {
    if (!doc?.hasFile && !doc?.fileId) {
      setState({ url: null, loading: false, error: '' });
      return undefined;
    }
    let url = null;
    let alive = true;
    setState({ url: null, loading: true, error: '' });
    useDocumentStore.getState().fetchDocumentFile(doc)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ url, loading: false, error: '' });
      })
      .catch((err) => alive && setState({ url: null, loading: false, error: err?.message || 'Could not open the file.' }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc?.id, doc?.fileId, doc?.hasFile]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

/** Save the stored file under its original name. Rejects with a readable message. */
export async function downloadDocumentFile(doc) {
  try {
    const blob = await useDocumentStore.getState().fetchDocumentFile(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (doc.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = doc.fileName || (safeTitle + '.pdf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (err) {
    try {
      const res = await api.get('/hrms/documents/' + doc.id + '/download/');
      const dlUrl = res?.downloadUrl || res?.data?.downloadUrl;
      if (dlUrl) {
        const link = document.createElement('a');
        link.href = dlUrl;
        link.download = doc.fileName || 'document.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    } catch {}
    throw err;
  }
}
