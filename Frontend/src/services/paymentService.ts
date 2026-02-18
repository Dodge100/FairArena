import { apiRequest, publicApiRequest } from '@/lib/apiClient';

export interface PaymentPlan {
  id: string;
  planId: string;
  name: string;
  amount: number;
  currency: string;
  credits: number;
  description: string;
  features: string[];
  isActive: boolean;
}

export interface SubscriptionPlan {
  id: string;
  planId: string;
  razorpayPlanId: string | null;
  name: string;
  tier: 'FREE' | 'STARTER' | 'PRO' | 'TEAM' | 'ENTERPRISE';
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  amount: number;
  currency: string;
  description?: string;
  features: string[];
  limits: Record<string, unknown>;
  isActive: boolean;
  isPopular: boolean;
}

export interface PlansResponse {
  success: boolean;
  plans: PaymentPlan[];
  cached?: boolean;
}

export interface CreateOrderResponse {
  success: boolean;
  order?: {
    id: string;
    amount: number;
    currency: string;
    key: string;
  };
  plan?: PaymentPlan;
  message?: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  status?: string;
  awaitingWebhook?: boolean;
  data?: {
    planId: string;
    planName: string;
    credits: number;
    amount: number;
    currency: string;
    orderId: string;
    paymentId: string;
  };
}

export class PaymentService {
  private static instance: PaymentService;
  private baseURL: string;
  private plansCache: PaymentPlan[] | null = null;
  private plansCacheTimestamp: number = 0;
  private subPlansCache: SubscriptionPlan[] | null = null;
  private subPlansCacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds

  private constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL;
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  async createOrder(planId: string, token: string): Promise<CreateOrderResponse> {
    try {
      return await apiRequest<CreateOrderResponse>(`${this.baseURL}/api/v1/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  async verifyPayment(
    paymentData: VerifyPaymentRequest,
    token: string,
  ): Promise<VerifyPaymentResponse> {
    try {
      return await apiRequest<VerifyPaymentResponse>(
        `${this.baseURL}/api/v1/payments/verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(paymentData),
        },
      );
    } catch (error) {
      console.error('Verify payment error:', error);
      throw error;
    }
  }
  async fetchPlans(): Promise<PaymentPlan[]> {
    try {
      // Check if cache is valid
      const now = Date.now();
      if (this.plansCache && now - this.plansCacheTimestamp < this.CACHE_DURATION) {
        return this.plansCache;
      }

      // Fetch from API
      // Use publicApiRequest since plans are public and we want them to load even before auth is initialized
      const data = await publicApiRequest<PlansResponse>(`${this.baseURL}/api/v1/plans`);

      if (data.success && data.plans) {
        this.plansCache = data.plans;
        this.plansCacheTimestamp = now;
        return data.plans;
      }

      throw new Error('Failed to fetch plans from API');
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      // Return empty array on error
      return [];
    }
  }

  async getPlanById(planId: string): Promise<PaymentPlan | null> {
    const plans = await this.fetchPlans();
    return plans.find((plan) => plan.planId === planId) || null;
  }

  async getAllPlans(): Promise<PaymentPlan[]> {
    return await this.fetchPlans();
  }

  async fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const now = Date.now();
      if (this.subPlansCache && now - this.subPlansCacheTimestamp < this.CACHE_DURATION) {
        return this.subPlansCache;
      }

      // Use publicApiRequest since plans are public and we want them to load even before auth is initialized
      const data = await publicApiRequest<{ success: boolean; plans: SubscriptionPlan[] }>(
        `${this.baseURL}/api/v1/subscriptions/plans`,
      );

      if (data.success && data.plans) {
        this.subPlansCache = data.plans;
        this.subPlansCacheTimestamp = now;
        return data.plans;
      }

      throw new Error('Failed to fetch subscription plans');
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error);
      return [];
    }
  }

  clearCache(): void {
    this.plansCache = null;
    this.plansCacheTimestamp = 0;
    this.subPlansCache = null;
    this.subPlansCacheTimestamp = 0;
  }
}

export const paymentService = PaymentService.getInstance();
