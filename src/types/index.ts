export interface Product {
  id?: number;
  name: string;
  nameAr?: string;
  category: string;
  buyPrice: number; // e.g. 60 DA, 70 DA
  sellPrice: number; // Fixed 100 DA
  stock: number;
  alertThreshold: number; // e.g. 5
  barcode?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: number;
  productName: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  total: number;
}

export interface Sale {
  id?: number;
  date: string; // YYYY-MM-DD
  timestamp: number;
  items: SaleItem[];
  totalItems: number;
  totalAmount: number; // Total * 100 DA
  totalCost: number; // Total * buyPrice
  grossProfit: number; // totalAmount - totalCost
  cashGiven: number;
  changeReturned: number;
  notes?: string;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  wilaya?: string;
  totalPurchases: number;
  totalPaid: number;
  remainingDebt: number; // totalPurchases - totalPaid
  notes?: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId?: number;
  productName: string;
  category: string;
  buyPrice: number;
  quantity: number;
  total: number;
}

export interface PurchaseOrder {
  id?: number;
  supplierId: number;
  supplierName: string;
  date: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  amountPaid: number;
  remainingDebt: number;
  notes?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id?: number;
  supplierId: number;
  supplierName: string;
  date: string;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id?: number;
  date: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  createdAt: string;
}

export type ExpenseCategory = 
  | 'Loyer / كراء'
  | 'Électricité & Eau / كهرباء وماء'
  | 'Transport / نقل السلعة'
  | 'Sachets & Emballage / أكياس وتغليف'
  | 'Salaire employé / راتب العامل'
  | 'Repas & Café / وجبات وقهوة'
  | 'Entretien & Réparation / صيانة وتصليح'
  | 'Autre / مصاريف أخرى';

export interface AppSettings {
  id?: string;
  shopName: string;
  phone?: string;
  wilaya?: string;
  language: 'fr' | 'ar';
  currency: string;
  fixedSellPrice: number;
}
