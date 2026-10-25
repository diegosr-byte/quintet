// Templates remount on every navigation (layouts don't), so each app page fades in when opened.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
