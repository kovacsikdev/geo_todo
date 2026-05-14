import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { store } from './store';
import './index.css';

const captureBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
  event.preventDefault();
  window.__geoTodoBeforeInstallPromptEvent = event;
};

const clearCapturedInstallPrompt = () => {
  window.__geoTodoBeforeInstallPromptEvent = null;
};

window.addEventListener('beforeinstallprompt', captureBeforeInstallPrompt);
window.addEventListener('appinstalled', clearCapturedInstallPrompt);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
);
