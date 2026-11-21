import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDatabase } from './db/db';
import { Language } from './i18n/translations';
import { Navbar, ActiveTab } from './components/Navbar';
import { PosView } from './components/PosView';
import { StockView } from './components/StockView';
import { SuppliersView } from './components/SuppliersView';
import { ExpensesView } from './components/ExpensesView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { WifiOff } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [lang, setLang] = useState<Language>('fr');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const settings = useLiveQuery(() => db.settings.get('default_settings'));

  // Initialize database with starter products and categories
  useEffect(() => {
    initDatabase();
  }, []);

  // Sync settings when loaded
  useEffect(() => {
    if (settings && settings.language) {
      setLang(settings.language);
    }
  }, [settings]);

  // Adjust document dir and lang attribute
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Network offline/online listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLanguageChange = async (newLang: Language) => {
    setLang(newLang);
    await db.settings.update('default_settings', { language: newLang });
  };

  const shopName = settings?.shopName || (lang === 'ar' ? 'كلشي ب 10 آلاف' : 'Hanout 10 Alaf');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Offline Toast Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-sm">
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            {lang === 'ar'
              ? 'أنت تعمل حالياً بدون إنترنت (Offline). التطبيق يسجل كل العمليات محلياً بأمان تام.'
              : 'Mode Hors-ligne actif. Vos ventes et données sont enregistrées en toute sécurité sur votre téléphone.'}
          </span>
        </div>
      )}

      {/* Top Navbar & Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lang={lang}
        onLanguageChange={handleLanguageChange}
        shopName={shopName}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6">
        {activeTab === 'pos' && <PosView lang={lang} />}
        {activeTab === 'stock' && <StockView lang={lang} />}
        {activeTab === 'suppliers' && <SuppliersView lang={lang} />}
        {activeTab === 'expenses' && <ExpensesView lang={lang} />}
        {activeTab === 'dashboard' && <DashboardView lang={lang} />}
        {activeTab === 'settings' && (
          <SettingsView lang={lang} onLanguageChange={handleLanguageChange} />
        )}
      </main>
    </div>
  );
}

export default App;
