import axios from 'axios';

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
      const response = await axios.post(
        `${this.baseURL}/api/v1/payments/create-order`,
        { planId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
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
      const response = await axios.post(
        `${this.baseURL}/api/v1/payments/verify-payment`,
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
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
      const response = await axios.get<PlansResponse>(`${this.baseURL}/api/v1/plans`);

      if (response.data.success && response.data.plans) {
        this.plansCache = response.data.plans;
        this.plansCacheTimestamp = now;
        return response.data.plans;
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

  clearCache(): void {
    this.plansCache = null;
    this.plansCacheTimestamp = 0;
  }
}

export const paymentService = PaymentService.getInstance();
