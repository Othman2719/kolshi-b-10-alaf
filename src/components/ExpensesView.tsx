import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Expense, ExpenseCategory } from '../types';
import { translations, Language } from '../i18n/translations';
import {
  Wallet,
  Plus,
  Trash2,
  Calendar,
  Tag,
  DollarSign,
  TrendingDown,
  X,
  Clock,
} from 'lucide-react';

interface ExpensesViewProps {
  lang: Language;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Loyer / كراء',
  'Électricité & Eau / كهرباء وماء',
  'Transport / نقل السلعة',
  'Sachets & Emballage / أكياس وتغليف',
  'Salaire employé / راتب العامل',
  'Repas & Café / وجبات وقهوة',
  'Entretien & Réparation / صيانة وتصليح',
  'Autre / مصاريف أخرى',
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({ lang }) => {
  const t = translations[lang];
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) || [];

  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [formCategory, setFormCategory] = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState<string>('');

  // Date filters
  const filteredExpenses = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    return expenses.filter((e) => {
      if (filterPeriod === 'today') {
        return e.date === todayStr;
      }
      if (filterPeriod === 'week') {
        const expenseDate = new Date(e.date);
        const diffDays = (now.getTime() - expenseDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (filterPeriod === 'month') {
        const currentMonth = todayStr.substring(0, 7); // YYYY-MM
        return e.date.startsWith(currentMonth);
      }
      return true;
    });
  }, [expenses, filterPeriod]);

  // Statistics
  const todayTotal = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return expenses
      .filter((e) => e.date === todayStr)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const monthTotal = useMemo(() => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    return expenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const periodTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount) || 0;
    if (amount <= 0) return;

    await db.expenses.add({
      category: formCategory,
      amount,
      date: formDate,
      notes: formNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    setFormAmount('');
    setFormNotes('');
    setIsModalOpen(false);
  };

  const handleDeleteExpense = async (id: number) => {
    if (confirm(lang === 'ar' ? 'هل تريد حذف هذه المصاريف ؟' : 'Supprimer cette dépense ?')) {
      await db.expenses.delete(id);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">
              {lang === 'ar' ? 'مصاريف اليوم' : 'Charges Aujourd\'hui'}
            </span>
            <span className="text-2xl font-black text-slate-800">
              {todayTotal.toLocaleString()} <span className="text-sm">DA</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">
              {lang === 'ar' ? 'مصاريف هذا الشهر' : 'Charges de ce Mois'}
            </span>
            <span className="text-2xl font-black text-red-600">
              {monthTotal.toLocaleString()} <span className="text-sm">DA</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">
              {t.totalExpensesPeriod}
            </span>
            <span className="text-2xl font-black text-purple-700">
              {periodTotal.toLocaleString()} <span className="text-sm">DA</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Header & Period Filter */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setFilterPeriod('today')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all ${
              filterPeriod === 'today'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterToday}
          </button>
          <button
            onClick={() => setFilterPeriod('week')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all ${
              filterPeriod === 'week'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterWeek}
          </button>
          <button
            onClick={() => setFilterPeriod('month')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all ${
              filterPeriod === 'month'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterMonth}
          </button>
          <button
            onClick={() => setFilterPeriod('all')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all ${
              filterPeriod === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterAll}
          </button>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addExpense}</span>
        </button>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {t.noExpenses}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{exp.category}</h4>
                    <p className="text-xs text-slate-400">
                      {exp.date} {exp.notes && `• « ${exp.notes} »`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-black text-red-600">
                    -{exp.amount.toLocaleString()} <span className="text-xs">DA</span>
                  </span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id!)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
              <h3 className="font-bold text-base">{t.addExpense}</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.expenseCategory} *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.expenseAmount} *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-black text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.date}
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t.notes}
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: 200 sachets 100 DA ou transport sel3a"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!formAmount}
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
