# Sistema de Reservas para Restaurantes

Un sistema completo de gestión de reservas para restaurantes desarrollado con React, TypeScript y Supabase.

## 🚀 Características Principales

### Para Clientes
- **Reservas Online**: Proceso de reserva en 4 pasos intuitivos
- **Selección de Fecha y Hora**: Calendario interactivo con disponibilidad en tiempo real
- **Gestión de Comensales**: Selección del número de personas
- **Información Personal**: Formulario de contacto con validación
- **Confirmación Instantánea**: Confirmación inmediata de la reserva

### Para Administradores
- **Panel de Administración**: Dashboard completo para gestionar el restaurante
- **Gestión de Reservas**: Crear, editar y eliminar reservas
- **Configuración de Mesas**: Gestión del layout y capacidad del restaurante
- **Horarios y Disponibilidad**: Configuración de horarios de apertura
- **Combinaciones de Mesa**: Optimización automática de asignación de mesas

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 18 con TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Base de datos, Autenticación, Edge Functions)
- **Routing**: React Router DOM
- **Forms**: React Hook Form con Zod validation
- **UI Components**: Radix UI primitives
- **Build Tool**: Vite
- **Estado**: TanStack Query para gestión de datos

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/             # Componentes base (shadcn/ui)
│   ├── admin/          # Componentes del panel de administración
│   └── reservation/    # Componentes del proceso de reserva
├── pages/              # Páginas principales
│   ├── admin/          # Páginas del panel de administración
│   └── Index.tsx       # Página principal
├── contexts/           # Contextos de React (Auth, Config)
├── hooks/              # Hooks personalizados
├── lib/                # Utilidades y configuración
└── integrations/       # Configuración de Supabase
```

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js (versión 18 o superior)
- npm o yarn
- Cuenta de Supabase

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd sistema-reservas-restaurante
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Crear un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
   ```

4. **Configurar la base de datos** (ver [Database Setup](#database-setup))

5. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

## 🗄️ Database Setup

Este proyecto usa Supabase como backend. Para configurar la base de datos:

### Opción 1: Usando los Archivos SQL Completos (Recomendado)

1. **Bootstrap del esquema de la base de datos:**
   ```sql
   -- Ejecutar en el Editor SQL de Supabase
   \i docs/sql/bootstrap_full.sql
   ```

2. **Agregar datos de ejemplo:**
   ```sql
   -- Ejecutar en el Editor SQL de Supabase  
   \i docs/sql/seed_full.sql
   ```

### Opción 2: Configuración Manual

Si prefieres entender cada paso, puedes usar el archivo legacy:
- Ver `query-crear-db.md` para explicaciones detalladas
- Nota: El archivo legacy puede no incluir las últimas funcionalidades

### Qué Incluye

El bootstrap crea:
- ✅ Todas las tablas con relaciones apropiadas
- ✅ Políticas de Row Level Security (RLS)
- ✅ Funciones de base de datos para reservas
- ✅ Índices para rendimiento
- ✅ Datos de ejemplo para pruebas

Los datos de ejemplo incluyen:
- 🏪 Configuración del restaurante
- 📅 Horarios semanales y slots de tiempo
- 🪑 Mesas y combinaciones de mesas
- 👥 Clientes y reservas de ejemplo
- 🎯 Horarios especiales y días cerrados

## 🗄️ Base de Datos

### Tablas Principales

- **restaurants**: Configuración del restaurante
- **tables**: Mesas y su capacidad
- **schedules**: Horarios de apertura
- **reservations**: Reservas de clientes
- **customers**: Información de clientes
- **table_combinations**: Combinaciones de mesas para grupos grandes

### Edge Functions

- **agent-availability**: Verificación de disponibilidad
- **agent-create-reservation**: Creación de reservas con asignación automática

## 👥 Roles y Permisos

### Cliente
- Crear reservas
- Ver confirmación de reserva

### Administrador
- Acceso completo al panel de administración
- Gestión de todas las reservas
- Configuración del restaurante
- Gestión de mesas y horarios

## 🔒 Seguridad

- **Row Level Security (RLS)** habilitado en todas las tablas
- **Autenticación** mediante Supabase Auth
- **Validación** de datos en frontend y backend
- **Sanitización** de inputs del usuario

## 📱 Responsive Design

El sistema está completamente optimizado para:
- 📱 Dispositivos móviles
- 💻 Tablets
- 🖥️ Escritorio

## 🚀 Despliegue

### Usando Lovable
1. Abrir el proyecto en [Lovable](https://lovable.dev)
2. Hacer clic en "Share" → "Publish"

### Despliegue Manual
1. **Build del proyecto**
   ```bash
   npm run build
   ```

2. **Desplegar en tu plataforma preferida**
   - Vercel
   - Netlify
   - Supabase Hosting

## 🤝 Contribución

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Para soporte técnico o preguntas sobre el proyecto:

1. Revisar la [documentación de Lovable](https://docs.lovable.dev/)
2. Unirse a la [comunidad de Discord](https://discord.com/channels/1119885301872070706/1280461670979993613)
3. Crear un issue en este repositorio

## 🔄 Actualizaciones

Este proyecto se mantiene activamente. Para obtener las últimas actualizaciones:

```bash
git pull origin main
npm install
```
