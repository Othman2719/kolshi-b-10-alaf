import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Product, SaleItem } from '../types';
import type { Language } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { playBeep } from '../utils/audio';
import { BarcodeScanner } from './BarcodeScanner';
import confetti from 'canvas-confetti';
import {
  Search,
  Camera,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  RotateCcw,
  X,
  ArrowRight,
  ChevronUp,
} from 'lucide-react';
import { INITIAL_CATEGORIES } from '../db/initialData';

interface PosViewProps {
  lang: Language;
}

export const PosView: React.FC<PosViewProps> = ({ lang }) => {
  const t = translations[lang];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [cashGiven, setCashGiven] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<{
    id: number;
    items: SaleItem[];
    totalAmount: number;
    cashGiven: number;
    changeReturned: number;
    date: string;
  } | null>(null);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.nameAr && p.nameAr.includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Handle Barcode Scanned
  const handleBarcodeScanned = (barcode: string) => {
    const matched = products.find(
      (p) => p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase().trim()
    );
    if (matched) {
      addToCart(matched);
    } else {
      playBeep('alert');
      alert(
        lang === 'ar'
          ? `السلعة بالكود [${barcode}] غير موجودة في المخزن!`
          : `Produit avec code-barres [${barcode}] non trouvé !`
      );
    }
  };

  // Listen for keyboard barcode scanner input (USB scanners act as keyboard + Enter)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          handleBarcodeScanned(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Cart calculations
  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );
  const totalAmount = totalItems * 100; // Fixed 100 DA per item!

  const numericCashGiven = parseFloat(cashGiven) || 0;
  const changeToReturn = Math.max(0, numericCashGiven - totalAmount);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      playBeep('alert');
      return;
    }

    playBeep('scan');
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          playBeep('alert');
          return prevCart;
        }
        return prevCart.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * 100 } : i
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product.id!,
            productName: lang === 'ar' && product.nameAr ? product.nameAr : product.name,
            buyPrice: product.buyPrice,
            sellPrice: 100,
            quantity: 1,
            total: 100,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty > product.stock) {
              playBeep('alert');
              return item;
            }
            return newQty > 0
              ? { ...item, quantity: newQty, total: newQty * 100 }
              : null;
          }
          return item;
        })
        .filter(Boolean) as SaleItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashGiven('');
  };

  // Complete Sale
  const handleValidateSale = async () => {
    if (cart.length === 0) return;

    const totalCost = cart.reduce((sum, item) => sum + item.buyPrice * item.quantity, 0);
    const grossProfit = totalAmount - totalCost;
    const finalCashGiven = numericCashGiven > 0 ? numericCashGiven : totalAmount;
    const finalChange = Math.max(0, finalCashGiven - totalAmount);

    const now = new Date();
    const saleRecord = {
      date: now.toISOString().split('T')[0],
      timestamp: now.getTime(),
      items: cart,
      totalItems,
      totalAmount,
      totalCost,
      grossProfit,
      cashGiven: finalCashGiven,
      changeReturned: finalChange,
    };

    try {
      await db.transaction('rw', [db.products, db.sales], async () => {
        const saleId = await db.sales.add(saleRecord);

        for (const item of cart) {
          const prod = await db.products.get(item.productId);
          if (prod) {
            await db.products.update(item.productId, {
              stock: Math.max(0, prod.stock - item.quantity),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        setLastSaleReceipt({
          id: saleId as number,
          items: [...cart],
          totalAmount,
          cashGiven: finalCashGiven,
          changeReturned: finalChange,
          date: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      });

      playBeep('success');
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
        });
      } catch (e) {
        // fallback
      }

      setCart([]);
      setCashGiven('');
      setIsMobileCartOpen(false);
    } catch (err) {
      console.error('Error validating sale:', err);
      alert('Erreur lors de la validation de la vente.');
    }
  };

  // Render the cart details (reused between desktop sidebar & mobile drawer)
  const renderCartContent = () => (
    <div className="flex flex-col h-full">
      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[140px] max-h-[40vh] lg:max-h-none">
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <ShoppingCart className="w-12 h-12 text-slate-300 stroke-[1.5] mb-2" />
            <p className="text-sm font-medium">{t.emptyCart}</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.productId}
              className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {item.productName}
                </p>
                <p className="text-[11px] text-emerald-700 font-bold">
                  {item.quantity} × 100 DA = {item.total} DA
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateQuantity(item.productId, -1)}
                  className="w-7 h-7 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center justify-center text-slate-700 active:scale-90 font-bold"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-black text-slate-900">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.productId, 1)}
                  className="w-7 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center active:scale-90 font-bold shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Calculation & Payment */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
        {/* Total Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div>
            <span className="text-xs text-emerald-800 font-medium">
              {t.totalArticles}: <b className="text-sm">{totalItems}</b>
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-emerald-800 font-medium block">
              {t.totalToPay}
            </span>
            <span className="text-2xl font-black text-emerald-700">
              {totalAmount} <span className="text-xs">DA</span>
            </span>
          </div>
        </div>

        {/* Quick Cash Presets */}
        {cart.length > 0 && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCashGiven(totalAmount.toString())}
              className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 active:scale-95 transition-all text-center"
            >
              {t.quickCashExact}
            </button>
            {[500, 1000, 2000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setCashGiven(amt.toString())}
                className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 active:scale-95 transition-all text-center"
              >
                {amt} DA
              </button>
            ))}
          </div>
        )}

        {/* Cash Given & Change */}
        {cart.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {t.cashGiven}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  placeholder={totalAmount.toString()}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  DA
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {t.changeToReturn}
              </label>
              <div className="px-3 py-2 bg-white border border-slate-300 rounded-xl flex items-center justify-between">
                <span
                  className={`text-base font-black ${
                    changeToReturn > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {changeToReturn}
                </span>
                <span className="text-xs font-bold text-slate-400">DA</span>
              </div>
            </div>
          </div>
        )}

        {/* Validate Button */}
        <button
          type="button"
          disabled={cart.length === 0}
          onClick={handleValidateSale}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-black rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-5 h-5" />
          <span>
            {t.validateSale} ({totalAmount} DA)
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-140px)] pb-28 lg:pb-0">
      {/* LEFT: PRODUCTS CATALOG & SEARCH */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Search & Actions */}
        <div className="p-3 border-b border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchProductPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">{t.scanBarcode}</span>
            </button>

            {/* Mobile Cart Button Icon */}
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="lg:hidden relative p-2.5 bg-slate-900 text-white rounded-xl shadow-xs active:scale-95 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-bold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {t.allCategories}
            </button>
            {INITIAL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.nameFr)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-bold transition-all ${
                  selectedCategory === cat.nameFr
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {lang === 'ar' ? cat.nameAr : cat.nameFr}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 auto-rows-max">
          {filteredProducts.map((p) => {
            const inCart = cart.find((i) => i.productId === p.id);
            const isOutOfStock = p.stock <= 0;
            const isLowStock = p.stock > 0 && p.stock <= p.alertThreshold;

            return (
              <button
                key={p.id}
                disabled={isOutOfStock}
                onClick={() => addToCart(p)}
                className={`relative flex flex-col justify-between p-3 rounded-xl border text-left transition-all active:scale-95 ${
                  isOutOfStock
                    ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                    : inCart
                    ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                }`}
              >
                {/* 100 DA Badge */}
                <span className="absolute top-2 right-2 bg-emerald-700 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                  100 DA
                </span>

                {/* In Cart Counter Badge */}
                {inCart && (
                  <span className="absolute top-2 left-2 bg-emerald-600 text-white font-extrabold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {inCart.quantity}
                  </span>
                )}

                <div className="mt-4 mb-2">
                  <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                    {lang === 'ar' && p.nameAr ? p.nameAr : p.name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{p.category}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 w-full">
                  <span
                    className={`font-semibold ${
                      isOutOfStock
                        ? 'text-red-500'
                        : isLowStock
                        ? 'text-amber-600'
                        : 'text-slate-500'
                    }`}
                  >
                    {isOutOfStock ? t.outOfStock : `${p.stock} ${t.itemsLeft}`}
                  </span>
                  <span className="text-emerald-700 font-extrabold">100 DA</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP RIGHT SIDEBAR: CART (VISIBLE ON LG+) */}
      <div className="hidden lg:flex w-96 flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Cart Header */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-base">{t.cartTitle}</h2>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.cancelSale}</span>
            </button>
          )}
        </div>
        {renderCartContent()}
      </div>

      {/* MOBILE FLOATING STICKY CHECKOUT BAR (VISIBLE ON MOBILE ONLY) */}
      <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-800">
        <div
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-2.5 cursor-pointer flex-1"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-sm text-white shadow-xs">
            {totalItems}
          </div>
          <div>
            <span className="text-xs text-slate-300 block">
              {totalItems} {lang === 'ar' ? 'سلعة في السلة' : 'articles'}
            </span>
            <span className="text-lg font-black text-emerald-400">
              {totalAmount} <span className="text-xs">DA</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          disabled={cart.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
        >
          <span>{lang === 'ar' ? 'تأكيد الحساب' : 'Encaisser'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* MOBILE CART BOTTOM DRAWER / MODAL */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">
                  {t.cartTitle} ({totalItems})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded"
                  >
                    {t.cancelSale}
                  </button>
                )}
                <button
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Cart content inside drawer */}
            <div className="overflow-y-auto">
              {renderCartContent()}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        lang={lang}
      />

      {/* Receipt Modal on Successful Sale */}
      {lastSaleReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">
              {lang === 'ar' ? 'تم تسجيل البيع بنجاح !' : 'Vente Validée !'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Ticket #{lastSaleReceipt.id} • {lastSaleReceipt.date}
            </p>

            {/* Receipt Summary Card */}
            <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 mb-4 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{t.totalArticles} :</span>
                <span className="font-bold text-slate-900">
                  {lastSaleReceipt.items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>{t.totalToPay} :</span>
                <span className="text-emerald-700">
                  {lastSaleReceipt.totalAmount} DA
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>{t.cashGiven} :</span>
                <span className="font-bold">{lastSaleReceipt.cashGiven} DA</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-amber-600 bg-amber-50 p-2 rounded-lg">
                <span>{t.changeToReturn} :</span>
                <span className="font-black">
                  {lastSaleReceipt.changeReturned} DA
                </span>
              </div>
            </div>

            <button
              onClick={() => setLastSaleReceipt(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
            >
              {lang === 'ar' ? 'متابعة البيع (التالي)' : 'Continuer / Vente Suivante'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
