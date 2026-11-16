import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GlobalModal } from '../components/ui/GlobalModal';

export const GlobalModalContext = createContext(null);

let modalDispatcher = null;

export function GlobalModalProvider({ children }) {
  const [modalQueue, setModalQueue] = useState([]);

  const currentModal = modalQueue[0] || null;

  const closeModal = useCallback((result = false) => {
    setModalQueue((prev) => {
      if (prev.length === 0) return prev;
      const [closing, ...rest] = prev;
      if (closing?.resolve) {
        closing.resolve(result);
      }
      return rest;
    });
  }, []);

  const dispatchModal = useCallback((config) => {
    return new Promise((resolve) => {
      const modalEntry = {
        id: `modal-${Date.now()}-${Math.random()}`,
        ...config,
        resolve,
      };
      setModalQueue((prev) => [...prev, modalEntry]);
    });
  }, []);

  dispatchModal.close = () => closeModal(false);

  useEffect(() => {
    modalDispatcher = dispatchModal;
    return () => {
      modalDispatcher = null;
    };
  }, [dispatchModal]);

  const handleConfirm = useCallback(async (val) => {
    if (!currentModal) return;
    if (currentModal.onConfirm) {
      try {
        await currentModal.onConfirm(val);
      } catch (err) {
        console.error('Error during modal onConfirm:', err);
        return;
      }
    }
    // For prompts, resolve with value; for confirms, resolve with true
    closeModal(currentModal.isPrompt ? (val ?? '') : true);
  }, [currentModal, closeModal]);

  const handleClose = useCallback(() => {
    if (!currentModal) return;
    if (currentModal.onClose) {
      try {
        currentModal.onClose();
      } catch (err) {
        console.error('Error during modal onClose:', err);
      }
    }
    // Cancelled: prompt resolves with null, confirm with false
    closeModal(currentModal.isPrompt ? null : false);
  }, [currentModal, closeModal]);

  return (
    <GlobalModalContext.Provider value={modal}>
      {children}
      {currentModal && (
        <GlobalModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={currentModal.title}
          message={currentModal.message}
          confirmText={currentModal.confirmText}
          cancelText={currentModal.cancelText}
          variant={currentModal.variant}
          icon={currentModal.icon}
          itemName={currentModal.itemName}
          loading={currentModal.loading}
          dismissible={currentModal.dismissible}
          isPrompt={currentModal.isPrompt}
          promptLabel={currentModal.promptLabel}
          promptPlaceholder={currentModal.promptPlaceholder}
          promptDefaultValue={currentModal.promptDefaultValue}
          promptRequired={currentModal.promptRequired}
          promptValidate={currentModal.promptValidate}
        >
          {currentModal.children}
        </GlobalModal>
      )}
    </GlobalModalContext.Provider>
  );
}

/**
 * Universal Modal Service
 * Usable both via `useModal()` hook and direct `modal` import!
 */
export const modal = {
  confirm(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    if (modalDispatcher) {
      return modalDispatcher({
        title: normalized.title || 'Confirmation',
        message: normalized.message || normalized.description,
        confirmText: normalized.confirmText || 'Confirm',
        cancelText: normalized.cancelText || 'Cancel',
        variant: normalized.variant || 'primary',
        ...normalized,
      });
    }
    return Promise.resolve(window.confirm(normalized.message || normalized.title));
  },

  deleteConfirm(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    return this.confirm({
      title: normalized.title || 'Delete Confirmation',
      message: normalized.message || 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: normalized.confirmText || 'Delete',
      cancelText: normalized.cancelText || 'Cancel',
      variant: 'danger',
      ...normalized,
    });
  },

  warning(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    return this.confirm({
      title: normalized.title || 'Warning',
      message: normalized.message || normalized.description,
      confirmText: normalized.confirmText || 'Proceed',
      cancelText: normalized.cancelText || 'Cancel',
      variant: 'warning',
      ...normalized,
    });
  },

  alert(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    if (modalDispatcher) {
      return modalDispatcher({
        title: normalized.title || 'Notice',
        message: normalized.message || normalized.description || '',
        confirmText: normalized.confirmText || 'OK',
        variant: normalized.variant || 'info',
        ...normalized,
      });
    }
    window.alert(normalized.message || normalized.title || '');
    return Promise.resolve();
  },

  success(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    return this.alert({
      title: normalized.title || 'Success',
      message: normalized.message || normalized.description,
      variant: 'success',
      confirmText: normalized.confirmText || 'OK',
      ...normalized,
    });
  },

  error(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    return this.alert({
      title: normalized.title || 'Error',
      message: normalized.message || normalized.details || normalized.description || 'An unexpected error occurred.',
      variant: 'error',
      confirmText: normalized.confirmText || 'Close',
      ...normalized,
    });
  },

  info(opts) {
    const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
    return this.alert({
      title: normalized.title || 'Information',
      message: normalized.message || normalized.description,
      variant: 'info',
      confirmText: normalized.confirmText || 'OK',
      ...normalized,
    });
  },

  prompt(opts) {
    const normalized = typeof opts === 'string' ? { title: opts, label: opts } : (opts || {});
    if (modalDispatcher) {
      return modalDispatcher({
        title: normalized.title || 'Input Required',
        message: normalized.message,
        isPrompt: true,
        promptLabel: normalized.label || normalized.promptLabel,
        promptPlaceholder: normalized.placeholder || normalized.promptPlaceholder || '',
        promptDefaultValue: normalized.defaultValue || normalized.promptDefaultValue || '',
        promptRequired: normalized.required ?? normalized.promptRequired ?? false,
        promptValidate: normalized.validate || normalized.promptValidate,
        confirmText: normalized.confirmText || 'Submit',
        cancelText: normalized.cancelText || 'Cancel',
        ...normalized,
      });
    }
    return Promise.resolve(window.prompt(normalized.title, normalized.defaultValue || ''));
  },

  open(opts) {
    if (modalDispatcher) return modalDispatcher(opts || {});
    return Promise.resolve();
  },

  close() {
    if (modalDispatcher?.close) {
      modalDispatcher.close();
    }
  },
};

export function useModal() {
  const context = useContext(GlobalModalContext);
  return context || modal;
}

export default modal;
