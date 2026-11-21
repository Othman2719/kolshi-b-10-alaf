import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Supplier, PurchaseOrder, PurchaseOrderItem } from '../types';
import { translations, Language } from '../i18n/translations';
import { INITIAL_CATEGORIES } from '../db/initialData';
import {
  Users,
  Plus,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  Trash2,
  X,
  PackagePlus,
} from 'lucide-react';

interface SuppliersViewProps {
  lang: Language;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ lang }) => {
  const t = translations[lang];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const purchaseOrders = useLiveQuery(() => db.purchaseOrders.orderBy('date').reverse().toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');

  // Supplier modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierWilaya, setSupplierWilaya] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  // Purchase Order modal (Bon d'achat)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSupplierId, setOrderSupplierId] = useState<number>(0);
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([
    { productName: '', category: INITIAL_CATEGORIES[0].nameFr, buyPrice: 60, quantity: 20, total: 1200 },
  ]);
  const [orderPaidAmount, setOrderPaidAmount] = useState<string>('0');

  // Payment modal (Verser une dette)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Stats
  const totalDebts = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + s.remainingDebt, 0);
  }, [suppliers]);

  const totalPurchasesSum = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
  }, [suppliers]);

  // Order items total
  const orderTotalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.buyPrice * item.quantity, 0);
  }, [orderItems]);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) return;

    await db.suppliers.add({
      name: supplierName.trim(),
      phone: supplierPhone.trim(),
      wilaya: supplierWilaya.trim() || undefined,
      totalPurchases: 0,
      totalPaid: 0,
      remainingDebt: 0,
      notes: supplierNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    setSupplierName('');
    setSupplierPhone('');
    setSupplierWilaya('');
    setSupplierNotes('');
    setIsSupplierModalOpen(false);
  };

  const handleAddOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      { productName: '', category: INITIAL_CATEGORIES[0].nameFr, buyPrice: 60, quantity: 10, total: 600 },
    ]);
  };

  const handleUpdateOrderItem = (index: number, field: keyof PurchaseOrderItem, value: unknown) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          const updated = { ...item, [field]: value };
          if (field === 'buyPrice' || field === 'quantity') {
            updated.total = updated.buyPrice * updated.quantity;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSavePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSupplierId || orderItems.length === 0) return;

    const supplier = suppliers.find((s) => s.id === orderSupplierId);
    if (!supplier) return;

    const paid = parseFloat(orderPaidAmount) || 0;
    const debt = Math.max(0, orderTotalAmount - paid);

    try {
      await db.transaction('rw', [db.purchaseOrders, db.suppliers, db.products], async () => {
        // 1. Record purchase order
        await db.purchaseOrders.add({
          supplierId: supplier.id!,
          supplierName: supplier.name,
          date: orderDate,
          items: orderItems,
          totalAmount: orderTotalAmount,
          amountPaid: paid,
          remainingDebt: debt,
          notes: orderNotes.trim() || undefined,
          createdAt: new Date().toISOString(),
        });

        // 2. Update supplier stats
        await db.suppliers.update(supplier.id!, {
          totalPurchases: supplier.totalPurchases + orderTotalAmount,
          totalPaid: supplier.totalPaid + paid,
          remainingDebt: supplier.remainingDebt + debt,
        });

        // 3. Update or add products to stock!
        const now = new Date().toISOString();
        for (const item of orderItems) {
          if (!item.productName.trim()) continue;
          const existing = await db.products
            .filter((p) => p.name.toLowerCase() === item.productName.toLowerCase().trim())
            .first();

          if (existing && existing.id) {
            await db.products.update(existing.id, {
              stock: existing.stock + item.quantity,
              buyPrice: item.buyPrice, // update with latest purchase cost
              updatedAt: now,
            });
          } else {
            await db.products.add({
              name: item.productName.trim(),
              category: item.category,
              buyPrice: item.buyPrice,
              sellPrice: 100, // Fixed 100 DA
              stock: item.quantity,
              alertThreshold: 5,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      });

      setIsOrderModalOpen(false);
      setOrderItems([{ productName: '', category: INITIAL_CATEGORIES[0].nameFr, buyPrice: 60, quantity: 20, total: 1200 }]);
      setOrderPaidAmount('0');
      alert(
        lang === 'ar'
          ? 'تم تسجيل وصل الشراء وتحديث المخزن والديون بنجاح !'
          : 'Bon d\'achat enregistré et stock mis à jour avec succès !'
      );
    } catch (err) {
      console.error('Error saving order:', err);
      alert('Erreur lors de l\'enregistrement du bon d\'achat');
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount) || 0;
    if (!paymentSupplierId || amount <= 0) return;

    const supplier = suppliers.find((s) => s.id === paymentSupplierId);
    if (!supplier) return;

    try {
      await db.transaction('rw', [db.suppliers, db.supplierPayments], async () => {
        await db.supplierPayments.add({
          supplierId: supplier.id!,
          supplierName: supplier.name,
          date: new Date().toISOString().split('T')[0],
          amount,
          notes: paymentNotes.trim() || undefined,
          createdAt: new Date().toISOString(),
        });

        await db.suppliers.update(supplier.id!, {
          totalPaid: supplier.totalPaid + amount,
          remainingDebt: Math.max(0, supplier.remainingDebt - amount),
        });
      });

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      alert(
        lang === 'ar'
          ? `تم تسجيل دفعة بقيمة ${amount} دج للمورد بنجاح !`
          : `Paiement de ${amount} DA enregistré avec succès !`
      );
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Erreur lors du versement');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-red-50/80 border border-red-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-red-700 block">
              {t.totalDebtsOwed}
            </span>
            <span className="text-2xl font-black text-red-700">
              {totalDebts.toLocaleString()} <span className="text-sm">DA</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">
              {lang === 'ar' ? 'مجموع مشتريات السلعة' : 'Total Achats Fournisseurs'}
            </span>
            <span className="text-2xl font-black text-slate-800">
              {totalPurchasesSum.toLocaleString()} <span className="text-sm">DA</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">
              {lang === 'ar' ? 'عدد تجار الجملة المسجلين' : 'Nombre de Fournisseurs'}
            </span>
            <span className="text-2xl font-black text-slate-800">
              {suppliers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar & Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'suppliers'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.suppliersTitle} ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'orders'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.orderHistory} ({purchaseOrders.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl transition-all active:scale-95 text-xs sm:text-sm flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" />
            <span>{t.recordPayment}</span>
          </button>

          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all active:scale-95 text-xs sm:text-sm flex items-center gap-1.5 shadow-xs"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{t.newPurchaseOrder}</span>
          </button>

          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all active:scale-95 text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addSupplier}</span>
          </button>
        </div>
      </div>

      {/* CONTENT: SUPPLIERS TAB */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-base text-slate-900">{s.name}</h4>
                  {s.remainingDebt > 0 ? (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-black">
                      {s.remainingDebt.toLocaleString()} DA
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {lang === 'ar' ? 'مسدد كلياً' : 'Réglé'}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                  {s.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${s.phone}`} className="hover:underline font-semibold text-slate-700">
                        {s.phone}
                      </a>
                    </div>
                  )}
                  {s.wilaya && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{s.wilaya}</span>
                    </div>
                  )}
                  {s.notes && (
                    <p className="mt-1 text-slate-400 italic line-clamp-2">« {s.notes} »</p>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.totalPurchases}</span>
                  <span className="font-bold text-slate-800">{s.totalPurchases.toLocaleString()} DA</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t.totalPaid}</span>
                  <span className="font-bold text-emerald-700">{s.totalPaid.toLocaleString()} DA</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONTENT: ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="flex flex-col gap-2">
          {purchaseOrders.map((po) => (
            <div
              key={po.id}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{po.supplierName}</h4>
                  <span className="text-xs text-slate-400">#{po.id} • {po.date}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {po.items.map((item, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                    >
                      {item.productName} ({item.quantity} pcs × {item.buyPrice} DA)
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">{t.amount}</span>
                  <span className="font-bold text-slate-800">{po.totalAmount.toLocaleString()} DA</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">{t.paid}</span>
                  <span className="font-bold text-emerald-700">{po.amountPaid.toLocaleString()} DA</span>
                </div>
                {po.remainingDebt > 0 && (
                  <div className="text-right bg-red-50 p-1.5 rounded-lg border border-red-200">
                    <span className="text-red-700 block text-[10px] font-bold">{t.remaining}</span>
                    <span className="font-black text-red-700">{po.remainingDebt.toLocaleString()} DA</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
              <h3 className="font-bold text-base">{t.addSupplier}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.supplierName} *
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ex: Grossiste Karim El Eulma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.phone}
                  </label>
                  <input
                    type="tel"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="0661..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.wilaya}
                  </label>
                  <input
                    type="text"
                    value={supplierWilaya}
                    onChange={(e) => setSupplierWilaya(e.target.value)}
                    placeholder="Sétif / El Eulma"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.notes}
                </label>
                <textarea
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW PURCHASE ORDER (BON D'ACHAT) */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-10">
              <h3 className="font-bold text-base">{t.newPurchaseOrder}</h3>
              <button onClick={() => setIsOrderModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSavePurchaseOrder} className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.supplierName} *
                  </label>
                  <select
                    required
                    value={orderSupplierId}
                    onChange={(e) => setOrderSupplierId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                  >
                    <option value={0}>-- Choisir le grossiste --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.date}
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              {/* Order Items Table */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-xs text-slate-700 uppercase">
                    {lang === 'ar' ? 'السلع المشتراة (تضاف مباشرة للمخزن)' : 'Articles Achetés (Ajoutés au stock)'}
                  </h5>
                  <button
                    type="button"
                    onClick={handleAddOrderItem}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Ajouter un article</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {orderItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-xl border border-slate-200"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Nom de l'article"
                          value={item.productName}
                          onChange={(e) => handleUpdateOrderItem(idx, 'productName', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Prix"
                          value={item.buyPrice}
                          onChange={(e) => handleUpdateOrderItem(idx, 'buyPrice', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qté"
                          value={item.quantity}
                          onChange={(e) => handleUpdateOrderItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-bold"
                        />
                      </div>
                      <div className="col-span-2 text-right font-black text-xs text-slate-800">
                        {item.total} DA
                      </div>
                      <div className="col-span-1 text-center">
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOrderItem(idx)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Payments */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-black text-slate-800">
                  <span>Total Bon d'Achat :</span>
                  <span className="text-xl text-emerald-800">{orderTotalAmount.toLocaleString()} DA</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {lang === 'ar' ? 'المبلغ المسدد له كاش' : 'Montant Versé (Cash)'}
                    </label>
                    <input
                      type="number"
                      value={orderPaidAmount}
                      onChange={(e) => setOrderPaidAmount(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {lang === 'ar' ? 'الدين المتبقي عليه' : 'Reste Dû (Dette)'}
                    </label>
                    <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-red-600">
                      {Math.max(0, orderTotalAmount - (parseFloat(orderPaidAmount) || 0)).toLocaleString()} DA
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!orderSupplierId || orderItems.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD PAYMENT (VERSER UNE DETTE) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
              <h3 className="font-bold text-base">{t.recordPayment}</h3>
              <button onClick={() => setIsPaymentModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.supplierName} *
                </label>
                <select
                  required
                  value={paymentSupplierId}
                  onChange={(e) => setPaymentSupplierId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                >
                  <option value={0}>-- Choisir le grossiste --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Dette : {s.remainingDebt.toLocaleString()} DA)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === 'ar' ? 'المبلغ المدفوع (دج)' : 'Montant Versé (DA)'} *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ex: 10000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-emerald-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.notes}
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ex: Versement espèce après vente"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!paymentSupplierId || !paymentAmount}
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md"
                >
                  {lang === 'ar' ? 'تأكيد التسديد' : 'Confirmer le Versement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
