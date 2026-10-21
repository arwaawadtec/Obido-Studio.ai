import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle Vite HMR WebSocket connection errors gracefully in embedded preview environments
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event?.reason?.message?.includes?.('WebSocket closed without opened')) {
      event.preventDefault();
      console.warn('[Obido Studio] Vite HMR WebSocket connection closed or interrupted by preview proxy.');
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);

