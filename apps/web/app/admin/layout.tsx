import { AdminShellNav } from "@/components/admin-shell-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <AdminShellNav />
      {children}
    </div>
  );
}
