import { Sidebar } from "@/components/layout/sidebar";

// TEMPORARY: auth removed while it's being rebuilt from scratch.
// This app is fully publicly accessible right now — no login required.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
