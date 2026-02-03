
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  SAVINGS = 'SAVINGS'
}

export type TransactionStatus = 'PAID' | 'PENDING';

// We keep this for seeding, but the app now supports dynamic strings
export const DefaultCategories = {
  FOOD: 'Alimentación',
  TRANSPORT: 'Transporte',
  HOUSING: 'Vivienda',
  ENTERTAINMENT: 'Entretenimiento',
  SHOPPING: 'Compras',
  HEALTH: 'Salud',
  EDUCATION: 'Educación',
  SALARY: 'Salario',
  INVESTMENT: 'Inversiones',
  OTHER: 'Otros'
};

export interface CategoryItem {
  id: string;
  name: string;
  color: string; // Hex or Tailwind class
  type: 'default' | 'custom';
}

export interface InstallmentPlan {
  totalInstallments: number; // e.g., 12 cuotas
  paidInstallments: number; // e.g., 3 pagadas (Calculated or manual)
  startDate: string; // ISO Date
  monthlyAmount: number;
}

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  dayOfMonth: number; // Day to auto-generate
  active: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string; 
  date: string;
  type: TransactionType;
  status: TransactionStatus; // New field
  installmentPlan?: InstallmentPlan | null;
  recurringRuleId?: string; // Links back to a recurring rule if auto-generated
  parentTransactionId?: string; // Links an individual payment to the main installment purchase
}

export interface SummaryStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  monthlyCommitment: number;
}