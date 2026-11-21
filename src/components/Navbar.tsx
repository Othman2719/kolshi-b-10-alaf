import React from 'react';
import { translations, Language } from '../i18n/translations';
import {
  ShoppingCart,
  Package,
  Users,
  Wallet,
  TrendingUp,
  Settings,
  Globe,
} from 'lucide-react';

export type ActiveTab = 'pos' | 'stock' | 'suppliers' | 'expenses' | 'dashboard' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  shopName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  lang,
  onLanguageChange,
  shopName,
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'pos' as ActiveTab, label: t.navPos, icon: ShoppingCart, badge: '100 DA' },
    { id: 'stock' as ActiveTab, label: t.navStock, icon: Package },
    { id: 'suppliers' as ActiveTab, label: t.navSuppliers, icon: Users },
    { id: 'expenses' as ActiveTab, label: t.navExpenses, icon: Wallet },
    { id: 'dashboard' as ActiveTab, label: t.navDashboard, icon: TrendingUp },
    { id: 'settings' as ActiveTab, label: t.navSettings, icon: Settings },
  ];

  return (
    <>
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <span className="font-black text-xs leading-none">100</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {shopName}
              </h1>
              <span className="hidden sm:inline-block bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                {t.fixedPriceBadge}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5 hidden sm:block">
              {t.shopSubtitle}
            </p>
          </div>
        </div>

        {/* DESKTOP NAV TABS */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && !isActive && (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* LANGUAGE QUICK TOGGLE */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLanguageChange(lang === 'fr' ? 'ar' : 'fr')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 border border-slate-200"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>{lang === 'fr' ? 'العربية 🇩🇿' : 'Français 🇫🇷'}</span>
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all active:scale-90 relative ${
                isActive
                  ? 'text-emerald-700 font-black'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-emerald-50 text-emerald-700 scale-110' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 whitespace-nowrap leading-tight">
                {item.label.split(' ')[0]}
              </span>
              {item.badge && isActive && (
                <span className="absolute -top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
