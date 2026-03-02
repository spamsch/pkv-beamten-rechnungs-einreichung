import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Upload,
  FileDown,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Rechnungen", icon: FileText },
  { to: "/invoices/new", label: "Neue Rechnung", icon: PlusCircle },
  { to: "/import", label: "Excel Import", icon: Upload },
  { to: "/import/paperless", label: "Paperless Import", icon: FileDown },
];

const bottomNavItems = [
  { to: "/settings", label: "Einstellungen", icon: Settings },
];

export function AppShell() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">PKV Tracking</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1 flex flex-col">
          <div className="flex-1 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-2 space-y-1">
            {bottomNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
