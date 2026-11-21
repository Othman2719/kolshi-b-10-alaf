import * as XLSX from 'xlsx';
import { db } from '../db/db';
import type { Product } from '../types';

export async function exportAllToExcel() {
  const products = await db.products.toArray();
  const sales = await db.sales.toArray();
  const suppliers = await db.suppliers.toArray();
  const purchaseOrders = await db.purchaseOrders.toArray();
  const expenses = await db.expenses.toArray();

  const wb = XLSX.utils.book_new();

  // Stock Sheet
  const stockData = products.map((p) => ({
    'ID': p.id,
    'Nom du Produit': p.name,
    'Nom Arabe': p.nameAr || '',
    'Catégorie': p.category,
    'Prix Achat (DA)': p.buyPrice,
    'Prix Vente (DA)': p.sellPrice,
    'Quantité en Stock': p.stock,
    'Valeur Stock (DA)': p.stock * p.buyPrice,
    'Code-barres': p.barcode || '',
  }));
  const wsStock = XLSX.utils.json_to_sheet(stockData);
  XLSX.utils.book_append_sheet(wb, wsStock, 'Stock 100 DA');

  // Sales Sheet
  const salesData = sales.map((s) => ({
    'ID Vente': s.id,
    'Date': s.date,
    'Heure': new Date(s.timestamp).toLocaleTimeString(),
    'Nombre Articles': s.totalItems,
    'Total Vente (DA)': s.totalAmount,
    'Coût Achat Total (DA)': s.totalCost,
    'Fayda Brute (DA)': s.grossProfit,
    'Montant Reçu': s.cashGiven,
    'Monnaie Rendue': s.changeReturned,
  }));
  const wsSales = XLSX.utils.json_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Ventes');

  // Expenses Sheet
  const expensesData = expenses.map((e) => ({
    'ID': e.id,
    'Date': e.date,
    'Catégorie': e.category,
    'Montant (DA)': e.amount,
    'Notes': e.notes || '',
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Charges & Dépenses');

  // Suppliers Sheet
  const suppliersData = suppliers.map((sup) => ({
    'ID': sup.id,
    'Nom Fournisseur': sup.name,
    'Téléphone': sup.phone,
    'Wilaya / Marché': sup.wilaya || '',
    'Total Achats (DA)': sup.totalPurchases,
    'Total Payé (DA)': sup.totalPaid,
    'Dette Restante (DA)': sup.remainingDebt,
    'Remarques': sup.notes || '',
  }));
  const wsSuppliers = XLSX.utils.json_to_sheet(suppliersData);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Fournisseurs & Dettes');

  // Orders Sheet
  const ordersData = purchaseOrders.map((po) => ({
    'ID Bon': po.id,
    'Fournisseur': po.supplierName,
    'Date': po.date,
    'Total Bon (DA)': po.totalAmount,
    'Montant Versé (DA)': po.amountPaid,
    'Reste Dû (DA)': po.remainingDebt,
    'Remarques': po.notes || '',
  }));
  const wsOrders = XLSX.utils.json_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Bons d\'Achat');

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Hanout_10_Alaf_Export_${today}.xlsx`);
}

export async function importProductsFromExcel(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const productsToAdd: Omit<Product, 'id'>[] = [];
        const now = new Date().toISOString();

        for (const row of rawJson) {
          const name = String(row['Nom du Produit'] || row['Nom'] || row['name'] || '').trim();
          if (!name) continue;

          const buyPrice = Number(row['Prix Achat (DA)'] || row['Prix Achat'] || row['buyPrice'] || 60);
          const stock = Number(row['Quantité en Stock'] || row['Stock'] || row['stock'] || 10);
          const category = String(row['Catégorie'] || row['category'] || 'Divers').trim();
          const barcode = String(row['Code-barres'] || row['Barcode'] || row['barcode'] || '').trim();
          const nameAr = String(row['Nom Arabe'] || row['nameAr'] || '').trim();

          productsToAdd.push({
            name,
            nameAr: nameAr || undefined,
            category: category || 'Divers',
            buyPrice: isNaN(buyPrice) ? 60 : buyPrice,
            sellPrice: 100, // Fixed 100 DA
            stock: isNaN(stock) ? 0 : stock,
            alertThreshold: 5,
            barcode: barcode || undefined,
            createdAt: now,
            updatedAt: now,
          });
        }

        if (productsToAdd.length > 0) {
          await db.products.bulkAdd(productsToAdd as Product[]);
        }
        resolve(productsToAdd.length);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
