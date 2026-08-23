import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import './styles.css';
import { ChannelTalkProvider } from './features/channel-talk/channel-talk-provider';
import { ToastProvider } from './components/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ChannelTalkProvider>
          <App />
        </ChannelTalkProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
