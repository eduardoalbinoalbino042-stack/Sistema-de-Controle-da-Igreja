
export interface CreditCardConfig {
  id?: string;
  userId: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  label: string;
  bank?: string;
  bgImage?: string;
  isMain?: boolean;
}

export interface Transaction {
  id?: string;
  userId: string;
  description: string;
  amount: number;
  category: string;
  date: string; // ISO format
  installments: number; // 1 if not installment
  currentInstallment: number;
  totalInstallments: number;
  linkedTransactionId?: string; // Legacy
  purchaseGroupId?: string; // To group installments
  invoiceId: string;
  cardId: string;
  costCenter?: string;
  details?: string;
}

export type InvoiceStatus = 'Aberta' | 'Fechada' | 'Paga' | 'Vencida';

export interface PixContact {
  id?: string;
  userId: string;
  name: string;
  pixKey: string;
  avatarSeed: string;
}

export interface Invoice {
  id?: string;
  userId: string;
  cardId: string;
  month: number; // 0-11
  year: number;
  status: InvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  closingDate: string;
  dueDate: string;
}

export const CATEGORIES = [
  'Alimentação',
  'Lazer',
  'Transporte',
  'Saúde',
  'Educação',
  'Moradia',
  'Vestuário',
  'Eletrônicos',
  'Outros'
];
