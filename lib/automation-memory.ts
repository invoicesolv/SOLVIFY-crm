/**
 * Automation Memory Storage Utilities
 * Provides easy-to-use functions for storing and retrieving memory data in workflows
 */

export interface MemoryStorageOptions {
  workspaceId: string;
  workflowId: string;
  expiresInHours?: number;
}

export interface MemoryData {
  [key: string]: any;
}

/**
 * Store a value in automation memory
 */
export async function storeMemory(
  key: string, 
  value: any, 
  options: MemoryStorageOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/automation/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: options.workspaceId,
        workflow_id: options.workflowId,
        memory_key: key,
        memory_value: value,
        expires_in_hours: options.expiresInHours
      })
    });

    const result = await response.json();
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Retrieve a specific value from automation memory
 */
export async function getMemory(
  key: string, 
  options: Pick<MemoryStorageOptions, 'workspaceId' | 'workflowId'>
): Promise<{ success: boolean; data: any; exists: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({
      workspace_id: options.workspaceId,
      workflow_id: options.workflowId,
      memory_key: key
    });

    const response = await fetch(`/api/automation/memory?${params}`);
    const result = await response.json();
    
    return { 
      success: result.success, 
      data: result.data, 
      exists: result.exists,
      error: result.error 
    };
  } catch (error) {
    return { success: false, data: null, exists: false, error: String(error) };
  }
}

/**
 * Retrieve all memory data for a workflow
 */
export async function getAllMemory(
  options: Pick<MemoryStorageOptions, 'workspaceId' | 'workflowId'>
): Promise<{ success: boolean; data: MemoryData; count: number; error?: string }> {
  try {
    const params = new URLSearchParams({
      workspace_id: options.workspaceId,
      workflow_id: options.workflowId
    });

    const response = await fetch(`/api/automation/memory?${params}`);
    const result = await response.json();
    
    return { 
      success: result.success, 
      data: result.data || {}, 
      count: result.count || 0,
      error: result.error 
    };
  } catch (error) {
    return { success: false, data: {}, count: 0, error: String(error) };
  }
}

/**
 * Delete a specific memory key
 */
export async function deleteMemory(
  key: string, 
  options: Pick<MemoryStorageOptions, 'workspaceId' | 'workflowId'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({
      workspace_id: options.workspaceId,
      workflow_id: options.workflowId,
      memory_key: key
    });

    const response = await fetch(`/api/automation/memory?${params}`, {
      method: 'DELETE'
    });

    const result = await response.json();
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Clear all memory for a workflow
 */
export async function clearAllMemory(
  options: Pick<MemoryStorageOptions, 'workspaceId' | 'workflowId'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({
      workspace_id: options.workspaceId,
      workflow_id: options.workflowId
    });

    const response = await fetch(`/api/automation/memory?${params}`, {
      method: 'DELETE'
    });

    const result = await response.json();
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Memory storage helper for common use cases
 */
export class AutomationMemory {
  private options: Pick<MemoryStorageOptions, 'workspaceId' | 'workflowId'>;

  constructor(workspaceId: string, workflowId: string) {
    this.options = { workspaceId, workflowId };
  }

  async store(key: string, value: any, expiresInHours?: number) {
    return storeMemory(key, value, { ...this.options, expiresInHours });
  }

  async get(key: string) {
    return getMemory(key, this.options);
  }

  async getAll() {
    return getAllMemory(this.options);
  }

  async delete(key: string) {
    return deleteMemory(key, this.options);
  }

  async clear() {
    return clearAllMemory(this.options);
  }

  // Convenience methods for common data types
  async storeCustomerData(customerId: string, data: any) {
    return this.store(`customer_${customerId}`, data);
  }

  async getCustomerData(customerId: string) {
    return this.get(`customer_${customerId}`);
  }

  async storeConversationContext(conversationId: string, context: any) {
    return this.store(`conversation_${conversationId}`, context);
  }

  async getConversationContext(conversationId: string) {
    return this.get(`conversation_${conversationId}`);
  }

  async storeWorkflowState(state: any) {
    return this.store('workflow_state', state);
  }

  async getWorkflowState() {
    return this.get('workflow_state');
  }
} 