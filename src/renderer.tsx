/**
 * Renderer Process Entry Point
 * Loads React app and renders it to the DOM
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './index.css';

console.log('[Renderer] Starting Klippy renderer process...');

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React root and render App
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('[Renderer] React app mounted');
