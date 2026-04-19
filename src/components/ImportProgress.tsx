import React from 'react';

interface ImportProgressProps {
  isImporting: boolean;
  totalCount: number;
  processedCount: number;
  progress: number;
  errors: { identifier: string; reason: string }[];
}

export const ImportProgress: React.FC<ImportProgressProps> = ({
  isImporting,
  totalCount,
  processedCount,
  progress,
  errors
}) => {
  if (!isImporting && totalCount === 0 && errors.length === 0) return null;

  return (
    <div className="w-full bg-white border border-slate-200 p-4 shadow-sm my-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">
          Импорт данных
        </span>
        <span className="text-sm text-slate-600 font-mono font-medium">
          {processedCount} / {totalCount}
        </span>
      </div>
      
      <div className="w-full bg-slate-100 h-2 overflow-hidden">
        <div 
          className="bg-slate-900 h-full transition-all duration-300 ease-in-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between items-start">
        <span className="text-xs text-slate-500 font-medium">
          {isImporting ? 'Обработка пакетов...' : 'Импорт завершен'}
        </span>
        
        {errors.length > 0 && (
          <div className="text-right flex flex-col items-end">
            <span className="text-xs font-bold text-red-600 uppercase">
              Ошибок: {errors.length}
            </span>
            <div className="max-h-20 overflow-y-auto mt-1 flex flex-col gap-1 w-64">
              {errors.slice(0, 5).map((e, idx) => (
                <span key={idx} className="text-[10px] text-red-500 font-mono truncate">
                  {e.identifier}: {e.reason}
                </span>
              ))}
              {errors.length > 5 && (
                <span className="text-[10px] text-red-400 font-mono">
                  и еще {errors.length - 5}...
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
