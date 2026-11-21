import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, Keyboard } from 'lucide-react';
import { playBeep } from '../utils/audio';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  lang: 'fr' | 'ar';
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan, lang }) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-barcode-reader';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      setErrorMsg(null);
      setIsScanning(true);

      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!document.getElementById(scannerContainerId)) return;

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              playBeep('scan');
              onScan(decodedText);
              onClose();
            }
          },
          () => {}
        );
      } catch (err: unknown) {
        if (isMounted) {
          console.error('Camera error:', err);
          setErrorMsg(
            lang === 'ar'
              ? 'تعذر تشغيل الكاميرا. يرجى السماح بالإذن أو إدخال الكود يدوياً بالأسفل.'
              : 'Impossible d\'accéder à la caméra. Autorisez l\'accès ou tapez le code ci-dessous.'
          );
          setIsScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.debug('Error stopping scanner', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playBeep('scan');
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-emerald-600 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <h3 className="font-bold text-base">
              {lang === 'ar' ? 'مسح كود بار بالهاتف' : 'Scanner Code-barres'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-emerald-700 active:scale-95 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video Scanner Area */}
        <div className="relative bg-slate-950 min-h-[280px] flex flex-col items-center justify-center p-2">
          <div id={scannerContainerId} className="w-full max-w-sm rounded-lg overflow-hidden" />

          {/* Guide Overlay */}
          {isScanning && !errorMsg && (
            <div className="absolute pointer-events-none inset-0 flex items-center justify-center">
              <div className="border-2 border-emerald-400 border-dashed rounded-xl w-64 h-36 relative animate-pulse">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-md"></div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 text-center text-amber-200 flex flex-col items-center gap-2">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={lang === 'ar' ? 'أدخل الكود يدوياً...' : 'Saisir le code manuellement...'}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                autoFocus={!!errorMsg}
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow"
            >
              OK
            </button>
          </form>
          <p className="text-xs text-slate-500 text-center mt-2">
            {lang === 'ar'
              ? 'يدعم قارئ الباركود USB أو كاميرا الهاتف مباشرة'
              : 'Compatible avec douchette USB ou caméra du téléphone'}
          </p>
        </div>
      </div>
    </div>
  );
};
