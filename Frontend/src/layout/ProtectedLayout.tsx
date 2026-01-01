import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuthState } from '@/lib/auth';
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AIButton } from '../components/AIButton';
import { AISidebar } from '../components/AISidebar';
import { AppSidebar } from '../components/AppSidebar';
import { OrganizationSwitcher } from '../components/OrganizationSwitcher';
import { ChatProvider } from '../contexts/ChatContext';
import { OrganizationProvider } from '../contexts/OrganizationContext';

export default function ProtectedLayout() {
  const { isSignedIn, isLoaded } = useAuthState();
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [aiButtonHidden, setAiButtonHidden] = useState(false);
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DDEF00]"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return (
    <OrganizationProvider>
      <ChatProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-screen overflow-hidden">
            <AppSidebar />
            <main className="flex-1 overflow-auto bg-background">
              <div className="p-6 min-h-screen">
                <div className="mb-4 flex items-center justify-between">
                  <SidebarTrigger />
                  <div className="flex-1 flex justify-center">
                    <OrganizationSwitcher />
                  </div>
                  <div className="w-10" />
                </div>
                <Outlet />
              </div>
            </main>
            <AIButton onClick={() => setIsAISidebarOpen(true)} hidden={aiButtonHidden} />
            <AISidebar
              isOpen={isAISidebarOpen}
              onClose={() => setIsAISidebarOpen(false)}
              aiButtonHidden={aiButtonHidden}
              setAiButtonHidden={setAiButtonHidden}
            />
          </div>
        </SidebarProvider>
      </ChatProvider>
    </OrganizationProvider>
  );
}
