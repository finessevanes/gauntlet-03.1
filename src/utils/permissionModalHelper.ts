/**
 * Helper utility for opening permission modals with standard callbacks
 * Reduces code duplication across recording modal components
 */

import { PermissionType } from '../context/PermissionContext';

export interface OpenPermissionModalOptions {
  permissionModal: any; // usePermissionModal context
  type: PermissionType;
  errorMessage: string;
  onRetry: () => void;
  onCancel: () => void;
}

/**
 * Opens permission modal with standard retry and cancel callbacks
 * Used by recording modals to request permissions with consistent behavior
 */
export function openPermissionModalWithCallbacks({
  permissionModal,
  type,
  errorMessage,
  onRetry,
  onCancel,
}: OpenPermissionModalOptions): void {
  permissionModal.openPermissionModal(
    type,
    errorMessage,
    onRetry,    // Retry: try permission check again
    onCancel    // Cancel: close the recording modal
  );
}
