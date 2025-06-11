export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chat_channels: {
        Row: {
          channel_type: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          project_id: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          channel_type?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          channel_type?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          reply_to: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          reply_to?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          reply_to?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
      }
      calendar_events: {
        Row: {
          attendees: Json | null
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string
          event_type: string | null
          external_event_id: string | null
          external_sync_status: string | null
          id: string
          location: string | null
          project_id: string | null
          recurring_rule: string | null
          reminder_minutes: number | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          attendees?: Json | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          event_type?: string | null
          external_event_id?: string | null
          external_sync_status?: string | null
          id: string
          location?: string | null
          project_id?: string | null
          recurring_rule?: string | null
          reminder_minutes?: number | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          attendees?: Json | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_type?: string | null
          external_event_id?: string | null
          external_sync_status?: string | null
          id?: string
          location?: string | null
          project_id?: string | null
          recurring_rule?: string | null
          reminder_minutes?: number | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
      }
      projects: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          description: string | null
          end_date: string | null
          folder_id: string | null
          id: string
          name: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          end_date?: string | null
          folder_id?: string | null
          id?: string
          name?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          end_date?: string | null
          folder_id?: string | null
          id?: string
          name?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
      }
      project_folders: {
        Row: {
          id: string
          name: string
          workspace_id: string
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          workspace_id: string
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          workspace_id?: string
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      project_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          attachments: Json | null
          checklist: Json | null
          completion_percentage: number | null
          created_at: string | null
          deadline: string | null
          dependencies: Json | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          priority: string | null
          progress: number | null
          project_id: string | null
          status: string | null
          tags: Json | null
          title: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          attachments?: Json | null
          checklist?: Json | null
          completion_percentage?: number | null
          created_at?: string | null
          deadline?: string | null
          dependencies?: Json | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          status?: string | null
          tags?: Json | null
          title: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          attachments?: Json | null
          checklist?: Json | null
          completion_percentage?: number | null
          created_at?: string | null
          deadline?: string | null
          dependencies?: Json | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          status?: string | null
          tags?: Json | null
          title?: string
          user_id?: string | null
          workspace_id?: string | null
        }
      }
      user_presence: {
        Row: {
          created_at: string | null
          current_activity: string | null
          id: string
          last_seen: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          current_activity?: string | null
          id?: string
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          current_activity?: string | null
          id?: string
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          is_admin: boolean | null
          is_personal: boolean | null
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          is_personal?: boolean | null
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          is_personal?: boolean | null
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
