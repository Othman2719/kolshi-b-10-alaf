import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Product, Sale, Supplier, PurchaseOrder, SupplierPayment, Expense, AppSettings } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from './initialData';

export class ShopDatabase extends Dexie {
  products!: Table<Product, number>;
  sales!: Table<Sale, number>;
  suppliers!: Table<Supplier, number>;
  purchaseOrders!: Table<PurchaseOrder, number>;
  supplierPayments!: Table<SupplierPayment, number>;
  expenses!: Table<Expense, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('KolshiB10AlafDB');
    this.version(1).stores({
      products: '++id, name, category, barcode, buyPrice, stock',
      sales: '++id, date, timestamp, totalAmount, grossProfit',
      suppliers: '++id, name, phone, remainingDebt',
      purchaseOrders: '++id, supplierId, date, totalAmount, remainingDebt',
      supplierPayments: '++id, supplierId, date, amount',
      expenses: '++id, date, category, amount',
      settings: 'id',
    });
  }
}

export const db = new ShopDatabase();

// Seed initial data if database is empty
export async function initDatabase() {
  const productCount = await db.products.count();
  if (productCount === 0) {
    await db.products.bulkAdd(INITIAL_PRODUCTS as Product[]);
  }

  const supplierCount = await db.suppliers.count();
  if (supplierCount === 0) {
    await db.suppliers.bulkAdd(INITIAL_SUPPLIERS);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.put({
      id: 'default_settings',
      shopName: 'كلشي ب 10 آلاف - 10 Alaf',
      phone: '',
      wilaya: '',
      language: 'fr',
      currency: 'DA',
      fixedSellPrice: 100,
    });
  }
}
