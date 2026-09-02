'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import ToastContainer from '@/components/ui/ToastContainer';
import CriticalAlertWatcher from '@/components/CriticalAlertWatcher';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
  );
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastContainer />
        <CriticalAlertWatcher />
      </QueryClientProvider>
    </SessionProvider>
  );
}
