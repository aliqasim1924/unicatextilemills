export interface Database {
  public: {
    Tables: {
      production_orders: {
        Row: {
          id: string
          internal_order_number: string | null
          production_type: string
          customer_order_id: string | null
          base_fabric_id: string | null
          finished_fabric_id: string | null
          quantity_required: number
          quantity_produced: number
          production_status: string | null
          priority_level: number | null
          production_sequence: number | null
          linked_production_order_id: string | null
          notes: string | null
          customer_color: string | null
          customer_order_item_id: string | null
          target_completion_date: string | null
          actual_start_date: string | null
          actual_end_date: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          internal_order_number?: string | null
          production_type: string
          customer_order_id?: string | null
          base_fabric_id?: string | null
          finished_fabric_id?: string | null
          quantity_required: number
          quantity_produced?: number
          production_status?: string | null
          priority_level?: number | null
          production_sequence?: number | null
          linked_production_order_id?: string | null
          notes?: string | null
          customer_color?: string | null
          customer_order_item_id?: string | null
          target_completion_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          internal_order_number?: string | null
          production_type?: string
          customer_order_id?: string | null
          base_fabric_id?: string | null
          finished_fabric_id?: string | null
          quantity_required?: number
          quantity_produced?: number
          production_status?: string | null
          priority_level?: number | null
          production_sequence?: number | null
          linked_production_order_id?: string | null
          notes?: string | null
          customer_color?: string | null
          customer_order_item_id?: string | null
          target_completion_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      fabric_rolls: {
        Row: {
          id: string
          roll_number: string
          fabric_id: string
          fabric_type: string
          roll_length: number
          remaining_length: number
          roll_status: string | null
          quality_grade: string | null
          customer_color: string | null
          customer_order_item_id: string | null
          batch_id: string | null
          qr_code: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          roll_number: string
          fabric_id: string
          fabric_type: string
          roll_length: number
          remaining_length?: number
          roll_status?: string | null
          quality_grade?: string | null
          customer_color?: string | null
          customer_order_item_id?: string | null
          batch_id?: string | null
          qr_code?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          roll_number?: string
          fabric_id?: string
          fabric_type?: string
          roll_length?: number
          remaining_length?: number
          roll_status?: string | null
          quality_grade?: string | null
          customer_color?: string | null
          customer_order_item_id?: string | null
          batch_id?: string | null
          qr_code?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      finished_fabrics: {
        Row: {
          id: string
          name: string
          base_fabric_id: string | null
          gsm: number
          width_meters: number
          color: string | null
          coating_type: string | null
          stock_quantity: number | null
          minimum_stock: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          base_fabric_id?: string | null
          gsm: number
          width_meters: number
          color?: string | null
          coating_type?: string | null
          stock_quantity?: number | null
          minimum_stock?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          base_fabric_id?: string | null
          gsm?: number
          width_meters?: number
          color?: string | null
          coating_type?: string | null
          stock_quantity?: number | null
          minimum_stock?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      base_fabrics: {
        Row: {
          id: string
          name: string
          gsm: number
          width_meters: number
          color: string | null
          stock_quantity: number | null
          minimum_stock: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          gsm: number
          width_meters: number
          color?: string | null
          stock_quantity?: number | null
          minimum_stock?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          gsm?: number
          width_meters?: number
          color?: string | null
          stock_quantity?: number | null
          minimum_stock?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
  }
}

export type ProductionOrder = Database['public']['Tables']['production_orders']['Row']
export type FabricRoll = Database['public']['Tables']['fabric_rolls']['Row']
export type FinishedFabric = Database['public']['Tables']['finished_fabrics']['Row']
export type BaseFabric = Database['public']['Tables']['base_fabrics']['Row'] 
