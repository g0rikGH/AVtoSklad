import React, { useState } from 'react';
import { FileSpreadsheet, CheckCircle2, Circle, Download, Link2, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProductView } from '../types';
import { useGroupedProducts } from '../hooks/useGroupedProducts';

interface PriceViewProps {
  products: ProductView[];
}

export default function PriceView({ products }: PriceViewProps) {
  const [filter, setFilter] = useState<'all' | 'in_stock'>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  const groupedRows = useGroupedProducts(products, '').filter(p => (p as any).status !== 'draft');

  const filteredProducts = groupedRows.filter(p => {
    if (filter === 'in_stock') return p.qty > 0;
    return true;
  });

  const getExportData = () => {
    return filteredProducts.map(p => ({
      'Артикул': p.article,
      'Производитель': p.brand,
      'Наименование': p.isPhantom && p.parentName ? p.parentName : p.name,
      'Цена': p.sellingPrice || 0,
      'Наличие': p.qty
    }));
  };

  const handleDownloadCSV = () => {
    const headers = ['Артикул', 'Производитель', 'Наименование', 'Цена', 'Наличие'];
    const rows = filteredProducts.map(p => [
      p.article,
      p.brand,
      p.isPhantom && p.parentName ? p.parentName : p.name,
      p.sellingPrice?.toString() || '0',
      p.qty.toString()
    ]);
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `price_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadXLSX = () => {
    const data = getExportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Price");
    
    // Set some basic column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Артикул
      { wch: 15 }, // Бренд
      { wch: 40 }, // Название
      { wch: 15 }, // Цена продажи
      { wch: 10 }  // Остаток
    ];

    XLSX.writeFile(workbook, `price_list_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const staticLink = `${window.location.origin}/api/v1/export/price-list`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(staticLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Генерация прайс-листа</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-3xl">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Настройки выгрузки</h3>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 flex items-start gap-3 px-6 py-4 rounded-xl border-2 transition-all text-left ${
              filter === 'all' 
                ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm' 
                : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="mt-0.5">
              {filter === 'all' ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div>
              <div className="font-semibold mb-1">Все товары</div>
              <div className="text-sm opacity-80 font-normal">Выгрузить весь ассортимент склада</div>
            </div>
          </button>
          
          <button
            onClick={() => setFilter('in_stock')}
            className={`flex-1 flex items-start gap-3 px-6 py-4 rounded-xl border-2 transition-all text-left ${
              filter === 'in_stock' 
                ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm' 
                : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="mt-0.5">
              {filter === 'in_stock' ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div>
              <div className="font-semibold mb-1">Только в наличии</div>
              <div className="text-sm opacity-80 font-normal">Исключить товары с нулевым остатком</div>
            </div>
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-8 border border-slate-200 flex items-center justify-between">
          <div className="text-slate-600">
            Будет выгружено позиций: <strong className="text-slate-900 text-lg ml-2">{filteredProducts.length}</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button 
            onClick={handleDownloadXLSX}
            className="flex-1 flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-lg font-medium transition-colors shadow-sm justify-center"
          >
            <Download className="w-6 h-6" />
            Скачать прайс (Excel)
          </button>
          
          <button 
            onClick={handleDownloadCSV}
            className="flex-1 flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-lg font-medium transition-colors shadow-sm justify-center"
          >
            <Download className="w-6 h-6" />
            Скачать прайс (CSV)
          </button>
        </div>

        <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100">
          <h4 className="flex items-center gap-2 font-semibold text-blue-900 mb-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            Постоянная ссылка на API
          </h4>
          <p className="text-sm text-blue-800/80 mb-4">
            Эта ссылка всегда возвращает актуальный прайс-лист по <b>всем товарам</b> в формате Excel. Вы можете отдать её покупателям для автоматической загрузки роботом.
          </p>
          <div className="flex items-center gap-2">
            <div className="bg-white px-4 py-2.5 rounded-lg border border-blue-200 font-mono text-xs text-slate-600 flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
              {staticLink}
            </div>
            <button 
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer shrink-0"
              title="Копировать в буфер"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Скопировано' : 'Копировать'}
            </button>
            <a 
              href={staticLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Открыть ссылку"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
