import { useState, useEffect } from "react";

// Інтерфейс для події, оскільки TypeScript не має його вбудованим
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(
      (window as any).__PWA_INSTALL_EVENT__ || null,
    );

  useEffect(() => {
    const handler = (e: Event) => {
      // Запобігаємо автоматичному показу стандартного банера браузера (міні-інфобару)
      e.preventDefault();
      // Зберігаємо подію, щоб викликати її пізніше при кліку на кнопку
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = async () => {
    if (!installEvent) return;
    // Показуємо системне вікно встановлення
    await installEvent.prompt();
    // Чекаємо на відповідь користувача
    await installEvent.userChoice;
    // Приховуємо кнопку після успішного встановлення
    setInstallEvent(null);
  };

  return { isInstallable: !!installEvent, promptInstall };
}
