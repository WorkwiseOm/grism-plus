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
  public: {
    Tables: {
      access_reviews: {
        Row: {
          access_changes: Json
          completed_at: string | null
          created_at: string
          id: string
          review_period_end: string
          review_period_start: string
          reviewed_by: string
          tenant_id: string
          users_reviewed: number
        }
        Insert: {
          access_changes?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          review_period_end: string
          review_period_start: string
          reviewed_by: string
          tenant_id: string
          users_reviewed: number
        }
        Update: {
          access_changes?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          review_period_end?: string
          review_period_start?: string
          reviewed_by?: string
          tenant_id?: string
          users_reviewed?: number
        }
        Relationships: [
          {
            foreignKeyName: "access_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_date: string
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          deleted_at: string | null
          employee_id: string
          id: string
          raw_data: Json
          source_platform: string
          tenant_id: string
        }
        Insert: {
          assessment_date: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id: string
          id?: string
          raw_data: Json
          source_platform: string
          tenant_id: string
        }
        Update: {
          assessment_date?: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id?: string
          id?: string
          raw_data?: Json
          source_platform?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          classification:
            | Database["public"]["Enums"]["data_classification"]
            | null
          created_at: string
          entity_id: string
          entity_table: string
          id: number
          ip_address: unknown
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          classification?:
            | Database["public"]["Enums"]["data_classification"]
            | null
          created_at?: string
          entity_id: string
          entity_table: string
          id?: number
          ip_address?: unknown
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          classification?:
            | Database["public"]["Enums"]["data_classification"]
            | null
          created_at?: string
          entity_id?: string
          entity_table?: string
          id?: number
          ip_address?: unknown
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_briefs: {
        Row: {
          brief_markdown: string
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          deleted_at: string | null
          employee_id: string
          generated_for_date: string
          id: string
          manager_id: string
          reviewed_at: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          brief_markdown: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id: string
          generated_for_date: string
          id?: string
          manager_id: string
          reviewed_at?: string | null
          source: string
          tenant_id: string
        }
        Update: {
          brief_markdown?: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id?: string
          generated_for_date?: string
          id?: string
          manager_id?: string
          reviewed_at?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_briefs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_briefs_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_briefs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competencies: {
        Row: {
          category: Database["public"]["Enums"]["gap_category"]
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          framework_id: string
          id: string
          name: string
          parent_id: string | null
          proficiency_levels: Json
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["gap_category"]
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          framework_id: string
          id?: string
          name: string
          parent_id?: string | null
          proficiency_levels?: Json
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["gap_category"]
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          framework_id?: string
          id?: string
          name?: string
          parent_id?: string | null
          proficiency_levels?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencies_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "competency_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_frameworks: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "competency_frameworks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competency_scores: {
        Row: {
          assessment_id: string | null
          competency_id: string
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          deleted_at: string | null
          employee_id: string
          id: string
          score_0_100: number
          score_date: string
          source: string
          target_score_0_100: number | null
          tenant_id: string
        }
        Insert: {
          assessment_id?: string | null
          competency_id: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id: string
          id?: string
          score_0_100: number
          score_date: string
          source: string
          target_score_0_100?: number | null
          tenant_id: string
        }
        Update: {
          assessment_id?: string | null
          competency_id?: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id?: string
          id?: string
          score_0_100?: number
          score_date?: string
          source?: string
          target_score_0_100?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competency_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_scores_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_scores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      development_blend_policies: {
        Row: {
            id: string
            tenant_id: string
            scope: string
            gap_category: Database["public"]["Enums"]["gap_category"] | null
            competency_id: string | null
            experience_pct: number
            relationship_pct: number
            formal_pct: number
            rationale: string | null
            is_active: boolean
            created_by: string | null
            created_at: string
            updated_at: string
            deleted_at: string | null
        }
        Insert: {
            id?: string
            tenant_id: string
            scope: string
            gap_category?: Database["public"]["Enums"]["gap_category"] | null
            competency_id?: string | null
            experience_pct: number
            relationship_pct: number
            formal_pct: number
            rationale?: string | null
            is_active?: boolean
            created_by?: string | null
            created_at?: string
            updated_at?: string
            deleted_at?: string | null
        }
        Update: {
            id?: string
            tenant_id: string
            scope: string
            gap_category?: Database["public"]["Enums"]["gap_category"] | null
            competency_id?: string | null
            experience_pct: number
            relationship_pct: number
            formal_pct: number
            rationale?: string | null
            is_active?: boolean
            created_by?: string | null
            created_at?: string
            updated_at?: string
            deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_blend_policies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_blend_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_blend_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      elearning_catalogue: {
        Row: {
          competency_tags: string[]
          created_at: string
          deleted_at: string | null
          duration_minutes: number | null
          external_url: string | null
          id: string
          is_active: boolean
          provider: string
          scorm_endpoint: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          competency_tags?: string[]
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          id?: string
          is_active?: boolean
          provider: string
          scorm_endpoint?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          competency_tags?: string[]
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          external_url?: string | null
          id?: string
          is_active?: boolean
          provider?: string
          scorm_endpoint?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elearning_catalogue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      elearning_enrolments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          deleted_at: string | null
          employee_id: string
          enrolled_at: string
          id: string
          milestone_id: string | null
          score: number | null
          status: Database["public"]["Enums"]["elearning_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          enrolled_at?: string
          id?: string
          milestone_id?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["elearning_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          enrolled_at?: string
          id?: string
          milestone_id?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["elearning_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elearning_enrolments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "elearning_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elearning_enrolments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elearning_enrolments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "idp_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elearning_enrolments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          deleted_at: string | null
          department: string | null
          email: string
          employee_number: string
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          manager_id: string | null
          org_unit: string | null
          role_title: string
          target_role_title: string | null
          tenant_id: string
          updated_at: string
          user_profile_id: string | null
        }
        Insert: {
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          department?: string | null
          email: string
          employee_number: string
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          manager_id?: string | null
          org_unit?: string | null
          role_title: string
          target_role_title?: string | null
          tenant_id: string
          updated_at?: string
          user_profile_id?: string | null
        }
        Update: {
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          department?: string | null
          email?: string
          employee_number?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          manager_id?: string | null
          org_unit?: string | null
          role_title?: string
          target_role_title?: string | null
          tenant_id?: string
          updated_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_log: {
        Row: {
          ai_node: Database["public"]["Enums"]["ai_node"] | null
          context: Json | null
          created_at: string
          error_message: string
          id: number
          resolved: boolean
          stack_trace: string | null
          tenant_id: string | null
        }
        Insert: {
          ai_node?: Database["public"]["Enums"]["ai_node"] | null
          context?: Json | null
          created_at?: string
          error_message: string
          id?: number
          resolved?: boolean
          stack_trace?: string | null
          tenant_id?: string | null
        }
        Update: {
          ai_node?: Database["public"]["Enums"]["ai_node"] | null
          context?: Json | null
          created_at?: string
          error_message?: string
          id?: number
          resolved?: boolean
          stack_trace?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      idp_action_blend_allocations: {
        Row: {
            id: string
            tenant_id: string
            idp_action_id: string
            blend_category: Database["public"]["Enums"]["development_blend_category"]
            effort_weight: number
            classification_source: string
            created_at: string
            updated_at: string
            deleted_at: string | null
        }
        Insert: {
            id?: string
            tenant_id: string
            idp_action_id: string
            blend_category: Database["public"]["Enums"]["development_blend_category"]
            effort_weight?: number
            classification_source: string
            created_at?: string
            updated_at?: string
            deleted_at?: string | null
        }
        Update: {
            id?: string
            tenant_id: string
            idp_action_id: string
            blend_category: Database["public"]["Enums"]["development_blend_category"]
            effort_weight?: number
            classification_source: string
            created_at?: string
            updated_at?: string
            deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idp_action_blend_allocations_idp_action_id_fkey"
            columns: ["idp_action_id"]
            isOneToOne: false
            referencedRelation: "idp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_action_blend_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      idp_actions: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_ref_id: string | null
          external_ref_table: string | null
          id: string
          is_recommended_by_ai: boolean
          milestone_id: string
          modality: Database["public"]["Enums"]["modality_type"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_ref_id?: string | null
          external_ref_table?: string | null
          id?: string
          is_recommended_by_ai?: boolean
          milestone_id: string
          modality: Database["public"]["Enums"]["modality_type"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_ref_id?: string | null
          external_ref_table?: string | null
          id?: string
          is_recommended_by_ai?: boolean
          milestone_id?: string
          modality?: Database["public"]["Enums"]["modality_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idp_actions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "idp_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      idp_blend_snapshots: {
        Row: {
            id: string
            tenant_id: string
            idp_id: string
            policy_id: string | null
            experience_pct: number
            relationship_pct: number
            formal_pct: number
            calculation_method: string
            within_guardrail: boolean
            guardrail_notes: string | null
            created_by: string | null
            created_at: string
            deleted_at: string | null
        }
        Insert: {
            id?: string
            tenant_id: string
            idp_id: string
            policy_id?: string | null
            experience_pct: number
            relationship_pct: number
            formal_pct: number
            calculation_method: string
            within_guardrail?: boolean
            guardrail_notes?: string | null
            created_by?: string | null
            created_at?: string
            deleted_at?: string | null
        }
        Update: {
            id?: string
            tenant_id: string
            idp_id: string
            policy_id?: string | null
            experience_pct: number
            relationship_pct: number
            formal_pct: number
            calculation_method: string
            within_guardrail?: boolean
            guardrail_notes?: string | null
            created_by?: string | null
            created_at?: string
            deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idp_blend_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_blend_snapshots_idp_id_fkey"
            columns: ["idp_id"]
            isOneToOne: false
            referencedRelation: "idps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_blend_snapshots_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "development_blend_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_blend_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      idp_milestones: {
        Row: {
          competency_id: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          gap_score_at_creation: number
          id: string
          idp_id: string
          sequence_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          target_date: string
          title: string
          updated_at: string
        }
        Insert: {
          competency_id: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          gap_score_at_creation: number
          id?: string
          idp_id: string
          sequence_order: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date: string
          title: string
          updated_at?: string
        }
        Update: {
          competency_id?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          gap_score_at_creation?: number
          id?: string
          idp_id?: string
          sequence_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idp_milestones_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_milestones_idp_id_fkey"
            columns: ["idp_id"]
            isOneToOne: false
            referencedRelation: "idps"
            referencedColumns: ["id"]
          },
        ]
      }
      idps: {
        Row: {
          ai_generation_metadata: Json | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          deleted_at: string | null
          employee_id: string
          generated_by_ai: boolean
          id: string
          last_activity_at: string | null
          narrative: string | null
          narrative_source: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["idp_status"]
          target_completion_date: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_generation_metadata?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id: string
          generated_by_ai?: boolean
          id?: string
          last_activity_at?: string | null
          narrative?: string | null
          narrative_source?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["idp_status"]
          target_completion_date?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_generation_metadata?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          employee_id?: string
          generated_by_ai?: boolean
          id?: string
          last_activity_at?: string | null
          narrative?: string | null
          narrative_source?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["idp_status"]
          target_completion_date?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "idps_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nudges_sent: {
        Row: {
          body: string
          failure_reason: string | null
          id: string
          nudge_type: Database["public"]["Enums"]["nudge_type"]
          queued_at: string
          recipient_user_id: string
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["nudge_status"]
          subject: string
          tenant_id: string
          trigger_reference: Json | null
        }
        Insert: {
          body: string
          failure_reason?: string | null
          id?: string
          nudge_type: Database["public"]["Enums"]["nudge_type"]
          queued_at?: string
          recipient_user_id: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["nudge_status"]
          subject: string
          tenant_id: string
          trigger_reference?: Json | null
        }
        Update: {
          body?: string
          failure_reason?: string | null
          id?: string
          nudge_type?: Database["public"]["Enums"]["nudge_type"]
          queued_at?: string
          recipient_user_id?: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["nudge_status"]
          subject?: string
          tenant_id?: string
          trigger_reference?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "nudges_sent_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_sent_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ojt_assignments: {
        Row: {
          ai_recommendation_reasoning: string | null
          assigned_at: string
          assigned_by: string
          created_at: string
          deleted_at: string | null
          due_date: string
          employee_id: string
          id: string
          milestone_id: string | null
          ojt_catalogue_id: string
          status: Database["public"]["Enums"]["ojt_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_recommendation_reasoning?: string | null
          assigned_at?: string
          assigned_by: string
          created_at?: string
          deleted_at?: string | null
          due_date: string
          employee_id: string
          id?: string
          milestone_id?: string | null
          ojt_catalogue_id: string
          status?: Database["public"]["Enums"]["ojt_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_recommendation_reasoning?: string | null
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          employee_id?: string
          id?: string
          milestone_id?: string | null
          ojt_catalogue_id?: string
          status?: Database["public"]["Enums"]["ojt_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ojt_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ojt_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ojt_assignments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "idp_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ojt_assignments_ojt_catalogue_id_fkey"
            columns: ["ojt_catalogue_id"]
            isOneToOne: false
            referencedRelation: "ojt_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ojt_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ojt_catalogue: {
        Row: {
          competency_tags: string[]
          created_at: string
          deleted_at: string | null
          deliverable_type: string | null
          description: string
          effort_hours: number
          embedding: string | null
          id: string
          is_active: boolean
          observation_checklist: Json
          role_levels: string[]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          competency_tags?: string[]
          created_at?: string
          deleted_at?: string | null
          deliverable_type?: string | null
          description: string
          effort_hours: number
          embedding?: string | null
          id?: string
          is_active?: boolean
          observation_checklist?: Json
          role_levels?: string[]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          competency_tags?: string[]
          created_at?: string
          deleted_at?: string | null
          deliverable_type?: string | null
          description?: string
          effort_hours?: number
          embedding?: string | null
          id?: string
          is_active?: boolean
          observation_checklist?: Json
          role_levels?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ojt_catalogue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ojt_evidence: {
        Row: {
          artifact_urls: string[] | null
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          deleted_at: string | null
          id: string
          observation_checklist_responses: Json | null
          ojt_assignment_id: string
          self_reflection: string
          submitted_at: string
          submitted_by: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string | null
        }
        Insert: {
          artifact_urls?: string[] | null
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          id?: string
          observation_checklist_responses?: Json | null
          ojt_assignment_id: string
          self_reflection: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
        }
        Update: {
          artifact_urls?: string[] | null
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          deleted_at?: string | null
          id?: string
          observation_checklist_responses?: Json | null
          ojt_assignment_id?: string
          self_reflection?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ojt_evidence_ojt_assignment_id_fkey"
            columns: ["ojt_assignment_id"]
            isOneToOne: false
            referencedRelation: "ojt_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ojt_evidence_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ojt_evidence_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          applies_after: string
          created_at: string
          entity_table: string
          id: string
          is_active: boolean
          justification: string
          retention_days: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applies_after: string
          created_at?: string
          entity_table: string
          id?: string
          is_active?: boolean
          justification: string
          retention_days: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applies_after?: string
          created_at?: string
          entity_table?: string
          id?: string
          is_active?: boolean
          justification?: string
          retention_days?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: number
          ip_address: unknown
          metadata: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: number
          ip_address?: unknown
          metadata?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: number
          ip_address?: unknown
          metadata?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_progression_events: {
        Row: {
            id: string
            tenant_id: string
            employee_id: string
            competency_id: string
            signal_source: Database["public"]["Enums"]["progression_signal_source"]
            source_table: string
            source_id: string
            signal_date: string
            score_0_100: number | null
            proficiency_delta: number | null
            confidence_0_100: number | null
            weight_applied: number | null
            summary: string | null
            created_by: string | null
            data_classification: Database["public"]["Enums"]["data_classification"]
            created_at: string
            deleted_at: string | null
        }
        Insert: {
            id?: string
            tenant_id: string
            employee_id: string
            competency_id: string
            signal_source: Database["public"]["Enums"]["progression_signal_source"]
            source_table: string
            source_id: string
            signal_date: string
            score_0_100?: number | null
            proficiency_delta?: number | null
            confidence_0_100?: number | null
            weight_applied?: number | null
            summary?: string | null
            created_by?: string | null
            data_classification?: Database["public"]["Enums"]["data_classification"]
            created_at?: string
            deleted_at?: string | null
        }
        Update: {
            id?: string
            tenant_id: string
            employee_id: string
            competency_id: string
            signal_source: Database["public"]["Enums"]["progression_signal_source"]
            source_table: string
            source_id: string
            signal_date: string
            score_0_100?: number | null
            proficiency_delta?: number | null
            confidence_0_100?: number | null
            weight_applied?: number | null
            summary?: string | null
            created_by?: string | null
            data_classification?: Database["public"]["Enums"]["data_classification"]
            created_at?: string
            deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_progression_events_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_progression_rules: {
        Row: {
            id: string
            tenant_id: string
            scope: string
            gap_category: Database["public"]["Enums"]["gap_category"] | null
            competency_id: string | null
            assessment_weight: number
            ojt_weight: number
            coaching_weight: number
            elearning_weight: number
            min_distinct_sources: number
            max_single_source_contribution: number
            rationale: string | null
            is_active: boolean
            created_by: string | null
            created_at: string
            updated_at: string
            deleted_at: string | null
        }
        Insert: {
            id?: string
            tenant_id: string
            scope: string
            gap_category?: Database["public"]["Enums"]["gap_category"] | null
            competency_id?: string | null
            assessment_weight: number
            ojt_weight: number
            coaching_weight: number
            elearning_weight: number
            min_distinct_sources?: number
            max_single_source_contribution?: number
            rationale?: string | null
            is_active?: boolean
            created_by?: string | null
            created_at?: string
            updated_at?: string
            deleted_at?: string | null
        }
        Update: {
            id?: string
            tenant_id: string
            scope: string
            gap_category?: Database["public"]["Enums"]["gap_category"] | null
            competency_id?: string | null
            assessment_weight: number
            ojt_weight: number
            coaching_weight: number
            elearning_weight: number
            min_distinct_sources?: number
            max_single_source_contribution?: number
            rationale?: string | null
            is_active?: boolean
            created_by?: string | null
            created_at?: string
            updated_at?: string
            deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_progression_rules_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_progression_rollups: {
        Row: {
            id: string
            tenant_id: string
            employee_id: string
            competency_id: string
            current_score_0_100: number | null
            target_score_0_100: number | null
            convergence_status: Database["public"]["Enums"]["progression_convergence_status"]
            distinct_signal_sources: number
            contributing_sources: Database["public"]["Enums"]["progression_signal_source"][]
            last_signal_at: string | null
            calculated_at: string
            deleted_at: string | null
        }
        Insert: {
            id?: string
            tenant_id: string
            employee_id: string
            competency_id: string
            current_score_0_100?: number | null
            target_score_0_100?: number | null
            convergence_status?: Database["public"]["Enums"]["progression_convergence_status"]
            distinct_signal_sources?: number
            contributing_sources?: Database["public"]["Enums"]["progression_signal_source"][]
            last_signal_at?: string | null
            calculated_at?: string
            deleted_at?: string | null
        }
        Update: {
            id?: string
            tenant_id: string
            employee_id: string
            competency_id: string
            current_score_0_100?: number | null
            target_score_0_100?: number | null
            convergence_status?: Database["public"]["Enums"]["progression_convergence_status"]
            distinct_signal_sources?: number
            contributing_sources?: Database["public"]["Enums"]["progression_signal_source"][]
            last_signal_at?: string | null
            calculated_at?: string
            deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_progression_rollups_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_rollups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_progression_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }

      subprocessors: {
        Row: {
          added_at: string
          data_categories: string[]
          dpa_url: string | null
          gdpr_status: string | null
          id: string
          is_active: boolean
          location: string
          name: string
          purpose: string
          reviewed_at: string | null
          soc2_status: string | null
        }
        Insert: {
          added_at?: string
          data_categories: string[]
          dpa_url?: string | null
          gdpr_status?: string | null
          id?: string
          is_active?: boolean
          location: string
          name: string
          purpose: string
          reviewed_at?: string | null
          soc2_status?: string | null
        }
        Update: {
          added_at?: string
          data_categories?: string[]
          dpa_url?: string | null
          gdpr_status?: string | null
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          purpose?: string
          reviewed_at?: string | null
          soc2_status?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          idle_timeout_minutes: number
          is_active: boolean
          mfa_required_roles: Database["public"]["Enums"]["user_role"][]
          name: string
          session_timeout_minutes: number
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          idle_timeout_minutes?: number
          is_active?: boolean
          mfa_required_roles?: Database["public"]["Enums"]["user_role"][]
          name: string
          session_timeout_minutes?: number
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          idle_timeout_minutes?: number
          is_active?: boolean
          mfa_required_roles?: Database["public"]["Enums"]["user_role"][]
          name?: string
          session_timeout_minutes?: number
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          mfa_enrolled: boolean
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          mfa_enrolled?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          mfa_enrolled?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_employee_id: { Args: never; Returns: string }
      current_role_is: {
        Args: { target: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      current_tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      ai_node:
        | "idp_generation"
        | "modality_recommender"
        | "ojt_recommender"
        | "coaching_brief"
      data_classification: "public" | "internal" | "confidential" | "restricted"
      development_blend_category: "experience" | "relationship" | "formal"

      elearning_status: "enrolled" | "in_progress" | "completed" | "abandoned"
      gap_category: "knowledge" | "behavioural" | "technical"
      idp_status:
        | "draft"
        | "pending_approval"
        | "active"
        | "completed"
        | "archived"
        | "stalled"
      milestone_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "blocked"
        | "skipped"
      modality_type: "elearning" | "ojt" | "coaching" | "ilt" | "workshop"
      nudge_status: "queued" | "sent" | "failed" | "deferred"
      nudge_type:
        | "milestone_due"
        | "ojt_overdue"
        | "idp_stalled"
        | "approval_required"
        | "weekly_digest"
      ojt_status:
        | "assigned"
        | "in_progress"
        | "evidence_submitted"
        | "validated"
        | "rejected"
      progression_convergence_status: "insufficient" | "emerging" | "ready_for_review" | "advanced"
      progression_signal_source: "assessment" | "ojt_manager_feedback" | "coaching_feedback" | "elearning_completion"

      security_event_type:
        | "login_success"
        | "login_failure"
        | "logout"
        | "password_reset_requested"
        | "password_reset_completed"
        | "mfa_enrolled"
        | "mfa_challenge_success"
        | "mfa_challenge_failure"
        | "session_expired"
        | "session_revoked"
        | "role_changed"
        | "tenant_changed"
        | "export_requested"
        | "export_completed"
        | "deletion_requested"
        | "deletion_completed"
        | "rls_denial"
        | "admin_impersonation"
      user_role: "employee" | "manager" | "ld_admin" | "coach" | "superadmin"
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
  public: {
    Enums: {
      ai_node: [
        "idp_generation",
        "modality_recommender",
        "ojt_recommender",
        "coaching_brief",
      ],
      data_classification: ["public", "internal", "confidential", "restricted"],
      elearning_status: ["enrolled", "in_progress", "completed", "abandoned"],
      gap_category: ["knowledge", "behavioural", "technical"],
      idp_status: [
        "draft",
        "pending_approval",
        "active",
        "completed",
        "archived",
        "stalled",
      ],
      milestone_status: [
        "not_started",
        "in_progress",
        "completed",
        "blocked",
        "skipped",
      ],
      modality_type: ["elearning", "ojt", "coaching", "ilt", "workshop"],
      nudge_status: ["queued", "sent", "failed", "deferred"],
      nudge_type: [
        "milestone_due",
        "ojt_overdue",
        "idp_stalled",
        "approval_required",
        "weekly_digest",
      ],
      ojt_status: [
        "assigned",
        "in_progress",
        "evidence_submitted",
        "validated",
        "rejected",
      ],
      security_event_type: [
        "login_success",
        "login_failure",
        "logout",
        "password_reset_requested",
        "password_reset_completed",
        "mfa_enrolled",
        "mfa_challenge_success",
        "mfa_challenge_failure",
        "session_expired",
        "session_revoked",
        "role_changed",
        "tenant_changed",
        "export_requested",
        "export_completed",
        "deletion_requested",
        "deletion_completed",
        "rls_denial",
        "admin_impersonation",
      ],
      user_role: ["employee", "manager", "ld_admin", "coach", "superadmin"],
    },
  },
} as const
