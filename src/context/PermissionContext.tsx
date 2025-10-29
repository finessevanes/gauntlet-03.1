/**
 * Permission Modal Context
 * Global state management for showing/hiding permission modals
 * Used by Screen Recording, Webcam Recording, and PiP Recording features
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export type PermissionType = 'screen' | 'camera' | 'microphone';

interface PermissionModalState {
  isOpen: boolean;
  permissionType: PermissionType | null;
  errorMessage: string;
  onRetry: (() => void) | null;
  onCancel: (() => void) | null;
}

const INITIAL_PERMISSION_STATE: PermissionModalState = {
  isOpen: false,
  permissionType: null,
  errorMessage: '',
  onRetry: null,
  onCancel: null,
};

interface PermissionContextType {
  isOpen: boolean;
  permissionType: PermissionType | null;
  errorMessage: string;
  openPermissionModal: (
    type: PermissionType,
    errorMessage: string,
    onRetry?: () => void,
    onCancel?: () => void
  ) => void;
  closePermissionModal: () => void;
  handleRetry: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionModalState>(INITIAL_PERMISSION_STATE);

  const openPermissionModal = useCallback(
    (type: PermissionType, errorMessage: string, onRetry?: () => void, onCancel?: () => void) => {
      console.log('[PermissionContext] Opening modal for:', type);
      setState({
        isOpen: true,
        permissionType: type,
        errorMessage,
        onRetry: onRetry || null,
        onCancel: onCancel || null,
      });
    },
    []
  );

  const closePermissionModal = useCallback(() => {
    console.log('[PermissionContext] Closing modal (user cancelled)');
    // Store the callback before clearing state
    const onCancelCallback = state.onCancel;

    setState(INITIAL_PERMISSION_STATE);

    // Call onCancel callback AFTER state update using setTimeout to avoid render cycle
    if (onCancelCallback) {
      console.log('[PermissionContext] Will call onCancel callback');
      setTimeout(() => {
        console.log('[PermissionContext] Calling onCancel callback');
        onCancelCallback();
      }, 0);
    }
  }, [state.onCancel]);

  const handleRetry = useCallback(() => {
    console.log('[PermissionContext] Retrying...');
    if (state.onRetry) {
      state.onRetry();
    }
    closePermissionModal();
  }, [state.onRetry, closePermissionModal]);

  return (
    <PermissionContext.Provider
      value={{
        isOpen: state.isOpen,
        permissionType: state.permissionType,
        errorMessage: state.errorMessage,
        openPermissionModal,
        closePermissionModal,
        handleRetry,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionModal() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionModal must be used within PermissionProvider');
  }
  return context;
}
