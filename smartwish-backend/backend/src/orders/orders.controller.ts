import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderType, OrderStatus } from './order.entity';
import { PaymentSessionStatus } from './payment-session.entity';
import { TransactionStatus } from './transaction.entity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

// ✅ UUID validation helper
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {
    console.log('✅ OrdersController initialized');
  }

  /**
   * Create a new order
   */
  @Post()
  async createOrder(
    @Body() orderData: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('📦 Create Order Request:', {
        userId,
        cardId: orderData.cardId,
        orderType: orderData.orderType,
      });

      // Validate required fields
      if (!orderData.cardId || !orderData.orderType || !orderData.cardName || !orderData.totalAmount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // ✅ Validate UUID format
      if (!isValidUUID(orderData.cardId)) {
        return res.status(400).json({ error: 'Invalid card ID format' });
      }

      // ✅ Validate and parse numeric fields
      const cardPrice = parseFloat(orderData.cardPrice || '0');
      const giftCardAmount = parseFloat(orderData.giftCardAmount || '0');
      const processingFee = parseFloat(orderData.processingFee || '0');
      const totalAmount = parseFloat(orderData.totalAmount);

      // Check for NaN (invalid numbers)
      if (isNaN(cardPrice) || isNaN(giftCardAmount) || isNaN(processingFee) || isNaN(totalAmount)) {
        return res.status(400).json({ error: 'Invalid numeric values in order data' });
      }

      // Validate ranges
      if (cardPrice < 0 || giftCardAmount < 0 || processingFee < 0 || totalAmount < 0.01) {
        return res.status(400).json({ error: 'Invalid amounts: must be positive' });
      }

      const order = await this.ordersService.createOrder({
        userId,
        cardId: orderData.cardId,
        orderType: orderData.orderType as OrderType,
        cardName: orderData.cardName,
        recipientEmail: orderData.recipientEmail,
        cardPrice,
        giftCardAmount,
        processingFee,
        totalAmount,
        currency: orderData.currency || 'USD',
        giftCardProductName: orderData.giftCardProductName,
        giftCardRedemptionLink: orderData.giftCardRedemptionLink,
        metadata: orderData.metadata || {},
      });

      res.json({ success: true, order });
    } catch (error: any) {
      console.error('❌ Create Order Error:', error);
      res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  }

  /**
   * Create a payment session
   */
  @Post('/payment-sessions')
  async createPaymentSession(
    @Body() sessionData: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('💳 Create Payment Session Request:', {
        userId,
        orderId: sessionData.orderId,
      });

      // Validate required fields
      if (!sessionData.orderId || !sessionData.amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // ✅ Validate UUID format
      if (!isValidUUID(sessionData.orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      // ✅ Validate amount
      const amount = parseFloat(sessionData.amount);
      if (isNaN(amount) || amount < 0.01) {
        return res.status(400).json({ error: 'Invalid payment amount' });
      }

      const session = await this.ordersService.createPaymentSession({
        orderId: sessionData.orderId,
        userId,
        amount,
        currency: sessionData.currency || 'USD',
        stripePaymentIntentId: sessionData.stripePaymentIntentId,
        stripeClientSecret: sessionData.stripeClientSecret,
        initiatedFrom: sessionData.initiatedFrom,
        paymentMethod: sessionData.paymentMethod,
        sessionId: sessionData.sessionId,
        metadata: sessionData.metadata || {},
      });

      res.json({ success: true, session });
    } catch (error: any) {
      console.error('❌ Create Payment Session Error:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment session' });
    }
  }

  /**
   * Get payment session status
   */
  @Get('/payment-sessions/:sessionId')
  async getPaymentSession(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    try {
      console.log('🔍 Get Payment Session:', sessionId);

      const session = await this.ordersService.getPaymentSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Payment session not found' });
      }

      res.json({ success: true, session });
    } catch (error: any) {
      console.error('❌ Get Payment Session Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get payment session' });
    }
  }

  /**
   * Update payment session status
   */
  @Post('/payment-sessions/:sessionId/status')
  async updatePaymentSessionStatus(
    @Param('sessionId') sessionId: string,
    @Body() body: { status: string },
    @Res() res: Response,
  ) {
    try {
      console.log('🔄 Update Payment Session Status:', { sessionId, status: body.status });

      const session = await this.ordersService.updatePaymentSessionStatus(
        sessionId,
        body.status as PaymentSessionStatus,
      );

      res.json({ success: true, session });
    } catch (error: any) {
      console.error('❌ Update Payment Session Error:', error);
      res.status(500).json({ error: error.message || 'Failed to update payment session' });
    }
  }

  /**
   * Get transaction by Stripe Payment Intent ID (for webhook)
   * ✅ No auth required (webhook doesn't have JWT)
   */
  @Get('/transactions/by-stripe/:paymentIntentId')
  @UseGuards() // ✅ Override JWT guard for this endpoint
  async getTransactionByStripeIntent(
    @Param('paymentIntentId') paymentIntentId: string,
    @Res() res: Response,
  ) {
    try {
      console.log('🔍 Looking up transaction by Stripe intent:', paymentIntentId);
      
      const transaction = await this.ordersService.getTransactionByStripeId(paymentIntentId);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      res.json({ success: true, transaction });
    } catch (error: any) {
      console.error('❌ Get Transaction Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get transaction' });
    }
  }

  /**
   * Create a transaction from webhook (no auth required)
   * ✅ Used by Stripe webhook as backup when frontend fails
   */
  @Post('/transactions/webhook')
  @UseGuards() // ✅ Override JWT guard for this endpoint
  async createTransactionFromWebhook(
    @Body() txData: any,
    @Res() res: Response,
  ) {
    try {
      console.log('🔔 Create Transaction from Webhook:', {
        orderId: txData.orderId,
        userId: txData.userId,
        status: txData.status,
      });

      // Validate required fields
      if (!txData.orderId || !txData.userId || !txData.amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // ✅ Validate UUID formats
      if (!isValidUUID(txData.orderId) || !isValidUUID(txData.userId)) {
        return res.status(400).json({ error: 'Invalid UUID format' });
      }

      // ✅ Validate transaction amount
      const amount = parseFloat(txData.amount);
      if (isNaN(amount) || amount < 0.01) {
        return res.status(400).json({ error: 'Invalid transaction amount' });
      }

      // ✅ Check for duplicate transaction
      if (txData.stripePaymentIntentId) {
        const existingTx = await this.ordersService.getTransactionByStripeId(
          txData.stripePaymentIntentId
        );
        if (existingTx) {
          console.log('⚠️ Transaction already exists (frontend succeeded):', txData.stripePaymentIntentId);
          return res.json({ success: true, transaction: existingTx, duplicate: true });
        }
      }

      const transaction = await this.ordersService.createTransaction({
        orderId: txData.orderId,
        paymentSessionId: txData.paymentSessionId,
        userId: txData.userId, // ✅ From webhook metadata
        amount,
        currency: txData.currency || 'USD',
        stripePaymentIntentId: txData.stripePaymentIntentId,
        stripeChargeId: txData.stripeChargeId,
        status: txData.status as TransactionStatus,
        paymentMethodType: txData.paymentMethodType,
        cardLast4: txData.cardLast4,
        cardBrand: txData.cardBrand,
        failureCode: txData.failureCode,
        failureMessage: txData.failureMessage,
        metadata: txData.metadata || {},
      });
      
      // ✅ Also update order status to paid
      try {
        await this.ordersService.updateOrderStatus(txData.orderId, OrderStatus.PAID);
        console.log('✅ Order status updated to paid by webhook');
      } catch (error) {
        console.error('⚠️ Failed to update order status from webhook:', error);
        // Don't fail the transaction creation
      }

      res.json({ success: true, transaction, duplicate: false });
    } catch (error: any) {
      console.error('❌ Create Transaction from Webhook Error:', error);
      res.status(500).json({ error: error.message || 'Failed to create transaction' });
    }
  }

  /**
   * Create a transaction (authenticated)
   */
  @Post('/transactions')
  async createTransaction(
    @Body() txData: any,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('💰 Create Transaction Request:', {
        userId,
        orderId: txData.orderId,
        status: txData.status,
      });

      // Validate required fields
      if (!txData.orderId || !txData.amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // ✅ Validate UUID format
      if (!isValidUUID(txData.orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      // ✅ Validate transaction amount
      const amount = parseFloat(txData.amount);
      if (isNaN(amount) || amount < 0.01) {
        return res.status(400).json({ error: 'Invalid transaction amount' });
      }

      // ✅ FIX: Check for duplicate transaction (race condition protection)
      if (txData.stripePaymentIntentId) {
        const existingTx = await this.ordersService.getTransactionByStripeId(
          txData.stripePaymentIntentId
        );
        if (existingTx) {
          console.log('⚠️ Transaction already exists for payment intent:', txData.stripePaymentIntentId);
          return res.json({ success: true, transaction: existingTx, duplicate: true });
        }
      }

      const transaction = await this.ordersService.createTransaction({
        orderId: txData.orderId,
        paymentSessionId: txData.paymentSessionId,
        userId,
        amount,
        currency: txData.currency || 'USD',
        stripePaymentIntentId: txData.stripePaymentIntentId,
        stripeChargeId: txData.stripeChargeId,
        status: txData.status as TransactionStatus,
        paymentMethodType: txData.paymentMethodType,
        cardLast4: txData.cardLast4,
        cardBrand: txData.cardBrand,
        failureCode: txData.failureCode,
        failureMessage: txData.failureMessage,
        metadata: txData.metadata || {},
      });

      res.json({ success: true, transaction, duplicate: false });
    } catch (error: any) {
      console.error('❌ Create Transaction Error:', error);
      res.status(500).json({ error: error.message || 'Failed to create transaction' });
    }
  }

  /**
   * Get user's order history
   */
  @Get('/history')
  async getOrderHistory(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit: string,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('📜 Get Order History:', userId);

      const orders = await this.ordersService.getUserOrders(
        userId,
        parseInt(limit) || 50,
      );

      res.json({ success: true, orders });
    } catch (error: any) {
      console.error('❌ Get Order History Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get order history' });
    }
  }

  /**
   * Update order status
   */
  @Post('/:orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: { status: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('🔄 Update Order Status:', { orderId, status: body.status });

      // ✅ Validate UUID format
      if (!isValidUUID(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      // Verify user owns the order
      const order = await this.ordersService.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updatedOrder = await this.ordersService.updateOrderStatus(
        orderId,
        body.status as OrderStatus,
      );

      res.json({ success: true, order: updatedOrder });
    } catch (error: any) {
      console.error('❌ Update Order Status Error:', error);
      res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
  }

  /**
   * Get order by ID
   */
  @Get('/:orderId')
  async getOrder(
    @Param('orderId') orderId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('🔍 Get Order:', orderId);

      // ✅ Validate UUID format
      if (!isValidUUID(orderId)) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = await this.ordersService.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Verify user owns the order
      if (order.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json({ success: true, order });
    } catch (error: any) {
      console.error('❌ Get Order Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get order' });
    }
  }
}

