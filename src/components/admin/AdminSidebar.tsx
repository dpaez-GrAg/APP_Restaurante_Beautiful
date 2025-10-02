import {
  Calendar,
  Clock,
  Layout,
  Settings,
  Users,
  BarChart3,
  TableProperties,
  Link,
  UserCheck,
  Shield,
  FileText,
  MapPin,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/components/auth/ProtectedRoute";

const adminItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: BarChart3,
    permission: "dashboard.view",
  },
  {
    title: "Reservas",
    url: "/admin/reservations",
    icon: Calendar,
    permission: "reservations.view",
  },
  {
    title: "Clientes",
    url: "/admin/customers",
    icon: UserCheck,
    permission: "customers.view",
  },
  {
    title: "Mesas",
    url: "/admin/tables",
    icon: TableProperties,
    permission: "tables.view",
  },

  {
    title: "Distribución",
    url: "/admin/layout",
    icon: Layout,
    permission: "layout.view",
  },
  {
    title: "Combinaciones",
    url: "/admin/combinations",
    icon: Link,
    permission: "combinations.view",
  },
  {
    title: "Horarios",
    url: "/admin/schedules",
    icon: Clock,
    permission: "schedules.view",
  },
  {
    title: "Configuración",
    url: "/admin/settings",
    icon: Settings,
    permission: "settings.view",
  },
  {
    title: "Usuarios",
    url: "/admin/users",
    icon: Shield,
    permission: "users.view",
  },
  // {
  //   title: "Auditoría",
  //   url: "/admin/audit",
  //   icon: FileText,
  //   permission: "audit.view",
  // },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { hasPermission, isAdmin, userRole } = usePermissions();

  // Memoize the active path check
  const isActive = useMemo(
    () => (path: string) => {
      if (path === "/admin") {
        return currentPath === "/admin";
      }
      return currentPath.startsWith(path);
    },
    [currentPath]
  );

  // Memoize the navigation class function
  const getNavCls = useMemo(
    () =>
      ({ isActive }: { isActive: boolean }) =>
        isActive
          ? "bg-restaurant-gold/20 text-restaurant-brown font-medium border-r-2 border-restaurant-gold"
          : "hover:bg-restaurant-warm/50 text-muted-foreground hover:text-restaurant-brown",
    []
  );

  // Memoize filtered items to avoid recalculation on every render
  const visibleItems = useMemo(() => adminItems.filter((item) => hasPermission(item.permission)), [hasPermission]);

  return (
    <Sidebar className={`${collapsed ? "w-14" : "w-64"} border-r border-border bg-background`}>
      <SidebarTrigger className="m-2 self-end" />

      <SidebarContent>
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-restaurant-gold" />
            {!collapsed && (
              <div>
                <h2 className="font-bold text-restaurant-brown">Admin Panel</h2>
                <p className="text-xs text-muted-foreground">
                  {userRole === "admin" ? "Administrador" : "Usuario"} - Gestión Restaurante
                </p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-restaurant-brown">
            {isAdmin ? "Gestión Completa" : "Gestión Básica"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className={getNavCls({ isActive: isActive(item.url) })}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
