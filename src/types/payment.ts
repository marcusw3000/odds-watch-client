export type PaymentType = 'DEPOSIT' | 'WITHDRAWAL';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'PIX' | 'CARD' | 'BOLETO';

export interface Payment {
  id: string;
  user_id: string;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  fee: number;
  net_amount: number;
  status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_refund_id: string | null;
  pix_code: string | null;
  pix_qr_code_url: string | null;
  pix_expires_at: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  metadata: Record<string, any>;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface WithdrawalRequest {
  amount: number;
  pix_key: string;
  pix_key_type: PixKeyType;
}
