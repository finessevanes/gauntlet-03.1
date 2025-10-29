/**
 * RecordingMenu Component
 * Dropdown menu for recording options (Screen, Webcam, PiP)
 */

import React, { useRef, useEffect, useState } from 'react';

interface RecordingMenuProps {
  disabled: boolean;
  onScreenClick: () => void;
  onWebcamClick: () => void;
  onPiPClick: () => void;
}

interface MenuItem {
  label: string;
  icon: string;
  onClick: () => void;
}

export const RecordingMenu: React.FC<RecordingMenuProps> = ({
  disabled,
  onScreenClick,
  onWebcamClick,
  onPiPClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_ITEMS: MenuItem[] = [
    { label: 'Screen', icon: '🖥️', onClick: onScreenClick },
    { label: 'Webcam', icon: '📷', onClick: onWebcamClick },
    { label: 'Picture-in-Picture', icon: '📹', onClick: onPiPClick },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMenuClick = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLElement).style.backgroundColor = '#333';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLElement).style.backgroundColor = 'transparent';
  };

  return (
    <div style={styles.container} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          ...styles.button,
          ...(isOpen ? styles.buttonOpen : {}),
          ...(disabled ? styles.buttonDisabled : {}),
        }}
        title="Recording options"
      >
        <span style={{ fontSize: '16px', marginRight: '6px' }}>🎥</span>
        Record
        <span style={{ marginLeft: '6px', fontSize: '12px' }}>▼</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleMenuClick(item.onClick)}
              style={styles.menuItem}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <span style={{ marginRight: '8px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative' as const,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    backgroundColor: '#ff1744',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap' as const,
  },
  buttonOpen: {
    backgroundColor: '#e01040',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    minWidth: '180px',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    borderBottom: '1px solid #444',
  },
};
