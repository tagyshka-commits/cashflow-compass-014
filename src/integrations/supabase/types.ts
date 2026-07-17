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
      accounts: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          institution: string | null
          is_emergency: boolean
          is_liquid: boolean
          is_protected: boolean
          name: string
          notes: string | null
          storage_location: string | null
          type: Database["public"]["Enums"]["account_type"]
          unlock_condition: string | null
          unlock_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          is_emergency?: boolean
          is_liquid?: boolean
          is_protected?: boolean
          name: string
          notes?: string | null
          storage_location?: string | null
          type: Database["public"]["Enums"]["account_type"]
          unlock_condition?: string | null
          unlock_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          is_emergency?: boolean
          is_liquid?: boolean
          is_protected?: boolean
          name?: string
          notes?: string | null
          storage_location?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          unlock_condition?: string | null
          unlock_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["ai_role"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["ai_role"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["ai_role"]
          user_id?: string
        }
        Relationships: []
      }
      committed_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          name: string
          notes: string | null
          original_due_date: string | null
          paid_at: string | null
          recurrence: string | null
          status: Database["public"]["Enums"]["expense_status"]
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          original_due_date?: string | null
          paid_at?: string | null
          recurrence?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          original_due_date?: string | null
          paid_at?: string | null
          recurrence?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          id: string
          interest_rate: number | null
          monthly_payment: number | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          monthly_payment?: number | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          interest_rate?: number | null
          monthly_payment?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expected_incomes: {
        Row: {
          amount: number
          confidence: Database["public"]["Enums"]["income_confidence"]
          created_at: string
          currency: string
          expected_date: string | null
          id: string
          notes: string | null
          original_expected_date: string | null
          received: boolean
          received_at: string | null
          source: string
          status: Database["public"]["Enums"]["income_status"]
          user_id: string
        }
        Insert: {
          amount: number
          confidence?: Database["public"]["Enums"]["income_confidence"]
          created_at?: string
          currency?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          original_expected_date?: string | null
          received?: boolean
          received_at?: string | null
          source: string
          status?: Database["public"]["Enums"]["income_status"]
          user_id: string
        }
        Update: {
          amount?: number
          confidence?: Database["public"]["Enums"]["income_confidence"]
          created_at?: string
          currency?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          original_expected_date?: string | null
          received?: boolean
          received_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["income_status"]
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          currency: string
          current_amount: number
          icon: string | null
          id: string
          name: string
          notes: string | null
          priority: number
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_amount?: number
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          priority?: number
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_amount?: number
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          priority?: number
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          mode: Database["public"]["Enums"]["finance_mode"]
          personal_rates: Json
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          mode?: Database["public"]["Enums"]["finance_mode"]
          personal_rates?: Json
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["finance_mode"]
          personal_rates?: Json
          updated_at?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          expected_date: string | null
          id: string
          kind: string
          likelihood: number
          notes: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          expected_date?: string | null
          id?: string
          kind: string
          likelihood?: number
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          expected_date?: string | null
          id?: string
          kind?: string
          likelihood?: number
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          occurred_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          occurred_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type:
        | "cash"
        | "bank"
        | "card"
        | "crypto"
        | "investment"
        | "physical"
      ai_role: "user" | "assistant" | "system"
      debt_direction: "i_owe" | "owed_to_me"
      expense_status: "pending" | "paid" | "delayed" | "cancelled"
      finance_mode: "personal" | "family" | "business"
      income_confidence: "guaranteed" | "likely" | "possible"
      income_status:
        | "pending"
        | "received"
        | "delayed"
        | "converted"
        | "cancelled"
      transaction_kind: "income" | "expense" | "transfer"
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
      account_type: [
        "cash",
        "bank",
        "card",
        "crypto",
        "investment",
        "physical",
      ],
      ai_role: ["user", "assistant", "system"],
      debt_direction: ["i_owe", "owed_to_me"],
      expense_status: ["pending", "paid", "delayed", "cancelled"],
      finance_mode: ["personal", "family", "business"],
      income_confidence: ["guaranteed", "likely", "possible"],
      income_status: [
        "pending",
        "received",
        "delayed",
        "converted",
        "cancelled",
      ],
      transaction_kind: ["income", "expense", "transfer"],
    },
  },
} as const
