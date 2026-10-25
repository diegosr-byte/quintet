// The app (ops board, cases, console, scorecard, policy, team) shares the sidebar. The landing page and
// the single-purpose phone pages (/upload, /vendor) sit outside this group.
import { AppSidebar } from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:pl-64">
      <AppSidebar />
      {children}
    </div>
  );
}
