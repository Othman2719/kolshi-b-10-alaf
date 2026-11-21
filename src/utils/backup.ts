import { db } from '../db/db';

export async function downloadDatabaseBackup() {
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    appName: 'Hanout Kolshi b 10 Alaf',
    data: {
      products: await db.products.toArray(),
      sales: await db.sales.toArray(),
      suppliers: await db.suppliers.toArray(),
      purchaseOrders: await db.purchaseOrders.toArray(),
      supplierPayments: await db.supplierPayments.toArray(),
      expenses: await db.expenses.toArray(),
      settings: await db.settings.toArray(),
    }
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = `Hanout_10_Alaf_Backup_${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreDatabaseFromJson(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed.data) {
          throw new Error('Fichier de sauvegarde invalide');
        }

        await db.transaction('rw', [
          db.products,
          db.sales,
          db.suppliers,
          db.purchaseOrders,
          db.supplierPayments,
          db.expenses,
          db.settings,
        ], async () => {
          if (Array.isArray(parsed.data.products)) {
            await db.products.clear();
            await db.products.bulkAdd(parsed.data.products);
          }
          if (Array.isArray(parsed.data.sales)) {
            await db.sales.clear();
            await db.sales.bulkAdd(parsed.data.sales);
          }
          if (Array.isArray(parsed.data.suppliers)) {
            await db.suppliers.clear();
            await db.suppliers.bulkAdd(parsed.data.suppliers);
          }
          if (Array.isArray(parsed.data.purchaseOrders)) {
            await db.purchaseOrders.clear();
            await db.purchaseOrders.bulkAdd(parsed.data.purchaseOrders);
          }
          if (Array.isArray(parsed.data.supplierPayments)) {
            await db.supplierPayments.clear();
            await db.supplierPayments.bulkAdd(parsed.data.supplierPayments);
          }
          if (Array.isArray(parsed.data.expenses)) {
            await db.expenses.clear();
            await db.expenses.bulkAdd(parsed.data.expenses);
          }
          if (Array.isArray(parsed.data.settings) && parsed.data.settings.length > 0) {
            await db.settings.clear();
            await db.settings.bulkPut(parsed.data.settings);
          }
        });

        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
