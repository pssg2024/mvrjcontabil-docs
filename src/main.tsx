import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Bloqueio rigoroso de zoom na rolagem com Ctrl e atalhos de teclado
if (typeof window !== 'undefined') {
  window.addEventListener('wheel', (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (
        e.key === '+' || 
        e.key === '-' || 
        e.key === '=' || 
        e.key === '0' || 
        e.code === 'NumpadAdd' || 
        e.code === 'NumpadSubtract' || 
        e.code === 'Numpad0' || 
        e.code === 'Digit0' || 
        e.code === 'Equal' || 
        e.code === 'Minus'
      ) {
        e.preventDefault();
      }
    }
  }, { passive: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
