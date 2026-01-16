/**
 * Shared logging utilities for Edge Functions.
 * Provides consistent logging and performance tracking.
 */

interface PerformanceLog {
  functionName: string;
  duration: number;
  userId?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a performance metric
 */
export function logPerformance(log: PerformanceLog) {
  console.log(
    JSON.stringify({
      type: 'PERFORMANCE',
      timestamp: new Date().toISOString(),
      ...log,
    })
  );
}

/**
 * Log a step in function execution
 */
export function logStep(functionName: string, step: string, details?: unknown) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${functionName}] ${step}${detailsStr}`);
}

/**
 * Log an error
 */
export function logError(functionName: string, error: unknown, context?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      type: 'ERROR',
      timestamp: new Date().toISOString(),
      functionName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    })
  );
}

/**
 * Wrapper for performance logging around async operations
 */
export async function withPerformanceLogging<T>(
  functionName: string,
  fn: () => Promise<T>,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    
    logPerformance({
      functionName,
      duration: performance.now() - start,
      userId,
      success: true,
      metadata,
    });
    
    return result;
  } catch (error) {
    logPerformance({
      functionName,
      duration: performance.now() - start,
      userId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata,
    });
    
    throw error;
  }
}

/**
 * Create a scoped logger for a specific function
 */
export function createFunctionLogger(functionName: string) {
  return {
    step: (step: string, details?: unknown) => logStep(functionName, step, details),
    error: (error: unknown, context?: Record<string, unknown>) => 
      logError(functionName, error, context),
    performance: (duration: number, success: boolean, userId?: string, metadata?: Record<string, unknown>) =>
      logPerformance({ functionName, duration, success, userId, metadata }),
  };
}
