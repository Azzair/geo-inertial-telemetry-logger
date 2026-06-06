/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Compass, HelpCircle, ShieldAlert, Cpu, Smartphone, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AndroidGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <HelpCircle className="w-5 h-5" id="guide_icon" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-sans">
              Інструкція та налаштування для Android
            </h3>
            <p className="text-xs text-slate-400">
              Як отримати максимальну точність та частоту 10-20Гц у фоновому режимі
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-mono px-3 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
        >
          {isOpen ? "Сховати" : "Читати інструкцію"}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-5 border-t border-slate-800/80 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
              
              {/* Box 1: GPS Frequency Limit */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100 mb-1 font-mono">Обмеження GPS у браузері</h4>
                  <p className="text-slate-450 leading-relaxed">
                    Стандартний браузерний API геолокації (на будь-якому телефоні) оновлює координати максимум з частотою <strong className="text-emerald-400">1 Гц (раз на секунду)</strong>.
                    Щоб вирішити це, наш застосунок використовує **сенсорну інтеграцію (Sensor Fusion)**: ми поєднуємо покази секундного GPS з даними високочастотного акселерометра (10-20Гц), розраховуючи проміжні координати методом екстраполяції в реальному часі.
                  </p>
                </div>
              </div>

              {/* Box 2: Enabling Sensors in Chrome */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex gap-3">
                <Cpu className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100 mb-1 font-mono">Активація сенсорів у Chrome Android</h4>
                  <p className="text-slate-450 leading-relaxed">
                    Для повнофункціональної роботи інерційних датчиків на високій частоті:
                  </p>
                  <ol className="list-decimal pl-4 mt-1.5 space-y-1 text-slate-400">
                    <li>Відкрийте нову вкладку в Chrome і перейдіть за адресою <code className="text-indigo-300 bg-indigo-950/50 px-1 rounded font-mono">chrome://flags</code></li>
                    <li>Знайдіть опцію <strong className="text-slate-200">"Generic Sensor Extra Classes"</strong> та увімкніть її (<strong className="text-emerald-400">Enabled</strong>).</li>
                    <li>Перезапустіть браузер (кнопка Relaunch). Це відкриє повний швидкісний доступ до гіроскопа.</li>
                  </ol>
                </div>
              </div>

              {/* Box 3: Background execution workaround */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex gap-3">
                <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100 mb-1 font-mono">Автономний та фоновий режими</h4>
                  <p className="text-slate-450 leading-relaxed">
                    Сили енергозбереження Android зупиняють роботу JS у фонових вкладках. Способи обійти це:
                  </p>
                  <ul className="list-disc pl-4 mt-1.5 space-y-1 text-slate-400">
                    <li><strong className="text-emerald-400">Екранний замок:</strong> Застосуйте вбудований «Wake Lock» (активується автоматично при старті запису), який триматиме екран постійно ввімкненим (можна зменшити яскравість до мінімуму для збереження батареї).</li>
                    <li><strong className="text-emerald-400">Режим спліту/плаваючого вікна:</strong> Відкрийте Chrome як плаваюче вікно поверх навігатора чи будь-якого іншого додатка.</li>
                  </ul>
                </div>
              </div>

              {/* Box 4: Export details */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex gap-3">
                <Download className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100 mb-1 font-mono">Експорт файлів CSV/TXT</h4>
                  <p className="text-slate-450 leading-relaxed">
                    При зупинці логування дані миттєво зберігаються у локальну пам’ять пристрою (IndexedDB) та генеруються у вигляді CSV файлу з розділювачем кома.
                    Такий файл імпортується у будь-яку програму типу Excel, Python Pandas чи Matlab як для аналізу швидкості/траєкторій з фільтрацією, так і для відстеження висоти.
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
