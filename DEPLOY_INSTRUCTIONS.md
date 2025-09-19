# Instrucciones para Desplegar Edge Functions en Producción

Este documento explica cómo desplegar las Edge Functions en tu proyecto de Supabase en producción para resolver el error `InvalidWorkerCreation`.

## Opción 1: Despliegue desde la Interfaz Web de Supabase

1. **Accede al Dashboard de Supabase**

   - Inicia sesión en [dashboard.supabase.com](https://dashboard.supabase.com)
   - Selecciona tu proyecto `restaurante1`

2. **Crea la función `agent-create-reservation`**

   - Ve a "Edge Functions" en el menú lateral
   - Haz clic en "Create a new function"
   - Nombre: `agent-create-reservation`
   - Copia y pega el código del archivo `supabase/functions/agent-create-reservation/index.ts`
   - Haz clic en "Create"

3. **Crea la función `agent-availability`**

   - Repite el proceso para crear la función `agent-availability`
   - Copia y pega el código del archivo `supabase/functions/agent-availability/index.ts`

4. **Verifica el despliegue**
   - Asegúrate de que ambas funciones aparecen como "Active" en el dashboard
   - Prueba la API usando el script `test-api.sh`

## Opción 2: Despliegue desde la Línea de Comandos

### Instalación de Supabase CLI

Instala Supabase CLI usando uno de estos métodos:

```bash
# macOS con Homebrew
brew install supabase/tap/supabase

# Instalación directa (cualquier sistema)
curl -s https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
```

### Configuración del Proyecto

1. **Instala las dependencias locales**

   ```bash
   npm install supabase --save-dev
   ```

2. **Vincula tu proyecto local con el proyecto de Supabase**

   ```bash
   # Obtén el ID de tu proyecto desde el dashboard de Supabase
   # (Configuración del proyecto → API → URL del proyecto)
   # Ejemplo: https://abcdefghijklm.supabase.co
   # El ID sería: abcdefghijklm

   npx supabase login
   npx supabase link --project-ref TU_PROJECT_ID
   ```

3. **Despliega las funciones**

   ```bash
   npx supabase functions deploy agent-create-reservation
   npx supabase functions deploy agent-availability
   ```

4. **Verifica el despliegue**
   ```bash
   npx supabase functions list
   ```

## Verificación

Después de desplegar las funciones, ejecuta el script de prueba para verificar que todo funciona correctamente:

```bash
./test-api.sh
```

Deberías recibir una respuesta exitosa en lugar del error `InvalidWorkerCreation`.

## Solución de Problemas

Si sigues viendo errores después del despliegue:

1. **Verifica los logs**

   ```bash
   npx supabase functions logs agent-create-reservation
   ```

2. **Comprueba los permisos**

   - Asegúrate de que la función tiene los permisos necesarios en el dashboard de Supabase
   - Ve a "Edge Functions" → selecciona la función → "Settings" → "Auth"

3. **Verifica las variables de entorno**
   - Asegúrate de que todas las variables de entorno necesarias están configuradas
   - Ve a "Edge Functions" → selecciona la función → "Settings" → "Environment variables"
