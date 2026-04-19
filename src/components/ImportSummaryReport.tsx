import React, { useState } from 'react';
import { ImportMetrics } from '../hooks/useChunkedImport';
import { CheckCircle, Clock, Database, Tag, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface ImportSummaryReportProps {
  metrics: ImportMetrics;
  onRefresh: () => void;
}

export default function ImportSummaryReport({ metrics, onRefresh }: ImportSummaryReportProps) {
  const [showErrors, setShowErrors] = useState(false);

  const hasErrors = metrics.errors && metrics.errors.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-slate-800">
          {hasErrors ? (
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          ) : (
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          )}
          <h2 className="text-lg font-bold">Импорт завершен</h2>
        </div>
        <button 
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Обновить каталог
        </button>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Time */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">
              <Clock className="w-4 h-4" />
              <span>Время выполнения</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{metrics.totalExecutionTimeSeconds}</div>
            <div className="text-xs text-slate-500">Обработано {metrics.totalRowsProcessed} строк</div>
          </div>

          {/* Card 2: Inserted */}
          <div className="bg-white border border-emerald-100 rounded-xl p-4 flex flex-col gap-1 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-2 text-emerald-600 text-xs uppercase font-bold tracking-wider mb-1">
              <Database className="w-4 h-4" />
              <span>Новые товары</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">{metrics.insertedCount}</div>
            <div className="text-xs text-emerald-600/70">Создано позиций</div>
          </div>

          {/* Card 3: Updated */}
          <div className="bg-white border border-blue-100 rounded-xl p-4 flex flex-col gap-1 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-2 text-blue-600 text-xs uppercase font-bold tracking-wider mb-1">
              <Database className="w-4 h-4" />
              <span>Обновлено</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{metrics.updatedCount}</div>
            <div className="text-xs text-blue-600/70">Существующих карточек</div>
          </div>

          {/* Card 4: Brands */}
          <div className="bg-white border border-fuchsia-100 rounded-xl p-4 flex flex-col gap-1 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-fuchsia-50 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-2 text-fuchsia-600 text-xs uppercase font-bold tracking-wider mb-1">
              <Tag className="w-4 h-4" />
              <span>Новые бренды</span>
            </div>
            <div className="text-2xl font-bold text-fuchsia-700">{metrics.newBrandsCount}</div>
            <div className="text-xs text-fuchsia-600/70">Добавлено в справочник</div>
          </div>
        </div>

        {hasErrors && (
          <div className="mt-2 border border-amber-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => setShowErrors(!showErrors)}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-amber-800 text-sm font-bold"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Ошибок обработки: {metrics.errors.length}</span>
              </div>
              {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showErrors && (
              <div className="bg-white max-h-60 overflow-y-auto p-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="px-4 py-2 border-b border-slate-200">Артикул / Строка</th>
                      <th className="px-4 py-2 border-b border-slate-200 w-full">Причина ошибки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {metrics.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-xs">{err.identifier}</td>
                        <td className="px-4 py-2 text-rose-600">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
