import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { queryClient } from '@/shared/api/query-client';
import { Toaster } from '@/shared/components/ui/sonner';
import { applyFont, readStoredFont } from '@/modules/settings/lib/fonts';
import { DEFAULT_APP_FONT } from '@/shared/lib/app-font';
import { applyStoredTheme } from '@/shared/lib/theme';

applyStoredTheme();
// The font this browser used last (or the default, JetBrains Mono), before the first paint; `FontSync` sets the account's own once the user is known.
void applyFont(readStoredFont() ?? DEFAULT_APP_FONT);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
