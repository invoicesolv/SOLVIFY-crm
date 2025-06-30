// Authentication Flow Debug Utilities
export interface AuthFlowStep {
  step: string;
  timestamp: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class AuthFlowDebugger {
  private static steps: AuthFlowStep[] = [];
  
  static logStep(step: string, success: boolean, data?: any, error?: string) {
    const logEntry: AuthFlowStep = {
      step,
      timestamp: new Date().toISOString(),
      success,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      error
    };
    
    this.steps.push(logEntry);
    
    // Console log with color coding
    const prefix = success ? '✅' : '❌';
    const color = success ? '\x1b[32m' : '\x1b[31m'; // Green for success, red for error
    const reset = '\x1b[0m';
    
    console.log(`${color}${prefix} [Auth Debug] ${step}${reset}`);
    if (data && typeof data === 'object') {
      console.log(`   Data:`, data);
    }
    if (error) {
      console.log(`   Error: ${error}`);
    }
  }
  
  static getFullFlow(): AuthFlowStep[] {
    return this.steps;
  }
  
  static clearFlow() {
    this.steps = [];
  }
  
  static generateFlowChart(): string {
    let chart = '\n🔐 AUTHENTICATION FLOW VISUALIZATION\n';
    chart += '═'.repeat(50) + '\n\n';
    
    this.steps.forEach((step, index) => {
      const icon = step.success ? '✅' : '❌';
      const connector = index < this.steps.length - 1 ? '  ↓\n' : '';
      
      chart += `${index + 1}. ${icon} ${step.step}\n`;
      chart += `   Time: ${step.timestamp}\n`;
      
      if (step.data) {
        const dataPreview = step.data.length > 100 ? 
          step.data.substring(0, 100) + '...' : step.data;
        chart += `   Data: ${dataPreview}\n`;
      }
      
      if (step.error) {
        chart += `   Error: ${step.error}\n`;
      }
      
      chart += connector;
    });
    
    return chart;
  }
}

// Middleware to add auth debugging to API routes
export function withAuthDebug<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  routeName: string
) {
  return async (...args: T): Promise<Response> => {
    AuthFlowDebugger.logStep(`${routeName} - Request Started`, true);
    
    try {
      const response = await handler(...args);
      const success = response.status < 400;
      
      AuthFlowDebugger.logStep(
        `${routeName} - Response`, 
        success,
        { status: response.status, statusText: response.statusText }
      );
      
      return response;
    } catch (error) {
      AuthFlowDebugger.logStep(
        `${routeName} - Handler Error`,
        false,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  };
}

// Token visualization helper
export function visualizeToken(token: string | null): string {
  if (!token) return '❌ No token';
  
  try {
    // Try to decode as JWT
    const parts = token.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      
      return `🔑 JWT Token:
  Header: ${JSON.stringify(header, null, 2)}
  Payload: ${JSON.stringify(payload, null, 2)}
  Expires: ${new Date(payload.exp * 1000).toISOString()}`;
    }
  } catch {
    // Not a JWT, show as-is
  }
  
  return `🔑 Token: ${token.substring(0, 50)}...`;
}

// Cookie visualization helper
export function visualizeCookies(cookies: string[]): string {
  let visualization = '🍪 COOKIE ANALYSIS\n';
  visualization += '═'.repeat(30) + '\n';
  
  const authCookies = cookies.filter(cookie => 
    cookie.includes('auth') || 
    cookie.includes('session') || 
    cookie.includes('token')
  );
  
  if (authCookies.length === 0) {
    visualization += '❌ No authentication cookies found\n';
  } else {
    visualization += `✅ Found ${authCookies.length} auth-related cookies:\n`;
    authCookies.forEach(cookie => {
      visualization += `  • ${cookie}\n`;
    });
  }
  
  return visualization;
}
