import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const InstallPWAButton: React.FC = () => {
  const { isInstallable, promptInstall } = usePWAInstall();

  // Якщо застосунок вже встановлено або браузер не підтримує подію — приховуємо кнопку
  if (!isInstallable) {
    return null;
  }

  return (
    <button
      onClick={promptInstall}
      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg shadow-md hover:bg-slate-700 transition-colors border border-slate-700"
      aria-label="Встановити додаток"
    >
      <Download size={20} />
      <span className="font-medium">Встановити додаток</span>
    </button>
  );
};