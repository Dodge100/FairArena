import { razorpay } from '../config/razorpay.js';
import logger from './logger.js';

interface RazorpayInvoice {
  id: string;
  entity: string;
  receipt: string;
  invoice_number: string;
  customer_id: string;
  customer_details: {
    id: string;
    name: string;
    email: string;
    contact: string;
    gstin: string | null;
    billing_address: any;
    shipping_address: any;
  };
  order_id: string;
  line_items: Array<{
    id: string;
    item_id: string | null;
    name: string;
    description: string;
    amount: number;
    unit_amount: number;
    gross_amount: number;
    tax_amount: number;
    taxable_amount: number;
    net_amount: number;
    currency: string;
    type: string;
    tax_inclusive: boolean;
    hsn_code: string | null;
    sac_code: string | null;
    tax_rate: number;
    unit: string | null;
    quantity: number;
    taxes: any[];
  }>;
  payment_id: string | null;
  status: string;
  expire_by: number;
  issued_at: number;
  paid_at: number | null;
  cancelled_at: number | null;
  expired_at: number | null;
  sms_status: string | null;
  email_status: string | null;
  date: number;
  terms: string | null;
  partial_payment: boolean;
  gross_amount: number;
  tax_amount: number;
  taxable_amount: number;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  currency_symbol: string;
  description: string | null;
  notes: any;
  comment: string | null;
  short_url: string;
  view_less: boolean;
  billing_start: number | null;
  billing_end: number | null;
  type: string;
  group_taxes_discounts: boolean;
  created_at: number;
  idempotency_key: string | null;
}

/**
 * Create a Razorpay invoice for a payment
 */
export async function createRazorpayInvoice(params: {
  paymentId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerContact?: string;
  amount: number;
  currency: string;
  description: string;
  lineItems: Array<{
    name: string;
    description: string;
    amount: number;
    quantity: number;
  }>;
}): Promise<RazorpayInvoice | null> {
  try {
    if (!razorpay) {
      logger.error('Razorpay not configured');
      return null;
    }

    // Create customer first (required for invoice)
    let customer;
    try {
      customer = await razorpay.customers.create({
        name: params.customerName,
        email: params.customerEmail,
        contact: params.customerContact || '',
        notes: {
          payment_id: params.paymentId,
          order_id: params.orderId,
        },
      });
    } catch (error: any) {
      // If customer already exists, fetch by email
      if (error.error?.code === 'BAD_REQUEST_ERROR') {
        logger.info('Customer may already exist, proceeding with invoice creation');
      } else {
        throw error;
      }
    }

    // Create invoice
    const invoice = await razorpay.invoices.create({
      type: 'invoice',
      description: params.description,
      customer_id: customer?.id,
      customer: customer
        ? undefined
        : {
            name: params.customerName,
            email: params.customerEmail,
            contact: params.customerContact || '',
          },
      line_items: params.lineItems.map((item) => ({
        name: item.name,
        description: item.description,
        amount: item.amount,
        currency: params.currency,
        quantity: item.quantity,
      })),
      currency: params.currency,
      email_notify: 0, // We'll send email ourselves
      sms_notify: 0,
      expire_by: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      notes: {
        payment_id: params.paymentId,
        order_id: params.orderId,
      },
    });

    logger.info('Razorpay invoice created', {
      invoiceId: invoice.id,
      paymentId: params.paymentId,
      orderId: params.orderId,
    });

    return invoice as RazorpayInvoice;
  } catch (error) {
    logger.error('Failed to create Razorpay invoice', {
      error: error instanceof Error ? error.message : String(error),
      paymentId: params.paymentId,
      orderId: params.orderId,
    });
    return null;
  }
}

/**
 * Fetch an existing Razorpay invoice
 */
export async function fetchRazorpayInvoice(invoiceId: string): Promise<RazorpayInvoice | null> {
  try {
    if (!razorpay) {
      logger.error('Razorpay not configured');
      return null;
    }

    const invoice = await razorpay.invoices.fetch(invoiceId);
    return invoice as RazorpayInvoice;
  } catch (error) {
    logger.error('Failed to fetch Razorpay invoice', {
      error: error instanceof Error ? error.message : String(error),
      invoiceId,
    });
    return null;
  }
}

/**
 * Issue (finalize) a Razorpay invoice after payment is captured
 */
export async function issueRazorpayInvoice(invoiceId: string): Promise<RazorpayInvoice | null> {
  try {
    if (!razorpay) {
      logger.error('Razorpay not configured');
      return null;
    }

    const invoice = await razorpay.invoices.issue(invoiceId);

    logger.info('Razorpay invoice issued', { invoiceId });
    return invoice as RazorpayInvoice;
  } catch (error) {
    logger.error('Failed to issue Razorpay invoice', {
      error: error instanceof Error ? error.message : String(error),
      invoiceId,
    });
    return null;
  }
}

/**
 * Get the invoice URL for sharing with customer
 */
export function getInvoiceUrl(invoice: RazorpayInvoice): string {
  return invoice.short_url;
}

/**
 * Download invoice as PDF (Razorpay generates this automatically)
 */
export async function downloadInvoicePDF(invoiceId: string): Promise<Buffer | null> {
  try {
    if (!razorpay) {
      logger.error('Razorpay not configured');
      return null;
    }

    // Razorpay doesn't provide direct PDF download via API
    // The invoice URL (short_url) can be used to view/download PDF
    logger.info('Invoice PDF available at invoice URL', { invoiceId });
    return null;
  } catch (error) {
    logger.error('Failed to download invoice PDF', {
      error: error instanceof Error ? error.message : String(error),
      invoiceId,
    });
    return null;
  }
}
