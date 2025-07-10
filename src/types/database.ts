export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          email: string | null
          phone: string | null
          address: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
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
      customer_orders: {
        Row: {
          id: string
          internal_order_number: string
          customer_po_number: string | null
          customer_id: string | null
          finished_fabric_id: string | null
          quantity_ordered: number
          quantity_allocated: number | null
          due_date: string
          order_status: string | null
          priority_override: number | null
          notes: string | null
          invoice_number: string | null
          gate_pass_number: string | null
          delivery_note_number: string | null
          dispatch_date: string | null
          dispatch_notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          internal_order_number: string
          customer_po_number?: string | null
          customer_id?: string | null
          finished_fabric_id?: string | null
          quantity_ordered: number
          quantity_allocated?: number | null
          due_date: string
          order_status?: string | null
          priority_override?: number | null
          notes?: string | null
          invoice_number?: string | null
          gate_pass_number?: string | null
          delivery_note_number?: string | null
          dispatch_date?: string | null
          dispatch_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          internal_order_number?: string
          customer_po_number?: string | null
          customer_id?: string | null
          finished_fabric_id?: string | null
          quantity_ordered?: number
          quantity_allocated?: number | null
          due_date?: string
          order_status?: string | null
          priority_override?: number | null
          notes?: string | null
          invoice_number?: string | null
          gate_pass_number?: string | null
          delivery_note_number?: string | null
          dispatch_date?: string | null
          dispatch_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      production_orders: {
        Row: {
          id: string
          internal_order_number: string
          production_type: string
          customer_order_id: string | null
          base_fabric_id: string | null
          finished_fabric_id: string | null
          quantity_required: number
          quantity_produced: number | null
          waste_factor: number | null
          planned_start_date: string | null
          planned_end_date: string | null
          target_completion_date: string | null
          actual_start_date: string | null
          actual_end_date: string | null
          production_status: string | null
          priority_level: number | null
          production_sequence: number | null
          delay_reason: string | null
          linked_production_order_id: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          internal_order_number: string
          production_type: string
          customer_order_id?: string | null
          base_fabric_id?: string | null
          finished_fabric_id?: string | null
          quantity_required: number
          quantity_produced?: number | null
          waste_factor?: number | null
          planned_start_date?: string | null
          planned_end_date?: string | null
          target_completion_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          production_status?: string | null
          priority_level?: number | null
          production_sequence?: number | null
          delay_reason?: string | null
          linked_production_order_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          internal_order_number?: string
          production_type?: string
          customer_order_id?: string | null
          base_fabric_id?: string | null
          finished_fabric_id?: string | null
          quantity_required?: number
          quantity_produced?: number | null
          waste_factor?: number | null
          planned_start_date?: string | null
          planned_end_date?: string | null
          target_completion_date?: string | null
          actual_start_date?: string | null
          actual_end_date?: string | null
          production_status?: string | null
          priority_level?: number | null
          production_sequence?: number | null
          delay_reason?: string | null
          linked_production_order_id?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      stock_movements: {
        Row: {
          id: string
          fabric_type: string
          fabric_id: string
          movement_type: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          fabric_type: string
          fabric_id: string
          movement_type: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          fabric_type?: string
          fabric_id?: string
          movement_type?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          notes?: string | null
          created_at?: string | null
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
  }
}

// Additional types for the application
export type Customer = Database['public']['Tables']['customers']['Row']
export type BaseFabric = Database['public']['Tables']['base_fabrics']['Row']
export type FinishedFabric = Database['public']['Tables']['finished_fabrics']['Row']
export type CustomerOrder = Database['public']['Tables']['customer_orders']['Row']
export type ProductionOrder = Database['public']['Tables']['production_orders']['Row']
export type StockMovement = Database['public']['Tables']['stock_movements']['Row']

// Enums for consistent values
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PARTIALLY_ALLOCATED = 'partially_allocated',
  FULLY_ALLOCATED = 'fully_allocated',
  IN_PRODUCTION = 'in_production',
  PRODUCTION_COMPLETE = 'production_complete',
  READY_FOR_DISPATCH = 'ready_for_dispatch',
  DISPATCHED = 'dispatched',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ProductionStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  QUALITY_CHECK = 'quality_check',
  READY = 'ready',
  COMPLETED = 'completed'
}

export enum MovementType {
  RECEIPT = 'receipt',
  ISSUE = 'issue',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer'
}

export enum FabricType {
  BASE_FABRIC = 'base_fabric',
  FINISHED_FABRIC = 'finished_fabric',
  YARN = 'yarn',
  CHEMICAL = 'chemical'
}

// Audit Trail Interfaces
export interface CustomerOrderAudit {
  id: string
  customer_order_id: string
  action_type: string
  field_changed?: string | null
  old_value?: string | null
  new_value?: string | null
  change_description: string
  changed_by: string
  change_reason?: string | null
  created_at: string
}

export interface ProductionOrderAudit {
  id: string
  production_order_id: string
  action_type: string
  field_changed?: string | null
  old_value?: string | null
  new_value?: string | null
  change_description: string
  changed_by: string
  change_reason?: string | null
  created_at: string
} 