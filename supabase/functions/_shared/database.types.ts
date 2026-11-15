export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  ai_razpisi: {
    Tables: {
      ai_assistant_calls: {
        Row: {
          caller_hash: string
          company_id: string | null
          created_at: string
          id: number
        }
        Insert: {
          caller_hash: string
          company_id?: string | null
          created_at?: string
          id?: never
        }
        Update: {
          caller_hash?: string
          company_id?: string | null
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          input_tokens: number
          output_tokens: number
          request_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          input_tokens?: number
          output_tokens?: number
          request_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          input_tokens?: number
          output_tokens?: number
          request_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          dm_free: number | null
          id: string
          interests: Json | null
          legal_form: string | null
          main_activity_code: string | null
          main_activity_name: string | null
          municipality: string | null
          region: string | null
          registration_number: string | null
          size_class: string | null
          skd_code: string | null
          skd_label: string | null
          source: string | null
          source_payload: Json | null
          tax_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          dm_free?: number | null
          id?: string
          interests?: Json | null
          legal_form?: string | null
          main_activity_code?: string | null
          main_activity_name?: string | null
          municipality?: string | null
          region?: string | null
          registration_number?: string | null
          size_class?: string | null
          skd_code?: string | null
          skd_label?: string | null
          source?: string | null
          source_payload?: Json | null
          tax_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          dm_free?: number | null
          id?: string
          interests?: Json | null
          legal_form?: string | null
          main_activity_code?: string | null
          main_activity_name?: string | null
          municipality?: string | null
          region?: string | null
          registration_number?: string | null
          size_class?: string | null
          skd_code?: string | null
          skd_label?: string | null
          source?: string | null
          source_payload?: Json | null
          tax_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      crawl_log: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          items_found: number | null
          items_inserted: number | null
          items_updated: number | null
          raw_log: Json | null
          source_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_found?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          raw_log?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_found?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          raw_log?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "grant_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      data_source_health: {
        Row: {
          failure_count: number | null
          id: string
          last_error: string | null
          last_failure: string | null
          last_success: string | null
          source: string
          updated_at: string
        }
        Insert: {
          failure_count?: number | null
          id?: string
          last_error?: string | null
          last_failure?: string | null
          last_success?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          failure_count?: number | null
          id?: string
          last_error?: string | null
          last_failure?: string | null
          last_success?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      de_minimis_records: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          granted_date: string
          id: string
          mssi_number: string | null
          programme: string | null
          provider: string | null
          source_payload: Json | null
          source_url: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          granted_date: string
          id?: string
          mssi_number?: string | null
          programme?: string | null
          provider?: string | null
          source_payload?: Json | null
          source_url?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          granted_date?: string
          id?: string
          mssi_number?: string | null
          programme?: string | null
          provider?: string | null
          source_payload?: Json | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "de_minimis_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_matches: {
        Row: {
          company_id: string | null
          cost_score: number | null
          created_at: string
          de_minimis_score: number | null
          grant_id: string | null
          id: string
          match_score: number | null
          match_status: string | null
          reason: string | null
          region_score: number | null
          risk_level: string | null
          score_breakdown: Json | null
          sector_score: number | null
          size_score: number | null
          updated_at: string
          warnings: string[] | null
        }
        Insert: {
          company_id?: string | null
          cost_score?: number | null
          created_at?: string
          de_minimis_score?: number | null
          grant_id?: string | null
          id?: string
          match_score?: number | null
          match_status?: string | null
          reason?: string | null
          region_score?: number | null
          risk_level?: string | null
          score_breakdown?: Json | null
          sector_score?: number | null
          size_score?: number | null
          updated_at?: string
          warnings?: string[] | null
        }
        Update: {
          company_id?: string | null
          cost_score?: number | null
          created_at?: string
          de_minimis_score?: number | null
          grant_id?: string | null
          id?: string
          match_score?: number | null
          match_status?: string | null
          reason?: string | null
          region_score?: number | null
          risk_level?: string | null
          score_breakdown?: Json | null
          sector_score?: number | null
          size_score?: number | null
          updated_at?: string
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_matches_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_sources: {
        Row: {
          active: boolean
          api_url: string | null
          base_url: string | null
          created_at: string
          id: string
          last_checked_at: string | null
          name: string
          notes: string | null
          source_type: string
        }
        Insert: {
          active?: boolean
          api_url?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          name: string
          notes?: string | null
          source_type: string
        }
        Update: {
          active?: boolean
          api_url?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          notes?: string | null
          source_type?: string
        }
        Relationships: []
      }
      grants: {
        Row: {
          created_at: string
          deadline_at: string | null
          eligibility: Json | null
          eligible_company_sizes: string[] | null
          eligible_costs: string[] | null
          eligible_regions: string[] | null
          eligible_sectors: string[] | null
          funding_rate: number | null
          id: string
          investment_types: string[] | null
          is_de_minimis: boolean | null
          last_checked_at: string | null
          max_aid_amount: number | null
          plain_language_summary: string | null
          provider: string | null
          published_at: string | null
          raw_payload: Json | null
          raw_summary: string | null
          required_documents: string[] | null
          requirements: string | null
          source_id: string | null
          source_url: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_at?: string | null
          eligibility?: Json | null
          eligible_company_sizes?: string[] | null
          eligible_costs?: string[] | null
          eligible_regions?: string[] | null
          eligible_sectors?: string[] | null
          funding_rate?: number | null
          id?: string
          investment_types?: string[] | null
          is_de_minimis?: boolean | null
          last_checked_at?: string | null
          max_aid_amount?: number | null
          plain_language_summary?: string | null
          provider?: string | null
          published_at?: string | null
          raw_payload?: Json | null
          raw_summary?: string | null
          required_documents?: string[] | null
          requirements?: string | null
          source_id?: string | null
          source_url: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_at?: string | null
          eligibility?: Json | null
          eligible_company_sizes?: string[] | null
          eligible_costs?: string[] | null
          eligible_regions?: string[] | null
          eligible_sectors?: string[] | null
          funding_rate?: number | null
          id?: string
          investment_types?: string[] | null
          is_de_minimis?: boolean | null
          last_checked_at?: string | null
          max_aid_amount?: number | null
          plain_language_summary?: string | null
          provider?: string | null
          published_at?: string | null
          raw_payload?: Json | null
          raw_summary?: string | null
          required_documents?: string[] | null
          requirements?: string | null
          source_id?: string | null
          source_url?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "grant_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_interest: {
        Row: {
          created_at: string
          id: string
          plan_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_name: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_name?: string
        }
        Relationships: []
      }
      prs_cache: {
        Row: {
          address: string | null
          company_name: string
          id: string
          imported_at: string
          legal_form: string | null
          main_activity_code: string | null
          main_activity_name: string | null
          municipality: string | null
          raw_payload: Json | null
          region: string | null
          registration_number: string
          source: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name: string
          id?: string
          imported_at?: string
          legal_form?: string | null
          main_activity_code?: string | null
          main_activity_name?: string | null
          municipality?: string | null
          raw_payload?: Json | null
          region?: string | null
          registration_number: string
          source?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          id?: string
          imported_at?: string
          legal_form?: string | null
          main_activity_code?: string | null
          main_activity_name?: string | null
          municipality?: string | null
          raw_payload?: Json | null
          region?: string | null
          registration_number?: string
          source?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      skd_lookup: {
        Row: {
          code: string
          created_at: string
          descriptor_en: string | null
          descriptor_sl: string
          level: number
          normalized_code: string
          parent_code: string | null
          section_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          descriptor_en?: string | null
          descriptor_sl: string
          level: number
          normalized_code: string
          parent_code?: string | null
          section_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          descriptor_en?: string | null
          descriptor_sl?: string
          level?: number
          normalized_code?: string
          parent_code?: string | null
          section_code?: string | null
          updated_at?: string
        }
        Relationships: []
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  ai_razpisi: {
    Enums: {},
  },
} as const
