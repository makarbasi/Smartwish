import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderType, OrderStatus } from './order.entity';
import { PaymentSession, PaymentSessionStatus } from './payment-session.entity';
import { Transaction, TransactionStatus } from './transaction.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(PaymentSession)
    private paymentSessionsRepository: Repository<PaymentSession>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
  ) {
    console.log('✅ OrdersService initialized');
  }

  /**
   * Create a new order
   */
  async createOrder(data: {
    userId: string;
    cardId: string;
    orderType: OrderType;
    cardName: string;
    recipientEmail?: string;
    cardPrice: number;
    giftCardAmount: number;
    processingFee: number;
    totalAmount: number;
    currency?: string;
    giftCardProductName?: string;
    giftCardRedemptionLink?: string;
    metadata?: Record<string, any>;
  }): Promise<Order> {
    console.log('📦 Creating order:', { userId: data.userId, cardId: data.cardId, total: data.totalAmount });

    const order = this.ordersRepository.create({
      userId: data.userId,
      cardId: data.cardId,
      orderType: data.orderType,
      cardName: data.cardName,
      recipientEmail: data.recipientEmail,
      cardPrice: data.cardPrice,
      giftCardAmount: data.giftCardAmount,
      processingFee: data.processingFee,
      totalAmount: data.totalAmount,
      currency: data.currency || 'USD',
      giftCardProductName: data.giftCardProductName,
      giftCardRedemptionLink: data.giftCardRedemptionLink,
      status: OrderStatus.PENDING,
      metadata: data.metadata || {},
    });

    const savedOrder = await this.ordersRepository.save(order);
    console.log('✅ Order created:', savedOrder.id);
    return savedOrder;
  }

  /**
   * Create a payment session
   */
  async createPaymentSession(data: {
    orderId: string;
    userId: string;
    amount: number;
    currency?: string;
    stripePaymentIntentId?: string;
    stripeClientSecret?: string;
    initiatedFrom?: string;
    paymentMethod?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentSession> {
    console.log('💳 Creating payment session for order:', data.orderId);

    // Generate session ID if not provided
    const sessionId = data.sessionId || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const session = this.paymentSessionsRepository.create({
      id: sessionId,
      orderId: data.orderId,
      userId: data.userId,
      amount: data.amount,
      currency: data.currency || 'USD',
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeClientSecret: data.stripeClientSecret,
      initiatedFrom: data.initiatedFrom,
      paymentMethod: data.paymentMethod,
      status: PaymentSessionStatus.PENDING,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      metadata: data.metadata || {},
    });

    const savedSession = await this.paymentSessionsRepository.save(session);
    console.log('✅ Payment session created:', savedSession.id);
    return savedSession;
  }

  /**
   * Get payment session by ID
   */
  async getPaymentSession(sessionId: string): Promise<PaymentSession | null> {
    return await this.paymentSessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['order'],
    });
  }

  /**
   * Update payment session status
   */
  async updatePaymentSessionStatus(
    sessionId: string,
    status: PaymentSessionStatus,
  ): Promise<PaymentSession> {
    console.log('🔄 Updating payment session status:', { sessionId, status });

    const session = await this.paymentSessionsRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Payment session not found');
    }

    session.status = status;
    if (status === PaymentSessionStatus.COMPLETED) {
      session.completedAt = new Date();
    }
    session.updatedAt = new Date();

    const updated = await this.paymentSessionsRepository.save(session);
    console.log('✅ Payment session updated:', sessionId);
    return updated;
  }

  /**
   * Create a transaction record
   */
  async createTransaction(data: {
    orderId: string;
    paymentSessionId?: string;
    userId: string;
    amount: number;
    currency?: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    status: TransactionStatus;
    paymentMethodType?: string;
    cardLast4?: string;
    cardBrand?: string;
    failureCode?: string;
    failureMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<Transaction> {
    console.log('💰 Creating transaction for order:', data.orderId);

    const transaction = this.transactionsRepository.create({
      orderId: data.orderId,
      paymentSessionId: data.paymentSessionId,
      userId: data.userId,
      amount: data.amount,
      currency: data.currency || 'USD',
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeChargeId: data.stripeChargeId,
      status: data.status,
      paymentMethodType: data.paymentMethodType,
      cardLast4: data.cardLast4,
      cardBrand: data.cardBrand,
      failureCode: data.failureCode,
      failureMessage: data.failureMessage,
      metadata: data.metadata || {},
    });

    const savedTransaction = await this.transactionsRepository.save(transaction);
    console.log('✅ Transaction created:', savedTransaction.id);
    return savedTransaction;
  }

  /**
   * Validate order status transitions
   * ✅ Prevents invalid state changes (e.g. completed → pending)
   */
  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): { valid: boolean; error?: string } {
    // Define valid transitions for each status
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.PAYMENT_PROCESSING,
        OrderStatus.PAID, // ✅ FIX Bug #27: Allow direct transition for fast payments
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PAYMENT_PROCESSING]: [
        OrderStatus.PAID,
        OrderStatus.FAILED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PAID]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [], // Terminal state - no transitions allowed
      [OrderStatus.FAILED]: [OrderStatus.PENDING], // Allow retry
      [OrderStatus.CANCELLED]: [], // Terminal state - no transitions allowed
    };

    // Check if transition is valid
    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      return {
        valid: false,
        error: `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Update order status
   * ✅ With validation to prevent invalid state transitions
   * ✅ Also updates associated payment session to maintain consistency
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    console.log('🔄 Updating order status:', { orderId, status });

    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // ✅ Validate status transition
    const validation = this.validateStatusTransition(order.status, status);
    if (!validation.valid) {
      console.error('❌ Invalid status transition:', validation.error);
      throw new Error(validation.error);
    }

    console.log(`✅ Valid transition: ${order.status} → ${status}`);

    // Update status
    order.status = status;
    if (status === OrderStatus.COMPLETED) {
      order.completedAt = new Date();
    }
    order.updatedAt = new Date();

    const updated = await this.ordersRepository.save(order);
    console.log('✅ Order updated:', orderId);
    
    // ✅ FIX: Update payment session status to maintain consistency
    try {
      const paymentSession = await this.paymentSessionsRepository.findOne({
        where: { orderId },
      });
      
      if (paymentSession) {
        let newSessionStatus: PaymentSessionStatus;
        
        // Map order status to payment session status
        switch (status) {
          case OrderStatus.PAID:
          case OrderStatus.COMPLETED:
            newSessionStatus = PaymentSessionStatus.COMPLETED;
            break;
          case OrderStatus.FAILED:
            newSessionStatus = PaymentSessionStatus.FAILED;
            break;
          case OrderStatus.CANCELLED:
            // ✅ FIX: PaymentSessionStatus doesn't have CANCELLED, use FAILED
            newSessionStatus = PaymentSessionStatus.FAILED;
            break;
          default:
            // Don't update session for pending/processing states
            return updated;
        }
        
        console.log(`🔄 Also updating payment session: ${paymentSession.status} → ${newSessionStatus}`);
        paymentSession.status = newSessionStatus;
        paymentSession.updatedAt = new Date();
        await this.paymentSessionsRepository.save(paymentSession);
        console.log('✅ Payment session updated');
      } else {
        console.warn('⚠️ No payment session found for order:', orderId);
      }
    } catch (error) {
      // Log but don't fail the order update
      console.error('❌ Failed to update payment session:', error);
    }
    
    return updated;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    return await this.ordersRepository.findOne({
      where: { id: orderId },
    });
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string, limit: number = 50): Promise<Order[]> {
    return await this.ordersRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get transaction by Stripe Payment Intent ID
   */
  async getTransactionByStripeId(stripePaymentIntentId: string): Promise<Transaction | null> {
    return await this.transactionsRepository.findOne({
      where: { stripePaymentIntentId },
      relations: ['order'],
    });
  }
}

