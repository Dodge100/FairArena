import axios from 'axios';

export interface PaymentPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  credits: number;
  description: string;
  features: string[];
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

// Hardcoded plans (easily replaceable with API call)
export const PAYMENT_PLANS: Record<string, PaymentPlan> = {
  basic: {
    id: 'basic_plan',
    name: 'Basic Plan',
    amount: 89900, // ₹899 in paisa
    currency: 'INR',
    credits: 50,
    description: 'Perfect for small hackathons & student-led events',
    features: [
      '50 Participants',
      '5 Judges',
      'Manual Scoring System',
      'Basic Real-time Leaderboard',
      'Submission Management',
      'Email Support',
    ],
  },
  business: {
    id: 'business_plan',
    name: 'Business Plan',
    amount: 299900, // ₹2999 in paisa
    currency: 'INR',
    credits: 300,
    description: 'Our most popular plan with AI-powered scoring',
    features: [
      '300 Participants',
      '20 Judges',
      'AI Website Analysis',
      'Advanced Leaderboard',
      'Judge Collaboration Tools',
      'AI Scoring Assistance',
      'Priority Support',
    ],
  },
  enterprise: {
    id: 'enterprise_plan',
    name: 'Enterprise Plan',
    amount: 0, // Custom pricing
    currency: 'INR',
    credits: 0,
    description: 'For large-scale, enterprise-grade hackathons',
    features: [
      'Unlimited Participants',
      'Unlimited Judges',
      'Deep AI Analytics',
      'Plagiarism Detection',
      'Custom Rubrics & Permissions',
      'Dedicated Account Manager',
      'SLA-backed Support',
    ],
  },
};

export class PaymentService {
  private static instance: PaymentService;
  private baseURL: string;

  private constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
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

  getPlanById(planId: string): PaymentPlan | null {
    return PAYMENT_PLANS[planId] || null;
  }

  getAllPlans(): PaymentPlan[] {
    return Object.values(PAYMENT_PLANS);
  }
}

export const paymentService = PaymentService.getInstance();
