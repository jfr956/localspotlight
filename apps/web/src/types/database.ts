export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_briefs: {
        Row: {
          brief: Json
          created_at: string | null
          embeddings: string | null
          id: string
          location_id: string
          org_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          brief: Json
          created_at?: string | null
          embeddings?: string | null
          id?: string
          location_id: string
          org_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          brief?: Json
          created_at?: string | null
          embeddings?: string | null
          id?: string
          location_id?: string
          org_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          costs: number | null
          created_at: string | null
          id: string
          input: Json
          kind: Database["public"]["Enums"]["content_type"]
          location_id: string
          model: string | null
          org_id: string
          output: Json | null
          risk_score: number | null
          status: Database["public"]["Enums"]["generation_status"] | null
          updated_at: string | null
        }
        Insert: {
          costs?: number | null
          created_at?: string | null
          id?: string
          input: Json
          kind: Database["public"]["Enums"]["content_type"]
          location_id: string
          model?: string | null
          org_id: string
          output?: Json | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["generation_status"] | null
          updated_at?: string | null
        }
        Update: {
          costs?: number | null
          created_at?: string | null
          id?: string
          input?: Json
          kind?: Database["public"]["Enums"]["content_type"]
          location_id?: string
          model?: string | null
          org_id?: string
          output?: Json | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["generation_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          meta: Json | null
          org_id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_policies: {
        Row: {
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string | null
          delete_window_sec: number | null
          id: string
          location_id: string | null
          max_per_week: number | null
          mode: Database["public"]["Enums"]["automation_mode"] | null
          org_id: string
          quiet_hours: Json | null
          require_disclaimers: boolean | null
          risk_threshold: number | null
          updated_at: string | null
        }
        Insert: {
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          delete_window_sec?: number | null
          id?: string
          location_id?: string | null
          max_per_week?: number | null
          mode?: Database["public"]["Enums"]["automation_mode"] | null
          org_id: string
          quiet_hours?: Json | null
          require_disclaimers?: boolean | null
          risk_threshold?: number | null
          updated_at?: string | null
        }
        Update: {
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          delete_window_sec?: number | null
          id?: string
          location_id?: string | null
          max_per_week?: number | null
          mode?: Database["public"]["Enums"]["automation_mode"] | null
          org_id?: string
          quiet_hours?: Json | null
          require_disclaimers?: boolean | null
          risk_threshold?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_policies_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      connections_google: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          org_id: string
          refresh_token_enc: string
          scopes: string[]
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          org_id: string
          refresh_token_enc: string
          scopes: string[]
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          org_id?: string
          refresh_token_enc?: string
          scopes?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_google_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_accounts: {
        Row: {
          created_at: string | null
          display_name: string | null
          google_account_name: string
          id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          google_account_name: string
          id?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          google_account_name?: string
          id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_locations: {
        Row: {
          account_id: string | null
          created_at: string | null
          google_location_name: string
          id: string
          is_managed: boolean | null
          meta: Json | null
          org_id: string
          sync_state: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          google_location_name: string
          id?: string
          is_managed?: boolean | null
          meta?: Json | null
          org_id: string
          sync_state?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          google_location_name?: string
          id?: string
          is_managed?: boolean | null
          meta?: Json | null
          org_id?: string
          sync_state?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gbp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_media: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          media_id: string
          org_id: string
          type: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          media_id: string
          org_id: string
          type?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          media_id?: string
          org_id?: string
          type?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gbp_media_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_posts: {
        Row: {
          call_to_action_type: string | null
          call_to_action_url: string | null
          created_at: string | null
          event_end_date: string | null
          event_start_date: string | null
          event_title: string | null
          google_create_time: string | null
          google_post_name: string
          google_update_time: string | null
          id: string
          location_id: string
          media_urls: string[] | null
          meta: Json | null
          offer_coupon_code: string | null
          offer_redeem_url: string | null
          offer_terms: string | null
          org_id: string
          search_url: string | null
          state: string | null
          summary: string | null
          topic_type: string | null
          updated_at: string | null
        }
        Insert: {
          call_to_action_type?: string | null
          call_to_action_url?: string | null
          created_at?: string | null
          event_end_date?: string | null
          event_start_date?: string | null
          event_title?: string | null
          google_create_time?: string | null
          google_post_name: string
          google_update_time?: string | null
          id?: string
          location_id: string
          media_urls?: string[] | null
          meta?: Json | null
          offer_coupon_code?: string | null
          offer_redeem_url?: string | null
          offer_terms?: string | null
          org_id: string
          search_url?: string | null
          state?: string | null
          summary?: string | null
          topic_type?: string | null
          updated_at?: string | null
        }
        Update: {
          call_to_action_type?: string | null
          call_to_action_url?: string | null
          created_at?: string | null
          event_end_date?: string | null
          event_start_date?: string | null
          event_title?: string | null
          google_create_time?: string | null
          google_post_name?: string
          google_update_time?: string | null
          id?: string
          location_id?: string
          media_urls?: string[] | null
          meta?: Json | null
          offer_coupon_code?: string | null
          offer_redeem_url?: string | null
          offer_terms?: string | null
          org_id?: string
          search_url?: string | null
          state?: string | null
          summary?: string | null
          topic_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_posts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_qna: {
        Row: {
          answer: string | null
          created_at: string | null
          id: string
          location_id: string
          org_id: string
          question: string
          question_id: string
          state: string | null
          updated_at: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          id?: string
          location_id: string
          org_id: string
          question: string
          question_id: string
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          id?: string
          location_id?: string
          org_id?: string
          question?: string
          question_id?: string
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_qna_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_qna_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_reviews: {
        Row: {
          author: string | null
          created_at: string | null
          id: string
          location_id: string
          org_id: string
          rating: number | null
          reply: string | null
          review_id: string
          state: string | null
          text: string | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          id?: string
          location_id: string
          org_id: string
          rating?: number | null
          reply?: string | null
          review_id: string
          state?: string | null
          text?: string | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          id?: string
          location_id?: string
          org_id?: string
          rating?: number | null
          reply?: string | null
          review_id?: string
          state?: string | null
          text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      post_candidates: {
        Row: {
          created_at: string | null
          generation_id: string | null
          id: string
          images: string[] | null
          location_id: string
          org_id: string
          schema: Json
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          generation_id?: string | null
          id?: string
          images?: string[] | null
          location_id: string
          org_id: string
          schema: Json
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          generation_id?: string | null
          id?: string
          images?: string[] | null
          location_id?: string
          org_id?: string
          schema?: Json
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_candidates_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "ai_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_candidates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_candidates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_rules: {
        Row: {
          banned_terms: string[] | null
          blocked_categories: string[] | null
          created_at: string | null
          id: string
          org_id: string
          required_phrases: string[] | null
          updated_at: string | null
        }
        Insert: {
          banned_terms?: string[] | null
          blocked_categories?: string[] | null
          created_at?: string | null
          id?: string
          org_id: string
          required_phrases?: string[] | null
          updated_at?: string | null
        }
        Update: {
          banned_terms?: string[] | null
          blocked_categories?: string[] | null
          created_at?: string | null
          id?: string
          org_id?: string
          required_phrases?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          org_id: string
          provider_ref: string | null
          publish_at: string
          status: Database["public"]["Enums"]["schedule_status"] | null
          target_id: string
          target_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          org_id: string
          provider_ref?: string | null
          publish_at: string
          status?: Database["public"]["Enums"]["schedule_status"] | null
          target_id: string
          target_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          org_id?: string
          provider_ref?: string | null
          publish_at?: string
          status?: Database["public"]["Enums"]["schedule_status"] | null
          target_id?: string
          target_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gbp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      user_has_org_access: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      user_org_ids: {
        Args: Record<PropertyKey, never>
        Returns: {
          org_id: string
        }[]
      }
      user_org_role: {
        Args: { check_org_id: string }
        Returns: Database["public"]["Enums"]["org_member_role"]
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      automation_mode: "off" | "auto_create" | "autopilot"
      content_type: "post" | "qna" | "reply" | "image"
      generation_status: "pending" | "completed" | "failed" | "moderated"
      org_member_role: "owner" | "admin" | "editor" | "viewer"
      post_type: "WHATS_NEW" | "EVENT" | "OFFER"
      schedule_status: "pending" | "published" | "failed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      automation_mode: ["off", "auto_create", "autopilot"],
      content_type: ["post", "qna", "reply", "image"],
      generation_status: ["pending", "completed", "failed", "moderated"],
      org_member_role: ["owner", "admin", "editor", "viewer"],
      post_type: ["WHATS_NEW", "EVENT", "OFFER"],
      schedule_status: ["pending", "published", "failed", "cancelled"],
    },
  },
} as const

