import { useState } from "react";
import { FileSpreadsheet, Download, Share2, Mail, Trash2 } from "lucide-react";
import { SavedSession } from "../types";
import AndroidGuide from "./AndroidGuide";

interface SlideHistoryProps {
  savedSessions: SavedSession[];
  handleDownloadSessionCSV: (id: string, name: string, comment?: string) => void;
  handleShareSessionFile: (id: string, name: string, comment?: string) => void;
  handleSessionDelete: (id: string) => void;
}

export default function SlideHistory({
  savedSessions,
  handleDownloadSessionCSV,
  handleShareSessionFile,
  handleSessionDelete
}: SlideHistoryProps) {
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-fadeIn" id="slide_history">
      
      {/* SAVED HISTORICAL LOG TRACK SESSIONS LIST */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
            <h2 className="text-sm font-semibold font-sans text-slate-200">Архів та Історія Сесій Збережених Логів</h2>
          </div>
          <span className="text-[10px] font-mono text-slate-450 bg-slate-950 px-2 py-0.5 rounded">HTML5 сховище</span>
        </div>

        {savedSessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-3 border border-dashed border-slate-800 rounded-xl" id="no_sessions_empty">
            <FileSpreadsheet className="w-10 h-10 text-slate-700" />
            <div>
              <p className="font-semibold text-slate-400">Поки немає збережених сесій.</p>
              <p className="mt-1 text-[11px] text-slate-500">Розпочніть запис у першому модулі, пройдіть дистанцію та натисніть "Зберегти & Зупинити".</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-3 px-2">Файл (Р_М_Д_Г_Х_С)</th>
                  <th className="py-3 px-2 text-center">Дата сесії</th>
                  <th className="py-3 px-2 text-right">Точок</th>
                  <th className="py-3 px-2 text-center">Опції передачі</th>
                  <th className="py-3 px-2 text-right text-rose-500/80">Керування</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {savedSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-950/40 transition-colors">
                    <td className="py-3.5 px-2">
                      <div className="font-bold text-slate-200 font-mono">{session.name}</div>
                      {session.comment && (
                        <div className="text-[11px] text-emerald-400 mt-1 italic max-w-[200px] truncate" title={session.comment}>
                          💬 {session.comment}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-2 text-center text-slate-400">{session.date}</td>
                    <td className="py-3.5 px-2 text-right font-mono font-bold text-emerald-400">
                      {session.count}
                    </td>
                    <td className="py-3.5 px-2">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Download CSV button */}
                        <button
                          onClick={() => handleDownloadSessionCSV(session.id, session.name, session.comment)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 cursor-pointer text-[12px] font-semibold flex items-center gap-1"
                          title="Скачати CSV файл на накопичувач"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>

                        {/* Share/Send via BT or Email button */}
                        <button
                          onClick={() => handleShareSessionFile(session.id, session.name, session.comment)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/10 cursor-pointer text-[12px] font-semibold flex items-center gap-1.5"
                          title="Поділитися файлом по Bluetooth, Email, Месенджери (Share API)"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <Mail className="w-3.5 h-3.5 text-blue-400/80" />
                          <span>Відправити</span>
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      {deletingSessionId === session.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              handleSessionDelete(session.id);
                              setDeletingSessionId(null);
                            }}
                            className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] uppercase font-bold cursor-pointer font-mono shadow-sm"
                          >
                            Дійсно?
                          </button>
                          <button
                            onClick={() => setDeletingSessionId(null)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] uppercase font-bold cursor-pointer font-mono shadow-sm"
                          >
                            Ні
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingSessionId(session.id)}
                          className="p-1.5 rounded-lg bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 hover:text-rose-450 border border-rose-500/10 cursor-pointer inline-flex items-center"
                          title="Вилучити сесію з пристрою"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ANDROID COMPATIBILITY GUIDE */}
      <AndroidGuide />

    </div>
  );
}
