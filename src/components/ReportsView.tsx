import React from 'react';
import { TriangleAlert, Flame, Download } from 'lucide-react';

export default function ReportsView() {
  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Отчеты и аналитика</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deficit Report */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-1 duration-200">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <TriangleAlert className="w-10 h-10 text-rose-500" />
          </div>
          <h4 className="text-xl font-bold text-slate-800 mb-6">Дефицит</h4>
          <button className="flex items-center gap-2 px-6 py-2.5 border-2 border-rose-500 text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors">
            <Download className="w-4 h-4" />
            Выгрузить в Excel
          </button>
        </div>

        {/* Top Sellers Report */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-1 duration-200">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Flame className="w-10 h-10 text-amber-500" />
          </div>
          <h4 className="text-xl font-bold text-slate-800 mb-6">Хиты продаж</h4>
          <button className="flex items-center gap-2 px-6 py-2.5 border-2 border-amber-500 text-amber-600 hover:bg-amber-50 rounded-lg font-medium transition-colors">
            <Download className="w-4 h-4" />
            Выгрузить в Excel
          </button>
        </div>
      </div>
    </div>
  );
}
