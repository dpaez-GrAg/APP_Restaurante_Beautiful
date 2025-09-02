import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('main.tsx loading...');
console.log('React version:', React.version);

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
console.log('Rendering App...');
root.render(<App />);
