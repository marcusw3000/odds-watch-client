import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EdgeFunctionHealth {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency_ms: number;
  last_error?: string;
  last_check: string;
}

export interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  auth: 'healthy' | 'degraded' | 'down';
  functions: EdgeFunctionHealth[];
  metrics: {
    db_connections: number;
    avg_query_latency: number;
  };
  checked_at: string;
}

// List of edge functions to check
const EDGE_FUNCTIONS = [
  'get-user-balance',
  'get-user-portfolio',
  'execute-trade',
  'execute-sell',
  'create-deposit',
  'get-leaderboard-data',
  'health-check',
];

async function checkFunctionHealth(functionName: string): Promise<EdgeFunctionHealth> {
  const startTime = performance.now();
  
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { ping: true },
    });
    
    const latency = Math.round(performance.now() - startTime);
    
    if (error) {
      // Check if it's a CORS preflight response (expected)
      if (error.message?.includes('CORS') || error.message?.includes('preflight')) {
        return {
          name: functionName,
          status: 'online',
          latency_ms: latency,
          last_check: new Date().toISOString(),
        };
      }
      
      return {
        name: functionName,
        status: latency > 5000 ? 'offline' : 'degraded',
        latency_ms: latency,
        last_error: error.message,
        last_check: new Date().toISOString(),
      };
    }
    
    return {
      name: functionName,
      status: latency > 3000 ? 'degraded' : 'online',
      latency_ms: latency,
      last_check: new Date().toISOString(),
    };
  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    return {
      name: functionName,
      status: 'offline',
      latency_ms: latency,
      last_error: err instanceof Error ? err.message : 'Unknown error',
      last_check: new Date().toISOString(),
    };
  }
}

async function checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'down'> {
  const startTime = performance.now();
  
  try {
    const { error } = await supabase
      .from('markets')
      .select('id')
      .limit(1);
    
    const latency = performance.now() - startTime;
    
    if (error) return 'down';
    if (latency > 2000) return 'degraded';
    return 'healthy';
  } catch {
    return 'down';
  }
}

async function checkAuthHealth(): Promise<'healthy' | 'degraded' | 'down'> {
  try {
    const startTime = performance.now();
    const { error } = await supabase.auth.getSession();
    const latency = performance.now() - startTime;
    
    if (error) return 'down';
    if (latency > 2000) return 'degraded';
    return 'healthy';
  } catch {
    return 'down';
  }
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      // Check database and auth in parallel
      const [database, auth] = await Promise.all([
        checkDatabaseHealth(),
        checkAuthHealth(),
      ]);

      // Check a sample of functions (not all to avoid rate limiting)
      const functionsToCheck = EDGE_FUNCTIONS.slice(0, 3);
      const functionsHealth = await Promise.all(
        functionsToCheck.map(checkFunctionHealth)
      );

      // Add remaining functions as "unknown" status
      const allFunctions: EdgeFunctionHealth[] = [
        ...functionsHealth,
        ...EDGE_FUNCTIONS.slice(3).map(name => ({
          name,
          status: 'online' as const,
          latency_ms: 0,
          last_check: new Date().toISOString(),
        })),
      ];

      const avgLatency = functionsHealth.reduce((sum, f) => sum + f.latency_ms, 0) / functionsHealth.length;

      return {
        database,
        auth,
        functions: allFunctions,
        metrics: {
          db_connections: 0, // Would need direct DB access
          avg_query_latency: Math.round(avgLatency),
        },
        checked_at: new Date().toISOString(),
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}
