import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';

console.log('Main.tsx: Iniciando renderização...');

window.onerror = function(message, source, lineno, colno, error) {
  console.error('GLOBAL ERROR:', message, error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif; background: white; position: fixed; inset: 0; z-index: 9999;">
      <h1 style="font-size: 20px; font-weight: bold;">Erro Crítico ao Carregar Aplicativo</h1>
      <pre style="white-space: pre-wrap; margin-top: 10px; font-size: 12px;">${message}</pre>
      <p style="margin-top: 10px; font-size: 14px;">Verifique o console do navegador para mais detalhes.</p>
    </div>`;
  }
};

if (typeof window !== 'undefined') {
  (window as any).APP_LOADED = true;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
    console.log('Main.tsx: Renderização disparada');
  } catch (err) {
    console.error('Main.tsx: Erro na renderização:', err);
  }
}
