import { Outlet } from "react-router-dom";
import { AppTopBar } from "@/components/finyu/AppTopBar";
import { IdleTimeoutGuard } from "@/components/finyu/IdleTimeoutGuard";
import { InstallAppPrompt } from "@/components/finyu/InstallAppPrompt";
import { ScopeProvider } from "@/contexts/ScopeContext";
import { AppSidebar } from "./AppSidebar";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";

export function AppLayout() {
  return (
    <ScopeProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopBar />
          <main className="flex-1 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <IdleTimeoutGuard />
        <InstallAppPrompt />
      </SidebarProvider>
    </ScopeProvider>
  );
}
