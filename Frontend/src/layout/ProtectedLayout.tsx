import { SidebarProvider } from "@/components/ui/sidebar";
import { useUser } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";
import { AppSidebar } from "../components/AppSidebar";

export default function ProtectedLayout() {
    const { isSignedIn, isLoaded } = useUser();

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
        <SidebarProvider>
            <div className="flex min-h-screen w-screen overflow-hidden">
                <AppSidebar />
                <main className="flex-1 overflow-auto bg-background">
                    <div className="p-6 min-h-screen">
                        <Outlet />
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}
