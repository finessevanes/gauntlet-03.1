/**
 * Custom hook to prevent rendering when permission modal is open
 * Centralizes the permission modal gate logic used by recording modals
 */

import { usePermissionModal } from '../context/PermissionContext';

/**
 * Hook that returns whether a component should render
 * Returns false (don't render) if permission modal is open
 */
export function usePermissionGate(isOpen: boolean): boolean {
  const permissionModal = usePermissionModal();

  // Don't render if modal is not open OR permission modal is open (permission takes precedence)
  return isOpen && !permissionModal.isOpen;
}
