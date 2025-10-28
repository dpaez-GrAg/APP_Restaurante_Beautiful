/**
 * Helper para hacer queries a Supabase usando fetch directo
 * Soluciona problemas de timeout con el cliente de Supabase
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEFAULT_TIMEOUT = 10000; // 10 segundos

interface FetchOptions {
  timeout?: number;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
}

/**
 * Hace una query GET a una tabla de Supabase
 */
export async function supabaseFetchTable<T = any>(
  table: string,
  select: string = '*',
  filters: Record<string, any> = {},
  options: FetchOptions = {}
): Promise<{ data: T[] | null; error: any }> {
  try {
    const { timeout = DEFAULT_TIMEOUT } = options;
    
    // Construir query params
    const params = new URLSearchParams({ select });
    Object.entries(filters).forEach(([key, value]) => {
      params.append(key, `eq.${value}`);
    });
    
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
    
    const fetchPromise = fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        return { data: null, error: { message: error } };
      }
      const data = await response.json();
      return { data, error: null };
    });
    
    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout después de ${timeout}ms`)), timeout)
    );
    
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Error fetching ${table}:`, error);
    return { data: null, error };
  }
}

/**
 * Hace una llamada RPC a una función de Supabase
 */
export async function supabaseFetchRPC<T = any>(
  functionName: string,
  params: Record<string, any> = {},
  options: FetchOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    const { timeout = DEFAULT_TIMEOUT } = options;
    
    const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;
    
    const fetchPromise = fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(params),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        return { data: null, error: { message: error } };
      }
      const data = await response.json();
      return { data, error: null };
    });
    
    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout después de ${timeout}ms`)), timeout)
    );
    
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Error calling RPC ${functionName}:`, error);
    return { data: null, error };
  }
}

/**
 * Inserta datos en una tabla
 */
export async function supabaseFetchInsert<T = any>(
  table: string,
  data: any,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    const { timeout = DEFAULT_TIMEOUT } = options;
    
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    
    const fetchPromise = fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        return { data: null, error: { message: error } };
      }
      const result = await response.json();
      return { data: result, error: null };
    });
    
    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout después de ${timeout}ms`)), timeout)
    );
    
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Error inserting into ${table}:`, error);
    return { data: null, error };
  }
}

/**
 * Actualiza datos en una tabla
 */
export async function supabaseFetchUpdate<T = any>(
  table: string,
  data: any,
  filters: Record<string, any> = {},
  options: FetchOptions = {}
): Promise<{ data: T | null; error: any }> {
  try {
    const { timeout = DEFAULT_TIMEOUT } = options;
    
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      params.append(key, `eq.${value}`);
    });
    
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
    
    const fetchPromise = fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        return { data: null, error: { message: error } };
      }
      const result = await response.json();
      return { data: result, error: null };
    });
    
    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout después de ${timeout}ms`)), timeout)
    );
    
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Error updating ${table}:`, error);
    return { data: null, error };
  }
}
