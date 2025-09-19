# Local Development Setup - Tu Mesa Ideal

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **npm** or **yarn**
3. **Supabase CLI** (see installation options below)
4. **Docker Desktop** (for local Supabase development)

## Supabase CLI Installation

The Supabase CLI cannot be installed globally via npm. Use one of these methods instead:

### Option 1: Install with Homebrew (macOS)

```bash
brew install supabase/tap/supabase
```

### Option 2: Use npx (no installation required)

```bash
npx supabase <command>
```

### Option 3: Install with other package managers

```bash
# Windows (scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Arch Linux
yay -S supabase-cli

# Standalone binary (all platforms)
curl -s https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
```

## Docker Setup

Docker Desktop must be running before starting Supabase locally. If you don't have Docker Desktop:

1. Download and install from [Docker's official website](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop application
3. Ensure Docker is running with: `docker ps`

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your local Supabase configuration:

```env
# App Configuration
VITE_APP_NAME="Tu Mesa Ideal"
VITE_CLIENT_SLUG="demo"
VITE_BRAND_CONFIG_URL="/tenants/demo.json"

# Supabase Configuration (Local)
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_ANON_KEY="your_local_anon_key_here"

# Feature Flags
VITE_FEATURE_RESERVAS="true"
```

### 3. Start Supabase Local Development

Ensure Docker Desktop is running first, then:

```bash
# Initialize Supabase (if not already done)
npx supabase init

# Start local Supabase services
npx supabase start
```

This will start:

- PostgreSQL database on `localhost:54322`
- API server on `localhost:54321`
- Supabase Studio on `localhost:54323`
- Edge Functions runtime
- Auth server
- Storage server

### 4. Set Up Database Schema

```bash
# Reset database and apply migrations + seed data
npx supabase db reset
```

If you have the full SQL files from production:

```bash
# Apply the bootstrap schema
npx supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres"
# Then run the bootstrap SQL in Supabase Studio or via psql
```

### 5. Deploy Edge Functions Locally

```bash
# Deploy the Edge Functions to local environment
npx supabase functions deploy agent-create-reservation
npx supabase functions deploy agent-availability
```

### 6. Update Environment Variables

After starting Supabase, update your `.env` file with the actual local keys:

```bash
# Get the local keys
npx supabase status
```

Copy the `anon key` to your `.env` file:

```env
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 7. Start the Frontend

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Alternative: Testing Without Local Supabase

If you're unable to run Docker or Supabase locally, you can still test the frontend by:

### Option 1: Use the Production Supabase Backend

1. Create a `.env` file with production API keys (limited to frontend access only):

   ```env
   VITE_SUPABASE_URL="https://PROJECT.supabase.co"
   VITE_SUPABASE_ANON_KEY="your_production_anon_key"
   ```

2. Start the frontend:

   ```bash
   npm run dev
   ```

3. Test the UI at `http://localhost:5173`

### Option 2: Create a Development Project on Supabase Cloud

1. Create a free project at [supabase.com](https://supabase.com)
2. Run the bootstrap SQL from `docs/sql/bootstrap_full.sql` in the SQL editor
3. Run the seed SQL from `docs/sql/seed_full.sql` in the SQL editor
4. Deploy Edge Functions via the Supabase Dashboard
5. Use the development project's URL and anon key in your `.env` file

## API Endpoints (Local)

- **Frontend**: `http://localhost:5173`
- **Supabase API**: `http://localhost:54321`
- **Supabase Studio**: `http://localhost:54323`
- **Edge Functions**: `http://localhost:54321/functions/v1/`

### Testing the API Endpoints

#### Create Reservation via API

```bash
curl -X POST http://localhost:54321/functions/v1/agent-create-reservation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "customer_name": "Juan Pérez",
    "customer_email": "juan@example.com",
    "customer_phone": "+34 123 456 789",
    "date": "2025-01-20",
    "time": "20:00",
    "guests": 4,
    "special_requests": "Mesa junto a la ventana"
  }'
```

#### Check Availability via API

```bash
curl -X POST http://localhost:54321/functions/v1/agent-availability \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "date": "2025-01-20",
    "guests": 4
  }'
```

## Database Access

### Via Supabase Studio

Visit `http://localhost:54323` to access the local Supabase Studio interface.

### Via psql

```bash
# Connect to local database
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

### Via Supabase CLI

```bash
# Run SQL queries
npx supabase db query "SELECT * FROM restaurants;"
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports 54321-54324 are in use, stop other services or modify `supabase/config.toml`

2. **Docker not running**: Ensure Docker Desktop is running before `supabase start`

3. **Edge Functions not working**:

   ```bash
   # Restart functions
   npx supabase functions deploy agent-create-reservation --no-verify-jwt
   npx supabase functions deploy agent-availability --no-verify-jwt
   ```

4. **Database schema missing**:

   ```bash
   # Reset and reload
   npx supabase db reset
   ```

5. **Environment variables not loading**: Restart the dev server after changing `.env`

### Logs and Debugging

```bash
# View Supabase logs
npx supabase logs

# View Edge Function logs
npx supabase functions logs agent-create-reservation

# View database logs
npx supabase logs db
```

## Production vs Local Differences

| Feature        | Production                                | Local                    |
| -------------- | ----------------------------------------- | ------------------------ |
| Database       | Hosted Supabase                           | Local PostgreSQL         |
| API URL        | `https://api.restaurante1.gridded.agency` | `http://localhost:54321` |
| Edge Functions | Deployed                                  | Local runtime            |
| Auth           | Production keys                           | Local test keys          |

## Next Steps

1. Test reservation creation via the UI at `http://localhost:5173`
2. Test API endpoints with Postman or curl
3. Use Supabase Studio to inspect database changes
4. Deploy changes to production when ready

## Useful Commands

```bash
# Stop all Supabase services
npx supabase stop

# View current status
npx supabase status

# Generate TypeScript types
npx supabase gen types typescript --local > src/types/supabase.ts

# Create a new migration
npx supabase migration new your_migration_name

# Apply migrations
npx supabase db push
```
