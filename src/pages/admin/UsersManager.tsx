import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useUserManagement, CreateUserData } from "@/hooks/useUserManagement";
import { supabase } from "@/lib/supabase";
import { UserProfile, UserRole } from "@/contexts/AuthContext";
import { Plus, Edit, Key, Search, Users, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EditUserForm {
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

interface ChangePasswordForm {
  new_password: string;
  confirm_password: string;
}

const UsersManager = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  // Usar el nuevo hook de gestión de usuarios
  const { createUser, getUsers, isLoading: isCreatingUser, updateUser, changePassword } = useUserManagement();

  const [createForm, setCreateForm] = useState<CreateUserData>({
    email: "",
    password: "",
    full_name: "",
    role: "user",
  });

  const [editForm, setEditForm] = useState<EditUserForm>({
    full_name: "",
    role: "user",
    is_active: true,
  });

  const [passwordForm, setPasswordForm] = useState<ChangePasswordForm>({
    new_password: "",
    confirm_password: "",
  });

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const result = await getUsers();

      if (result.success) {
        setUsers(result.data || []);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      toast({
        title: "Error",
        description: "Email y contraseña son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (createForm.password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    const result = await createUser(createForm);

    if (result.success) {
      setCreateForm({
        email: "",
        password: "",
        full_name: "",
        role: "user",
      });
      setIsCreateDialogOpen(false);
      fetchUsers(); // Recargar la lista
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const result = await updateUser(selectedUser.id, editForm);

      if (result.success) {
        toast({
          title: "Usuario actualizado",
          description: "Los datos del usuario han sido actualizados",
        });
        setIsEditDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.new_password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await changePassword(selectedUser.id, passwordForm.new_password);

      if (result.success) {
        toast({
          title: "Contraseña actualizada",
          description: "La contraseña ha sido cambiada exitosamente",
        });
        setPasswordForm({
          new_password: "",
          confirm_password: "",
        });
        setIsPasswordDialogOpen(false);
        setSelectedUser(null);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || "",
      role: user.role,
      is_active: user.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const openPasswordDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setPasswordForm({
      new_password: "",
      confirm_password: "",
    });
    setIsPasswordDialogOpen(true);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadge = (role: UserRole) => {
    const variants = {
      admin: "bg-red-100 text-red-800 border-red-200",
      user: "bg-blue-100 text-blue-800 border-blue-200",
    };

    const icons = {
      admin: <Shield className="w-3 h-3 mr-1" />,
      user: <User className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge className={`${variants[role]} border`}>
        {icons[role]}
        {role === "admin" ? "Administrador" : "Usuario"}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-restaurant-brown" />
          <div>
            <h1 className="text-3xl font-bold text-restaurant-brown">Gestión de Usuarios</h1>
            <p className="text-muted-foreground">Administra los usuarios del sistema</p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-restaurant-brown hover:bg-restaurant-brown/90">
              <Plus className="w-4 h-4 mr-2" />
              Crear Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              <DialogDescription>Completa los datos para crear un nuevo usuario en el sistema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-email">Email *</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Contraseña *</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-name">Nombre completo</Label>
                <Input
                  id="create-name"
                  placeholder="Nombre y apellidos"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Rol</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value: UserRole) => setCreateForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} className="bg-restaurant-brown hover:bg-restaurant-brown/90">
                  Crear Usuario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({filteredUsers.length})</CardTitle>
          <CardDescription>Lista de todos los usuarios registrados en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name || "Sin nombre"}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.created_at ? format(new Date(user.created_at), "dd/MM/yyyy", { locale: es }) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openPasswordDialog(user)}>
                        <Key className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifica los datos del usuario: {selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre completo</Label>
              <Input
                id="edit-name"
                placeholder="Nombre y apellidos"
                value={editForm.full_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) => setEditForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="edit-active">Usuario activo</Label>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditUser} className="bg-restaurant-brown hover:bg-restaurant-brown/90">
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>Cambiar contraseña para: {selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repite la contraseña"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} className="bg-restaurant-brown hover:bg-restaurant-brown/90">
                Cambiar Contraseña
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManager;
