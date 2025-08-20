import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { qrCodeUtils } from '@/lib/utils/qrCodeUtils'
import { numberingUtils } from '@/lib/utils/numberingUtils'

interface CompleteProductionRequest {
  productionOrderId: string
  actualQuantity?: number | null
  completedBy?: string
  qualityNotes?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productionOrderId, actualQuantity: requestedQuantity, completedBy, qualityNotes } = req.body;

  if (!productionOrderId) {
    return res.status(400).json({ error: 'Production order ID is required' });
  }

  try {
    // Get production order details
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select(`
        *,
        customer_orders (
          id,
          internal_order_number,
          finished_fabric_id,
          customer_order_items (
            id,
            color,
            quantity_ordered
          )
        )
      `)
      .eq('id', productionOrderId)
      .single();

    if (orderError) {
      return res.status(500).json({ error: `Failed to get production order: ${orderError.message}` });
    }

    const fabricId = productionOrder?.finished_fabric_id;
    const fabricType = productionOrder?.production_type;
    const actualQuantity = requestedQuantity || productionOrder?.quantity_required || 0;

    // Generate batch number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const batchNumber = `${fabricType?.toUpperCase()}-${year}${month}${day}-${random}`;

    // Get customer color for production - prioritize from customer order items
    let customerColor = 'Natural'; // Default color
    let customerOrderItemId = null;
    
    if (productionOrder.customer_orders?.customer_order_items?.length > 0) {
      const orderItem = productionOrder.customer_orders.customer_order_items[0];
      customerColor = orderItem.color || 'Natural';
      customerOrderItemId = orderItem.id;
    }

    // Create production batch
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        production_order_id: productionOrderId,
        production_type: fabricType,
        planned_quantity: actualQuantity,
        actual_a_grade_quantity: actualQuantity,
        batch_status: 'completed',
        completed_at: new Date().toISOString(),
        notes: qualityNotes || 'Production completed successfully',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError) {
      return res.status(500).json({ error: `Failed to create batch: ${batchError.message}` });
    }

    let createdRolls = [];
    let qrCodesGenerated = 0;

    // Create fabric rolls based on production type
    if (fabricType === 'coating') {
      // Create individual finished fabric rolls
      const rollsToCreate = Math.ceil(actualQuantity / 50); // 50m per roll
      
      for (let i = 0; i < rollsToCreate; i++) {
        const rollLength = Math.min(50, actualQuantity - (i * 50));
        if (rollLength <= 0) break;

        const rollNumber = `${batchNumber}-R${String(i + 1).padStart(3, '0')}`;
        
        // Generate QR code data
        const qrData = {
          type: 'api_roll',
          rollId: '', // Will be set after roll creation
          apiUrl: '',
          qrGeneratedAt: new Date().toISOString(),
          status: 'available'
        };

        const { data: roll, error: rollError } = await supabase
          .from('fabric_rolls')
          .insert({
            roll_number: rollNumber,
            batch_id: batch.id,
            fabric_id: fabricId,
            fabric_type: 'finished_fabric',
            roll_length: rollLength,
            remaining_length: rollLength,
            roll_status: 'available',
            customer_color: customerColor,
            quality_grade: 'A', // Default to A grade for new production
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (rollError) {
          return res.status(500).json({ error: `Failed to create roll ${rollNumber}: ${rollError.message}` });
        }

        // Update QR code with roll ID
        const updatedQrData = {
          ...qrData,
          rollId: roll.id,
          apiUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/roll/${roll.id}`
        };

        const { error: qrUpdateError } = await supabase
          .from('fabric_rolls')
          .update({
            qr_code: JSON.stringify(updatedQrData)
          })
          .eq('id', roll.id);

        if (qrUpdateError) {
          return res.status(500).json({ error: `Failed to update QR code for roll ${roll.id}: ${qrUpdateError.message}` });
        }

        createdRolls.push(roll);
        qrCodesGenerated++;
      }

      // Update finished fabric stock
      const { data: finishedFabric } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity')
        .eq('id', fabricId)
        .single();

      const newFinishedStock = (finishedFabric?.stock_quantity || 0) + actualQuantity;
      
      const { error: finishedStockError } = await supabase
        .from('finished_fabrics')
        .update({
          stock_quantity: newFinishedStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fabricId);

      if (finishedStockError) {
        return res.status(500).json({ error: `Failed to update finished fabric stock: ${finishedStockError.message}` });
      }

    } else if (fabricType === 'weaving') {
      // For weaving, create loom rolls and corresponding base fabric rolls
      const rollsToCreate = Math.ceil(actualQuantity / 50); // 50m per roll
      
      for (let i = 0; i < rollsToCreate; i++) {
        const rollLength = Math.min(50, actualQuantity - (i * 50));
        if (rollLength <= 0) break;

        const rollNumber = `${batchNumber}-R${String(i + 1).padStart(3, '0')}`;
        
        // Create loom roll
        const { data: loomRoll, error: loomRollError } = await supabase
          .from('loom_rolls')
          .insert({
            roll_number: rollNumber,
            production_order_id: productionOrderId,
            roll_length: rollLength,
            roll_status: 'available',
            customer_color: customerColor,
            batch_id: batch.id,
            quality_grade: 'A', // Default to A grade for new production
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (loomRollError) {
          return res.status(500).json({ error: `Failed to create loom roll ${rollNumber}: ${loomRollError.message}` });
        }

        // Create corresponding base fabric roll with QR code
        const qrData = {
          type: 'api_roll',
          rollId: '', // Will be set after roll creation
          apiUrl: '',
          qrGeneratedAt: new Date().toISOString(),
          status: 'available'
        };

        const { data: baseFabricRoll, error: baseFabricRollError } = await supabase
          .from('fabric_rolls')
          .insert({
            roll_number: rollNumber,
            batch_id: batch.id,
            fabric_id: fabricId,
            fabric_type: 'base_fabric',
            roll_length: rollLength,
            remaining_length: rollLength,
            roll_status: 'available',
            customer_color: customerColor,
            quality_grade: 'A', // Default to A grade for new production
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (baseFabricRollError) {
          return res.status(500).json({ error: `Failed to create base fabric roll ${rollNumber}: ${baseFabricRollError.message}` });
        }

        // Update QR code with roll ID
        const updatedQrData = {
          ...qrData,
          rollId: baseFabricRoll.id,
          apiUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/roll/${baseFabricRoll.id}`
        };

        const { error: qrUpdateError } = await supabase
          .from('fabric_rolls')
          .update({
            qr_code: JSON.stringify(updatedQrData)
          })
          .eq('id', baseFabricRoll.id);

        if (qrUpdateError) {
          return res.status(500).json({ error: `Failed to update QR code for base fabric roll ${baseFabricRoll.id}: ${qrUpdateError.message}` });
        }

        createdRolls.push(baseFabricRoll);
        qrCodesGenerated++;
      }

      // Update base fabric stock
      const { data: baseFabric } = await supabase
        .from('base_fabrics')
        .select('stock_quantity')
        .eq('id', fabricId)
        .single();

      const newStock = (baseFabric?.stock_quantity || 0) + actualQuantity;
      
      const { error: stockError } = await supabase
        .from('base_fabrics')
        .update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fabricId);

      if (stockError) {
        return res.status(500).json({ error: `Failed to update base fabric stock: ${stockError.message}` });
      }
    }

    // Update production order status
    const { error: updateError } = await supabase
      .from('production_orders')
      .update({
        production_status: 'completed',
        quantity_produced: actualQuantity,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productionOrderId);

    if (updateError) {
      return res.status(500).json({ error: `Failed to update production order: ${updateError.message}` });
    }

    return res.status(200).json({
      success: true,
      productionType: fabricType,
      batchNumber: batch.batch_number,
      quantity: actualQuantity,
      rollsCreated: createdRolls.length,
      qrCodesGenerated: qrCodesGenerated,
      message: 'Production completed successfully'
    });

  } catch (error) {
    console.error('Production completion error:', error);
    return res.status(500).json({ error: `Internal server error: ${error}` });
  }
} 