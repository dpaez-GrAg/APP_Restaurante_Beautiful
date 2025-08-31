import { Calendar, Clock, Layout, Settings, Users, BarChart3, TableProperties } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
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

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: BarChart3 },
  { title: "Reservas", url: "/admin/reservations", icon: Calendar },
  { title: "Mesas", url: "/admin/tables", icon: TableProperties },
  { title: "Horarios", url: "/admin/hours", icon: Clock },
  { title: "Layout", url: "/admin/layout", icon: Layout },
  { title: "Configuración", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/admin") {
      return currentPath === "/admin";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-restaurant-gold/20 text-restaurant-brown font-medium border-r-2 border-restaurant-gold" : "hover:bg-restaurant-warm/50 text-muted-foreground hover:text-restaurant-brown";

  return (
    <Sidebar
      className={`${collapsed ? "w-14" : "w-64"} border-r border-border bg-background`}
    >
      <SidebarTrigger className="m-2 self-end" />

      <SidebarContent>
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-restaurant-gold" />
            {!collapsed && (
              <div>
                <h2 className="font-bold text-restaurant-brown">Admin Panel</h2>
                <p className="text-xs text-muted-foreground">Gestión Restaurante</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-restaurant-brown">
            Gestión Principal
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
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