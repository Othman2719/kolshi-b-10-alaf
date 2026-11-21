import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { translations, Language } from '../i18n/translations';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  ShoppingBag,
  Coins,
  AlertCircle,
  Award,
  Clock,
  Calendar,
  RotateCcw,
  Trash2,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface DashboardViewProps {
  lang: Language;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ lang }) => {
  const t = translations[lang];

  const sales = useLiveQuery(() => db.sales.orderBy('timestamp').reverse().toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];

  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Filter Sales & Expenses by chosen period
  const { filteredSales, filteredExpenses } = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    const fSales = sales.filter((s) => {
      if (period === 'today') return s.date === todayStr;
      if (period === 'week') {
        const diffDays = (now.getTime() - s.timestamp) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (period === 'month') return s.date.startsWith(todayStr.substring(0, 7));
      return true;
    });

    const fExpenses = expenses.filter((e) => {
      if (period === 'today') return e.date === todayStr;
      if (period === 'week') {
        const diffDays = (now.getTime() - new Date(e.date).getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (period === 'month') return e.date.startsWith(todayStr.substring(0, 7));
      return true;
    });

    return { filteredSales: fSales, filteredExpenses: fExpenses };
  }, [sales, expenses, period]);

  // Financial Metrics for the period
  const totalSalesAmount = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.totalAmount, 0),
    [filteredSales]
  );

  const totalCostOfGoodsSold = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.totalCost, 0),
    [filteredSales]
  );

  const totalGrossProfit = useMemo(
    () => totalSalesAmount - totalCostOfGoodsSold,
    [totalSalesAmount, totalCostOfGoodsSold]
  );

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Fayda Safiya (Bénéfice Net)
  const netProfit = totalGrossProfit - totalExpenses;
  const netMarginPercent = totalSalesAmount > 0 ? ((netProfit / totalSalesAmount) * 100).toFixed(1) : '0';

  // Current Store Assets & Debts
  const currentStockCapital = useMemo(
    () => products.reduce((sum, p) => sum + p.stock * p.buyPrice, 0),
    [products]
  );

  const currentStockPotentialSales = useMemo(
    () => products.reduce((sum, p) => sum + p.stock * 100, 0),
    [products]
  );

  const totalDebts = useMemo(
    () => suppliers.reduce((sum, s) => sum + s.remainingDebt, 0),
    [suppliers]
  );

  // Top 10 Best-Selling Products
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; qty: number; profit: number }>();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = item.productName;
        const profitPerItem = 100 - item.buyPrice;
        if (!productMap.has(key)) {
          productMap.set(key, { name: item.productName, qty: item.quantity, profit: profitPerItem * item.quantity });
        } else {
          const cur = productMap.get(key)!;
          cur.qty += item.quantity;
          cur.profit += profitPerItem * item.quantity;
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [filteredSales]);

  // Cancel / Delete a Sale (restores inventory!)
  const handleCancelSale = async (saleId: number) => {
    if (!confirm(lang === 'ar' ? 'هل تريد إلغاء هذه البيعة وإرجاع السلع إلى المخزن ؟' : 'Annuler cette vente et réintégrer le stock ?')) {
      return;
    }

    const sale = await db.sales.get(saleId);
    if (!sale) return;

    await db.transaction('rw', [db.sales, db.products], async () => {
      // Re-add stock
      for (const item of sale.items) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          await db.products.update(item.productId, {
            stock: prod.stock + item.quantity,
          });
        }
      }
      await db.sales.delete(saleId);
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-6">
      {/* Period Filter Buttons */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <span className="text-xs sm:text-sm font-bold text-slate-700">{t.statsPeriod} :</span>
        </div>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              period === 'today' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.filterToday}
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              period === 'week' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.filterWeek}
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              period === 'month' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.filterMonth}
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              period === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.filterAll}
          </button>
        </div>
      </div>

      {/* HIGHLIGHT: FAYDA SAFIYA (NET PROFIT) CARD */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wide mb-2 backdrop-blur-xs">
              <Award className="w-4 h-4 text-amber-300" />
              <span>{t.beneficeNet}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              {netProfit.toLocaleString()} <span className="text-lg font-bold text-emerald-200">DA</span>
            </h2>
            <p className="text-xs text-emerald-100 mt-1">
              {lang === 'ar'
                ? `نسبة الفائدة الصافية: ${netMarginPercent}% من إجمالي المداخيل`
                : `Marge nette : ${netMarginPercent}% du chiffre d'affaires`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-black/20 p-3.5 rounded-2xl backdrop-blur-xs">
            <div>
              <span className="text-[11px] text-emerald-200 block">{t.margeBrute}</span>
              <span className="text-base sm:text-lg font-black text-white">
                +{totalGrossProfit.toLocaleString()} DA
              </span>
            </div>
            <div>
              <span className="text-[11px] text-emerald-200 block">{t.chargesTotales}</span>
              <span className="text-base sm:text-lg font-black text-red-300">
                -{totalExpenses.toLocaleString()} DA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CORE FINANCIAL METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Chiffre d'Affaires */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{t.chiffreAffaires}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900">
            {totalSalesAmount.toLocaleString()} <span className="text-xs font-semibold text-slate-400">DA</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {filteredSales.reduce((s, i) => s + i.totalItems, 0)} {lang === 'ar' ? 'قطعة بيعت' : 'articles vendus'}
          </span>
        </div>

        {/* Coût d'Achat Marchandise */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{t.costOfGoods}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-700">
            {totalCostOfGoodsSold.toLocaleString()} <span className="text-xs font-semibold text-slate-400">DA</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {lang === 'ar' ? 'رأس مال السلعة المباعة' : 'Coût d\'achat réel'}
          </span>
        </div>

        {/* Ras El Mal Stock Actuel */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{t.rasElMalStock}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-700">
            {currentStockCapital.toLocaleString()} <span className="text-xs font-semibold text-slate-400">DA</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {lang === 'ar' ? 'تباع بـ : ' : 'Valeur vente : '}{currentStockPotentialSales.toLocaleString()} DA
          </span>
        </div>

        {/* Dettes Fournisseurs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400">{t.dettesFournisseurs}</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-red-600">
            {totalDebts.toLocaleString()} <span className="text-xs font-semibold text-slate-400">DA</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {lang === 'ar' ? 'ديون لتجار الجملة' : 'À verser aux grossistes'}
          </span>
        </div>
      </div>

      {/* TWO COLUMNS: TOP PRODUCTS & RECENT SALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TOP 10 BEST SELLERS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-800">{t.topProducts}</h3>
          </div>

          {topProducts.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              {lang === 'ar' ? 'لا توجد مبيعات في هذه الفترة' : 'Aucune vente sur cette période'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {topProducts.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 truncate">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">{item.qty} {t.salesCount}</span>
                    <span className="text-[10px] text-emerald-700 font-bold">+{item.profit} DA fayda</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECENT SALES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-800">{t.recentSales}</h3>
          </div>

          {filteredSales.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              {lang === 'ar' ? 'لا توجد مبيعات في هذه الفترة' : 'Aucune vente sur cette période'}
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
              {filteredSales.slice(0, 15).map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800">
                        {sale.totalAmount} DA
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({sale.totalItems} art.) • {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                      {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 text-[11px]">
                      +{sale.grossProfit} DA
                    </span>
                    <button
                      onClick={() => handleCancelSale(sale.id!)}
                      title={lang === 'ar' ? 'إلغاء البيع واسترجاع السلع' : 'Annuler la vente'}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
