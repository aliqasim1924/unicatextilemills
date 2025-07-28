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

  const { productionOrderId, requestedQuantity, completedBy } = req.body;

  if (!productionOrderId) {
    return res.status(400).json({ error: 'Production order ID is required' });
  }

  try {
    // Get production order details
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select('*')
      .eq('id', productionOrderId)
      .single();

    if (orderError) {
      return res.status(500).json({ error: `Failed to get production order: ${orderError.message}` });
    }

    const fabricId = productionOrder?.finished_fabric_id;
    const fabricType = productionOrder?.production_type;
    const actualQuantity = requestedQuantity || productionOrder?.quantity || 0;

    // Generate batch number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const batchNumber = `${fabricType?.toUpperCase()}-${year}${month}${day}-${random}`;

    // Get customer color for production
    const customerOrderItemId = productionOrder.customer_order_item_id;
    const { data: customerOrderItem } = await supabase
      .from('customer_order_items')
      .select('customer_color')
      .eq('id', customerOrderItemId)
      .single();

    const customerColor = customerOrderItem?.customer_color || 'default';

    // Create production batch
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        production_order_id: productionOrderId,
        production_type: fabricType,
        quantity_produced: actualQuantity,
        customer_color: customerColor,
        status: 'completed',
        completed_by: completedBy,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError) {
      return res.status(500).json({ error: `Failed to create batch: ${batchError.message}` });
    }

    // Create fabric rolls based on production type
    if (fabricType === 'coating') {
      // Create individual finished fabric rolls
      const rollsToCreate = Math.ceil(actualQuantity / 50); // 50m per roll
      const createdRolls = [];

      for (let i = 0; i < rollsToCreate; i++) {
        const rollLength = Math.min(50, actualQuantity - (i * 50));
        if (rollLength <= 0) break;

        const rollNumber = `${batchNumber}-A${actualQuantity}-R${String(i + 1).padStart(3, '0')}`;
        
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
            fabric_id: fabricId,
            fabric_type: 'finished_fabric',
            roll_length: rollLength,
            remaining_length: rollLength,
            roll_status: 'available',
            customer_color: customerColor,
            batch_id: batch.id,
            qr_code: JSON.stringify(qrData),
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
          apiUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://unicatextilemills.netlify.app'}/roll/${roll.id}`
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

        const rollNumber = `${batchNumber}-A${actualQuantity}-R${String(i + 1).padStart(3, '0')}`;
        
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
            fabric_id: fabricId,
            fabric_type: 'base_fabric',
            roll_length: rollLength,
            remaining_length: rollLength,
            roll_status: 'available',
            customer_color: customerColor,
            batch_id: batch.id,
            qr_code: JSON.stringify(qrData),
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
          apiUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://unicatextilemills.netlify.app'}/roll/${baseFabricRoll.id}`
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
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productionOrderId);

    if (updateError) {
      return res.status(500).json({ error: `Failed to update production order: ${updateError.message}` });
    }

    return res.status(200).json({
      success: true,
      batch: batch,
      message: 'Production completed successfully'
    });

  } catch (error) {
    return res.status(500).json({ error: `Internal server error: ${error}` });
  }
} 