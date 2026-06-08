import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Помилка реєстрації Service Worker:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-slate-800 text-slate-100 rounded-xl shadow-2xl border border-slate-700 flex flex-col gap-3">
      <div className="text-sm font-medium">
        {offlineReady ? (
          <span>Додаток готовий до роботи в офлайні!</span>
        ) : (
          <span>Доступна нова версія, оновити?</span>
        )}
      </div>
      <div className="flex gap-2">
        {needRefresh && (
          <button className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium transition-colors text-white" onClick={() => updateServiceWorker(true)}>
            Оновити
          </button>
        )}
        <button className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm font-medium transition-colors text-white" onClick={() => close()}>
          Закрити
        </button>
      </div>
    </div>
  );
};