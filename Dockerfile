# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app

# Habilita corepack para pnpm/yarn si tu repo lo usa
RUN corepack enable

# Copia manifiestos y instala deps con el gestor que exista
COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm i; fi

# Copia el resto y construye
COPY . .
# Variables Vite en build (Coolify -> Build arguments)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_NAME
RUN npm run build

# ---- Run ----
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
# OJO: copia desde la etapa de build
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1
