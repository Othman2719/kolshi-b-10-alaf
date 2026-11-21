import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDatabase } from '../db/db';
import { translations, Language } from '../i18n/translations';
import { downloadDatabaseBackup, restoreDatabaseFromJson } from '../utils/backup';
import { exportAllToExcel } from '../utils/excel';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Smartphone,
  Globe,
  Store,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface SettingsViewProps {
  lang: Language;
  onLanguageChange: (newLang: Language) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ lang, onLanguageChange }) => {
  const t = translations[lang];
  const settings = useLiveQuery(() => db.settings.get('default_settings'));

  const [shopName, setShopName] = useState('كلشي ب 10 آلاف - 10 Alaf');
  const [shopPhone, setShopPhone] = useState('');
  const [shopWilaya, setShopWilaya] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  // PWA install prompt state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName || 'كلشي ب 10 آلاف - 10 Alaf');
      setShopPhone(settings.phone || '');
      setShopWilaya(settings.wilaya || '');
    }
  }, [settings]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) {
      alert(
        lang === 'ar'
          ? 'لتثبيت التطبيق على هاتفك: اضغط على خيارات المتصفح (⋮) ثم اختر "إضافة إلى الشاشة الرئيسية" (Ajouter à l\'écran d\'accueil).'
          : 'Pour installer l\'application sur votre téléphone : Ouvrez le menu de votre navigateur (⋮) puis choisissez "Ajouter à l\'écran d\'accueil".'
      );
      return;
    }

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsAppInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.settings.put({
      id: 'default_settings',
      shopName,
      phone: shopPhone,
      wilaya: shopWilaya,
      language: lang,
      currency: 'DA',
      fixedSellPrice: 100,
    });
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (confirm(t.restoreWarning)) {
      try {
        await restoreDatabaseFromJson(file);
        alert(lang === 'ar' ? 'تم استرجاع النسخة الاحتياطية بنجاح !' : 'Données restaurées avec succès !');
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Erreur lors de la restauration du fichier.');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetData = async () => {
    const code = prompt(
      lang === 'ar'
        ? 'تنبيه خطير: لحذف جميع البيانات وإعادة تعيين المحل اكتب "100" :'
        : 'ATTENTION : Pour réinitialiser le magasin et supprimer toutes les ventes/produits, tapez "100" :'
    );

    if (code === '100') {
      await db.delete();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-24 lg:pb-8">
      {/* PWA MOBILE INSTALL CARD */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black">{t.installAppTitle}</h3>
            <p className="text-xs text-emerald-100 mt-0.5 max-w-md">
              {t.installAppDesc}
            </p>
          </div>
        </div>

        <button
          onClick={handleInstallApp}
          className="w-full sm:w-auto px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 font-bold rounded-xl shadow text-xs sm:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          <span>{isAppInstalled ? t.alreadyInstalled : t.installButton}</span>
        </button>
      </div>

      {/* LANGUAGE SELECTOR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">{t.switchLanguage}</h4>
            <p className="text-xs text-slate-400">Français / العربية</p>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => onLanguageChange('fr')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              lang === 'fr'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🇫🇷 Français
          </button>
          <button
            onClick={() => onLanguageChange('ar')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              lang === 'ar'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🇩🇿 العربية
          </button>
        </div>
      </div>

      {/* BACKUP & RESTORE SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">{t.backupSection}</h4>
            <p className="text-xs text-slate-400">{t.backupDesc}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
          <button
            onClick={() => downloadDatabaseBackup()}
            className="p-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border border-purple-200"
          >
            <Download className="w-4 h-4" />
            <span>{t.downloadBackup}</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestoreFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200"
          >
            <Upload className="w-4 h-4" />
            <span>{t.restoreBackup}</span>
          </button>

          <button
            onClick={() => exportAllToExcel()}
            className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border border-emerald-200"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t.exportAllExcel}</span>
          </button>
        </div>
      </div>

      {/* SHOP PROFILE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800">
              {lang === 'ar' ? 'معلومات المحل' : 'Informations du Magasin'}
            </h4>
            <p className="text-xs text-slate-400">
              {lang === 'ar' ? 'تظهر في الفواتير والتقارير' : 'Affichées sur les reçus et rapports'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="flex flex-col gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {t.shopNameLabel}
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t.phone}
              </label>
              <input
                type="tel"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
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
                value={shopWilaya}
                onChange={(e) => setShopWilaya(e.target.value)}
                placeholder="Alger / Oran..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {isSavedToast ? (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {lang === 'ar' ? 'تم حفظ التعديلات !' : 'Modifications enregistrées !'}
              </span>
            ) : (
              <div />
            )}
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm active:scale-95 transition-all shadow-xs"
            >
              {t.save}
            </button>
          </div>
        </form>
      </div>

      {/* DANGER ZONE */}
      <div className="bg-red-50/50 border border-red-200 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <h5 className="font-bold text-xs text-red-800">
            {lang === 'ar' ? 'إعادة ضبط المحل (حذف كل البيانات)' : 'Réinitialiser toutes les données'}
          </h5>
          <p className="text-[11px] text-red-600">
            {lang === 'ar' ? 'يحذف السلع والمبيعات ويبدأ من جديد' : 'Efface les ventes, dépenses et stock'}
          </p>
        </div>
        <button
          onClick={handleResetData}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl active:scale-95"
        >
          {lang === 'ar' ? 'إعادة الضبط' : 'Réinitialiser'}
        </button>
      </div>
    </div>
  );
};
