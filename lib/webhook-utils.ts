import { supabaseClient } from '@/lib/supabase-client';

const supabase = supabaseClient;

export interface WebhookLog {
  id: string;
  workflow_id: string;
  payload: any;
  headers: Record<string, string>;
  received_at: string;
  processed: boolean;
  execution_id?: string;
  created_at: string;
}

export interface WebhookExecution {
  id: string;
  workflow_id: string;
  trigger_type: string;
  trigger_data: any;
  webhook_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  result?: any;
  created_at: string;
}

export class WebhookManager {
  /**
   * Send a webhook to an external URL
   */
  static async sendWebhook(config: {
    url: string;
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    retryOnFailure?: boolean;
  }): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const { url, method = 'POST', body, headers = {}, retryOnFailure = false } = config;

      // Default headers
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'Vibe-Automation/1.0',
        ...headers
      };

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: defaultHeaders,
      };

      // Add body for methods that support it
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      let lastError: Error | null = null;
      const maxRetries = retryOnFailure ? 3 : 1;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, requestOptions);
          
          let responseData;
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
          }

          if (response.ok) {
            return {
              success: true,
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                data: responseData
              }
            };
          } else {
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            if (attempt === maxRetries) {
              return {
                success: false,
                error: `Webhook failed after ${maxRetries} attempts: ${lastError.message}`,
                response: {
                  status: response.status,
                  statusText: response.statusText,
                  data: responseData
                }
              };
            }
          }
        } catch (error) {
          lastError = error as Error;
          if (attempt === maxRetries) {
            return {
              success: false,
              error: `Webhook failed after ${maxRetries} attempts: ${lastError.message}`
            };
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

      return {
        success: false,
        error: lastError?.message || 'Unknown error'
      };

    } catch (error) {
      return {
        success: false,
        error: `Webhook error: ${error}`
      };
    }
  }

  /**
   * Get webhook logs for a workflow
   */
  static async getWebhookLogs(workflowId: string, limit: number = 10): Promise<WebhookLog[]> {
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('received_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching webhook logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getWebhookLogs:', error);
      return [];
    }
  }

  /**
   * Get workflow executions
   */
  static async getWorkflowExecutions(workflowId: string, limit: number = 10): Promise<WebhookExecution[]> {
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching workflow executions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getWorkflowExecutions:', error);
      return [];
    }
  }

  /**
   * Generate webhook URL for a workflow
   */
  static generateWebhookUrl(workflowId: string, secret?: string, baseUrl?: string): string {
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com');
    let url = `${base}/api/webhooks?workflow_id=${workflowId}`;
    
    if (secret) {
      url += `&secret=${encodeURIComponent(secret)}`;
    }
    
    return url;
  }

  /**
   * Validate webhook signature (for HMAC verification)
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256'
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload)
        .digest('hex');
      
      // Compare signatures securely
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Process webhook variables in text (e.g., {{memory.data}}, {{trigger.payload}})
   */
  static processWebhookVariables(
    text: string,
    context: {
      memory?: Record<string, any>;
      trigger?: Record<string, any>;
      workflow?: Record<string, any>;
    }
  ): string {
    let processedText = text;

    // Replace memory variables
    if (context.memory) {
      processedText = processedText.replace(/\{\{memory\.(\w+)\}\}/g, (match, key) => {
        return context.memory?.[key] !== undefined ? JSON.stringify(context.memory[key]) : match;
      });
    }

    // Replace trigger variables
    if (context.trigger) {
      processedText = processedText.replace(/\{\{trigger\.(\w+)\}\}/g, (match, key) => {
        return context.trigger?.[key] !== undefined ? JSON.stringify(context.trigger[key]) : match;
      });
    }

    // Replace workflow variables
    if (context.workflow) {
      processedText = processedText.replace(/\{\{workflow\.(\w+)\}\}/g, (match, key) => {
        return context.workflow?.[key] !== undefined ? JSON.stringify(context.workflow[key]) : match;
      });
    }

    // Replace common variables
    processedText = processedText.replace(/\{\{timestamp\}\}/g, new Date().toISOString());
    processedText = processedText.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
    processedText = processedText.replace(/\{\{time\}\}/g, new Date().toTimeString().split(' ')[0]);

    return processedText;
  }
}

// Convenience functions
export const sendWebhook = WebhookManager.sendWebhook;
export const getWebhookLogs = WebhookManager.getWebhookLogs;
export const getWorkflowExecutions = WebhookManager.getWorkflowExecutions;
export const generateWebhookUrl = WebhookManager.generateWebhookUrl;
export const validateWebhookSignature = WebhookManager.validateWebhookSignature;
export const processWebhookVariables = WebhookManager.processWebhookVariables; 