import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export function mountApp(App: React.ComponentType) {
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
