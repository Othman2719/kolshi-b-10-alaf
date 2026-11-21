import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Product } from '../types';
import { translations, Language } from '../i18n/translations';
import { INITIAL_CATEGORIES } from '../db/initialData';
import { exportAllToExcel, importProductsFromExcel } from '../utils/excel';
import { BarcodeScanner } from './BarcodeScanner';
import {
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Upload,
  Camera,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
  Layers,
  Coins,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';

interface StockViewProps {
  lang: Language;
}

export const StockView: React.FC<StockViewProps> = ({ lang }) => {
  const t = translations[lang];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formCategory, setFormCategory] = useState(INITIAL_CATEGORIES[0].nameFr);
  const [formBuyPrice, setFormBuyPrice] = useState<number>(60);
  const [formStock, setFormStock] = useState<number>(20);
  const [formAlertThreshold, setFormAlertThreshold] = useState<number>(5);
  const [formBarcode, setFormBarcode] = useState('');

  // Total Stock Valuation (Ras El Mal)
  const totalStockValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock * p.buyPrice, 0);
  }, [products]);

  const totalItemsCount = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock, 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= p.alertThreshold).length;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.nameAr && p.nameAr.includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term));
      const matchesAlert = !onlyAlerts || p.stock <= p.alertThreshold;
      return matchesCategory && matchesSearch && matchesAlert;
    });
  }, [products, selectedCategory, searchTerm, onlyAlerts]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormNameAr('');
    setFormCategory(INITIAL_CATEGORIES[0].nameFr);
    setFormBuyPrice(60);
    setFormStock(20);
    setFormAlertThreshold(5);
    setFormBarcode('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormNameAr(p.nameAr || '');
    setFormCategory(p.category);
    setFormBuyPrice(p.buyPrice);
    setFormStock(p.stock);
    setFormAlertThreshold(p.alertThreshold);
    setFormBarcode(p.barcode || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const now = new Date().toISOString();
    const productData = {
      name: formName.trim(),
      nameAr: formNameAr.trim() || undefined,
      category: formCategory,
      buyPrice: Number(formBuyPrice) || 60,
      sellPrice: 100, // Fixed 100 DA
      stock: Math.max(0, Number(formStock) || 0),
      alertThreshold: Number(formAlertThreshold) || 5,
      barcode: formBarcode.trim() || undefined,
      updatedAt: now,
    };

    try {
      if (editingProduct && editingProduct.id) {
        await db.products.update(editingProduct.id, productData);
      } else {
        await db.products.add({
          ...productData,
          createdAt: now,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm(t.deleteConfirm)) {
      await db.products.delete(id);
    }
  };

  const handleQuickStockUpdate = async (id: number, delta: number) => {
    const p = await db.products.get(id);
    if (p) {
      await db.products.update(id, {
        stock: Math.max(0, p.stock + delta),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const count = await importProductsFromExcel(file);
      alert(
        lang === 'ar'
          ? `تم استيراد ${count} سلعة بنجاح إلى المخزن!`
          : `${count} produits importés avec succès !`
      );
    } catch (err) {
      console.error('Excel import error:', err);
      alert('Erreur lors de l\'importation Excel');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-6">
      {/* Top Stat Cards: Capital / Stock Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">
              {t.totalStockValuation}
            </span>
            <span className="text-lg md:text-xl font-black text-emerald-700">
              {totalStockValuation.toLocaleString()} <span className="text-xs">DA</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">
              {t.totalProductsCount}
            </span>
            <span className="text-lg md:text-xl font-black text-slate-800">
              {products.length} <span className="text-xs font-normal text-slate-500">articles</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">
              {lang === 'ar' ? 'مجموع القطع في المحل' : 'Total Pièces Magasin'}
            </span>
            <span className="text-lg md:text-xl font-black text-slate-800">
              {totalItemsCount.toLocaleString()} <span className="text-xs font-normal text-slate-500">pièces</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setOnlyAlerts(!onlyAlerts)}
          className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 ${
            onlyAlerts
              ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400'
              : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              lowStockCount > 0
                ? 'bg-amber-100 text-amber-700 animate-pulse'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">
              {t.stockAlertTitle}
            </span>
            <span
              className={`text-lg md:text-xl font-black ${
                lowStockCount > 0 ? 'text-amber-600' : 'text-slate-600'
              }`}
            >
              {lowStockCount} <span className="text-xs font-normal text-slate-500">faibles</span>
            </span>
          </div>
        </button>
      </div>

      {/* Action Header & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.search}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Categories */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">{t.allCategories}</option>
          {INITIAL_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.nameFr}>
              {lang === 'ar' ? cat.nameAr : cat.nameFr}
            </option>
          ))}
        </select>

        {/* Buttons: Add & Excel */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelImport}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title={t.importExcel}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 text-xs"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t.importExcel}</span>
          </button>

          <button
            onClick={() => exportAllToExcel()}
            title={t.exportExcel}
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 text-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">{t.exportExcel}</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addProduct}</span>
          </button>
        </div>
      </div>

      {/* Products Table / Mobile Card List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">{t.productName}</th>
                <th className="py-3 px-4">{t.category}</th>
                <th className="py-3 px-4">{t.buyPrice}</th>
                <th className="py-3 px-4">{t.sellPrice}</th>
                <th className="py-3 px-4">{t.currentStock}</th>
                <th className="py-3 px-4">{lang === 'ar' ? 'رأس مال هذا المنتوج' : 'Valeur Stock'}</th>
                <th className="py-3 px-4">{t.barcode}</th>
                <th className="py-3 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isLow = p.stock <= p.alertThreshold;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{p.name}</p>
                      {p.nameAr && <p className="text-xs text-slate-400">{p.nameAr}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">
                      {p.buyPrice} <span className="text-xs text-slate-400">DA</span>
                    </td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      100 DA
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuickStockUpdate(p.id!, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                        >
                          -
                        </button>
                        <span
                          className={`font-black px-2 py-0.5 rounded text-xs ${
                            isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {p.stock}
                        </span>
                        <button
                          onClick={() => handleQuickStockUpdate(p.id!, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">
                      {(p.stock * p.buyPrice).toLocaleString()}{' '}
                      <span className="text-xs text-slate-400">DA</span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      {p.barcode || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id!)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards List View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredProducts.map((p) => {
            const isLow = p.stock <= p.alertThreshold;
            return (
              <div key={p.id} className="p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{p.name}</h4>
                    {p.nameAr && <p className="text-xs text-slate-400">{p.nameAr}</p>}
                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                      {p.category}
                    </span>
                  </div>
                  <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs">
                    100 DA
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="text-slate-500">
                    {t.buyPrice}: <b className="text-slate-800">{p.buyPrice} DA</b> • {lang === 'ar' ? 'فائدة القطعة' : 'Marge'}:{' '}
                    <b className="text-emerald-700">+{100 - p.buyPrice} DA</b>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleQuickStockUpdate(p.id!, -1)}
                      className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <span
                      className={`font-black px-2 py-0.5 rounded text-xs ${
                        isLow ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {p.stock}
                    </span>
                    <button
                      onClick={() => handleQuickStockUpdate(p.id!, 1)}
                      className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-1 text-slate-400 hover:text-emerald-600 ml-1"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id!)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
              <h3 className="font-bold text-base">
                {editingProduct ? t.editProduct : t.addProduct}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.productName} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Assiette plate blanche"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.productNameAr}
                </label>
                <input
                  type="text"
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  placeholder="مثال: صحن مسطح أبيض"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.category}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    {INITIAL_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.nameFr}>
                        {lang === 'ar' ? cat.nameAr : cat.nameFr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.sellPrice}
                  </label>
                  <input
                    type="text"
                    disabled
                    value="100 DA Fixe"
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-black rounded-xl text-sm text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.buyPrice} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="99"
                    value={formBuyPrice}
                    onChange={(e) => setFormBuyPrice(Number(e.target.value))}
                    placeholder="60"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                    Fayda = +{100 - (Number(formBuyPrice) || 0)} DA / pièce
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.currentStock}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.barcode} (Optionnel)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="1000123..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-700"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-95"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal for form input */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setFormBarcode(code)}
        lang={lang}
      />
    </div>
  );
};
