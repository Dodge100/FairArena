import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useUser } from '@clerk/clerk-react';
import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AIButton } from '../components/AIButton';
import { AISidebar } from '../components/AISidebar';
import { AppSidebar } from '../components/AppSidebar';
import { ChatProvider } from '../contexts/ChatContext';

export default function ProtectedLayout() {
  const { isSignedIn, isLoaded } = useUser();
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DDEF00]"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <ChatProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-screen overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-auto bg-background">
            <div className="p-6 min-h-screen">
              <div className="mb-4">
                <SidebarTrigger />
              </div>
              <Outlet />
            </div>
          </main>
          <AIButton onClick={() => setIsAISidebarOpen(true)} />
          <AISidebar isOpen={isAISidebarOpen} onClose={() => setIsAISidebarOpen(false)} />
        </div>
      </SidebarProvider>
    </ChatProvider>
  );
}
