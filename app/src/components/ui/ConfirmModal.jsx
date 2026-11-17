import React from 'react';
import { GlobalModal } from './GlobalModal';

/**
 * ConfirmModal — Standardized confirmation dialog wrapper.
 * Integrates directly with the unified GlobalModal system.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText,
  cancelText = 'Cancel',
  variant = 'danger',
  icon,
  loading = false,
  itemName = null,
  children,
  dismissible = true,
}) {
  return (
    <GlobalModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={cancelText}
      variant={variant}
      icon={icon}
      loading={loading}
      itemName={itemName}
      dismissible={dismissible}
    >
      {children}
    </GlobalModal>
  );
}

export default ConfirmModal;
