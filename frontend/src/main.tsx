import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import './i18n';
import './styles/index.css';
import { queryClient } from './app/queryClient';
import { router } from './app/router';
import { BranchScopeProvider } from './app/BranchScope';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BranchScopeProvider>
        <RouterProvider router={router} />
      </BranchScopeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
