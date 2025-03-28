import { supabase } from './supabase';
import { useSession } from 'next-auth/react';

interface ServiceSettings {
  service_name: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  user_id: string;
}

export async function saveServiceSettings(settings: ServiceSettings) {
  try {
    if (!settings.user_id) {
      throw new Error('User ID is required to save service settings');
    }

    const { data, error } = await supabase
      .from('integrations')
      .upsert(
        {
          service_name: settings.service_name,
          access_token: settings.access_token,
          refresh_token: settings.refresh_token,
          expires_at: settings.expires_at,
          user_id: settings.user_id,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'service_name,user_id' }
      );

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving service settings:', error);
    throw error;
  }
}

export async function getServiceSettings(serviceName: string, userId: string) {
  try {
    if (!userId) {
      throw new Error('User ID is required to get service settings');
    }

    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('service_name', serviceName)
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting service settings:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`No integration found for user ${userId} and service ${serviceName}`);
      return null; // Or return a default object if preferred
    }

    return data[0]; // Return the first row
  } catch (error) {
    console.error('Error in getServiceSettings:', error);
    throw error;
  }
}

export async function deleteServiceSettings(serviceName: string, userId: string) {
  try {
    if (!userId) {
      throw new Error('User ID is required to delete service settings');
    }

    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('service_name', serviceName)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting service settings:', error);
    throw error;
  }
}

export async function enableServiceIntegration(serviceName: string, userId: string, defaultSettings: any = {}) {
  try {
    if (!userId) {
      throw new Error('User ID is required to enable service integration');
    }

    const { data, error } = await supabase
      .from('integrations')
      .insert([
        {
          user_id: userId,
          service_name: serviceName,
          enabled: true,
          settings: defaultSettings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error enabling service integration:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`Failed to enable ${serviceName} integration:`, error);
    throw error;
  }
}