import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Partner, Document, ProductView, Location } from '../types';
import { FolderOpen, Plus, FileSpreadsheet, Columns, RotateCcw, CheckCheck, Eye, Download, X, AlertCircle, History, PackageOpen, MapPin, Trash2 } from 'lucide-react';
import { useChunkedImport } from '../hooks/useChunkedImport';
import { ImportProgress } from './ImportProgress';
import ImportSummaryReport from './ImportSummaryReport';
import api from '../api/axios';

interface IncomeViewProps {
  suppliers: Partner[];
  products: ProductView[];
  documents: Document[];
  locations: Location[];
  onAddSupplier: (name: string) => Promise<any>;
  onSaveDocument: (doc: Document) => Promise<{ success: boolean; error?: string }>;
  onRollbackDocument?: (documentId: string) => Promise<void>;
  onCreateMissingProduct?: (data: { article: string; brandName: string; productName: string; parentId?: string; price?: number }) => Promise<any>;
  onSaveLocations?: (updates: {productId: string, locationName: string}[]) => Promise<void>;
  externalSelectedDocumentId?: string | null;
  onClearExternalDocument?: () => void;
  onUpdateSupplierConfig?: (id: string, config: string) => Promise<void>;
}

type TabType = 'new' | 'history';
type Step = 'upload' | 'mapping';

export default function IncomeView({ suppliers, products, documents, locations, onAddSupplier, onSaveDocument, onRollbackDocument, onCreateMissingProduct, onSaveLocations, externalSelectedDocumentId, onClearExternalDocument, onUpdateSupplierConfig }: IncomeViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('new');
  const [step, setStep] = useState<Step>('upload');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [isInitialBalance, setIsInitialBalance] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for UI
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [error, setError] = useState<string | string[] | null>(null);
  const [importStats, setImportStats] = useState<{ rows: number, totalQty: number, totalAmount: number } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [draftLocations, setDraftLocations] = useState<Record<string, string>>({});
  const [isSavingLocations, setIsSavingLocations] = useState(false);

  React.useEffect(() => {
    if (externalSelectedDocumentId) {
      const doc = documents.find(d => d.id === externalSelectedDocumentId);
      if (doc) {
        setActiveTab('history');
        setSelectedDocument(doc);
        setDraftLocations({});
      }
      if (onClearExternalDocument) {
        onClearExternalDocument();
      }
    }
  }, [externalSelectedDocumentId, documents, onClearExternalDocument]);

  const handleOpenDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setDraftLocations({});
  };

  const handleSaveLocations = async () => {
    if (!onSaveLocations) return;
    setIsSavingLocations(true);
    try {
      const updates = Object.entries(draftLocations).map(([productId, locationName]) => ({ productId, locationName }));
      await onSaveLocations(updates);
      setDraftLocations({});
      alert('Размещение успешно сохранено!');
    } catch (err) {
      console.error('Ошибка сохранения', err);
      alert('Произошла ошибка при сохранении');
    } finally {
      setIsSavingLocations(false);
    }
  };

  const renderSuccessStats = () => {
    if (!importStats) return null;
    return (
      <div className="mb-6 p-5 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl flex items-start gap-3 text-emerald-800 animate-in slide-in-from-top-2 shadow-sm">
        <CheckCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
        <div className="flex-1">
          <h4 className="text-sm font-bold mb-2">Оприходование успешно завершено!</h4>
          <ul className="list-disc pl-4 text-sm font-medium space-y-1">
            <li>Обработано позиций (уникальных строк): <span className="font-bold">{importStats.rows}</span></li>
            <li>Всего единиц товара: <span className="font-bold">{importStats.totalQty} шт.</span></li>
            <li>Общая сумма прихода: <span className="font-bold">{importStats.totalAmount.toLocaleString('ru-RU')} ₽</span></li>
          </ul>
        </div>
        <button onClick={() => setImportStats(null)} className="ml-auto p-1 hover:bg-emerald-100 rounded-md transition-colors">
          <X className="w-4 h-4 text-emerald-600" />
        </button>
      </div>
    );
  };

  const [failedDraftId, setFailedDraftId] = useState<string | null>(null);

  const handleCancelDraft = async () => {
    if (!failedDraftId) return;
    try {
      await api.delete(`/documents/${failedDraftId}/draft`);
      setFailedDraftId(null);
      setError(null);
      alert('Черновик и связанные с ним зависшие данные были успешно удалены.');
    } catch (err) {
      alert('Ошибка при удалении черновика.');
    }
  };

  const renderError = () => {
    if (!error) return null;
    const errorList = Array.isArray(error) ? error : error.split(', ');

    return (
      <div className="mb-6 p-5 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl flex items-start gap-3 text-rose-800 animate-in slide-in-from-top-2 shadow-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold mb-1">Ошибка импорта</h4>
          {errorList.length === 1 ? (
            <p className="text-sm font-medium mb-3">{errorList[0]}</p>
          ) : (
            <ul className="list-disc pl-4 text-sm font-medium space-y-1 mb-3">
              {errorList.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          {failedDraftId && (
            <button 
              onClick={handleCancelDraft}
              className="mt-2 text-white bg-rose-600 hover:bg-rose-700 font-semibold py-1.5 px-4 rounded shadow-sm text-sm transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Отменить импорт и удалить мусор
            </button>
          )}
        </div>
        <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-rose-100 rounded-md transition-colors">
          <X className="w-4 h-4 text-rose-500" />
        </button>
      </div>
    );
  };
  const [isProcessing, setIsProcessing] = useState(false);

  // Mapping state
  const [startRow, setStartRow] = useState(2);
  const [mapping, setMapping] = useState<Record<string, string>>({ 
    A: 'colArticle', 
    B: 'colBrand', 
    C: 'colName', 
    D: 'colQty', 
    E: 'colPrice',
    F: 'colLocation',
    G: 'colCrossType'
  });

  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSupplier(supplierId);
    setError(null);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier && supplier.importConfig) {
      try {
        const config = JSON.parse(supplier.importConfig);
        if (config.startRow) setStartRow(config.startRow);
        if (config.mapping) setMapping(config.mapping);
      } catch (e) {
        console.error('Failed to parse import config', e);
      }
    }
  };

  const handleDownloadSample = () => {
    const data = [
      {
        'Артикул': 'SKU-001',
        'Бренд': 'BOSCH',
        'Название': 'Фильтр масляный',
        'Количество': 10,
        'Закупочная цена': 450,
        'Полка': 'A-12',
        'Тип товара': 'Реальный'
      },
      {
        'Артикул': 'SKU-001-CROSS',
        'Бренд': 'VAG',
        'Название': 'Аналог фильтра',
        'Количество': 24,
        'Закупочная цена': 890,
        'Полка': 'B-10',
        'Тип товара': 'SKU-001'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Образец");
    XLSX.writeFile(workbook, "obrazec_prihoda.xlsx");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      setImportStats(null); // Clear previous stats on new file select
      setShowSummaryReport(false);
      setFinalImportTime(null);
      setError(null);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Filtering step: remove completely empty rows or rows where Column A is empty
        const filteredData = data.filter((row: any[]) => {
          if (!row || row.length === 0) return false;
          
          // Must have at least one non-empty cell
          const hasValues = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
          if (!hasValues) return false;

          // More reliably: discard if Column A (first column) is completely empty
          const colA = row[0];
          if (colA === null || colA === undefined || String(colA).trim() === '') {
            return false;
          }

          return true;
        });

        setFileData(filteredData);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleProceedToMapping = () => {
    if (!selectedSupplier) {
      setError('Пожалуйста, выберите поставщика перед продолжением!');
      return;
    }
    setError(null);
    setStep('mapping');
  };

  const { isImporting, totalCount, processedCount, progress, errors: importErrors, metrics, startImport } = useChunkedImport();
  
  const [showSummaryReport, setShowSummaryReport] = useState(false);
  const [finalImportTime, setFinalImportTime] = useState<string | null>(null);

  const handleConfirm = async () => {
    const overallStartTime = performance.now();

    // Determine which column is which
    const getColumnIndex = (type: string) => {
      const entry = Object.entries(mapping).find(([col, val]) => val === type);
      if (!entry) return -1;
      return entry[0].charCodeAt(0) - 65; // A=0, B=1...
    };

    const artIdx = getColumnIndex('colArticle');
    const qtyIdx = getColumnIndex('colQty');
    const prcIdx = getColumnIndex('colPrice');
    const nameIdx = getColumnIndex('colName');
    const brandIdx = getColumnIndex('colBrand');
    const locIdx = getColumnIndex('colLocation');

    if (artIdx === -1 || qtyIdx === -1 || prcIdx === -1) {
      setError('Необходимо указать колонки для Артикула, Количества и Цены!');
      return;
    }

    // Process real rows
    const dataRows = fileData.slice(startRow - 1);
    
    setIsProcessing(true);
    let totalAmount = 0;
    let totalQty = 0;
    const documentRowsData: any[] = [];
    const locationUpdatesMap: Record<string, string> = {};
    const importRows = [];

    // 1. Initial Validation and Build ImportRows array
    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const article = String(row[artIdx] || '').trim().toUpperCase();
        
        const qtyVal = String(row[qtyIdx] || '0').replace(/\s+/g, '').replace(/[^\d.-]/g, '');
        const qty = parseInt(qtyVal) || 0;
        
        const priceVal = String(row[prcIdx] || '0').replace(/\s+/g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
        const price = parseFloat(priceVal) || 0;

        const brandName = brandIdx !== -1 ? String(row[brandIdx] || '').trim().toUpperCase() : '';
        const productName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
        const locationName = locIdx !== -1 ? String(row[locIdx] || '').trim() : '';

        if (!article) continue;

        if (/[А-Яа-яЁё]/.test(article)) {
            setError(`Ошибка в строке ${startRow + i}: артикул "${article}" содержит кириллицу.`);
            setIsProcessing(false);
            return;
        }

        if (isNaN(qty) || qty <= 0) {
            setError(`Ошибка в строке ${startRow + i}: для артикула "${article}" указано некорректное количество.`);
            setIsProcessing(false);
            return;
        }
        
        if (isNaN(price) || price < 0) {
            setError(`Ошибка в строке ${startRow + i}: для артикула "${article}" указана некорректная цена.`);
            setIsProcessing(false);
            return;
        }

        importRows.push({
            article,
            name: productName,
            price,
            brandName,
            qty,
            locationName,
            originalIndex: i
        });
    }

    if (importRows.length === 0) {
        setError('В файле не найдено корректных данных для загрузки');
        setIsProcessing(false);
        return;
    }

    // --- DRAFT ARCHITECTURE ---
    let draftId = '';
    try {
        const draftRes = await api.post('/documents/draft', {
            type: 'INCOME',
            partnerId: selectedSupplier,
            name: documentName.trim() || undefined
        });
        draftId = draftRes.data.data.id;
    } catch (err: any) {
        setError('Не удалось создать черновик: ' + (err.response?.data?.message || err.message));
        setIsProcessing(false);
        return;
    }

    // 2. Execute Chunked Import on Backend (creates products and document rows)
    const isSuccess = await startImport(importRows, draftId, isInitialBalance);
    
    if (!isSuccess) {
       setFailedDraftId(draftId);
       setError('Во время импорта произошли ошибки. Вы можете отменить импорт и удалить черновик накладной, чтобы не мусорить в базе.');
       setIsProcessing(false);
       return;
    }

    // 3. Commit Document
    let commitResult;
    try {
       const commitRes = await api.post(`/documents/${draftId}/commit`, { isInitialBalance });
       commitResult = commitRes.data.data;
    } catch (err: any) {
       setFailedDraftId(draftId);
       setError('Ошибка проведения документа: ' + (err.response?.data?.message || err.message));
       setIsProcessing(false);
       return;
    }

    // Override the metrics time to include the document saving phase safely in state
    const endTime = performance.now();
    const finalTotalTime = (endTime - overallStartTime) / 1000;
    
    setFinalImportTime(`${finalTotalTime.toFixed(2)} s`);

    // Calculate sum correctly from import rows for UI mapping
    totalQty = 0;
    totalAmount = 0;
    for (const r of importRows) {
        totalQty += r.qty;
        totalAmount += (r.qty * r.price);
    }

    setImportStats({
      rows: importRows.length,
      totalQty,
      totalAmount
    });
    setShowSummaryReport(true);
    setStep('upload');
    setFileName('');
    setFileData([]);
    setSelectedSupplier('');
    setDocumentName('');
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSupplierConfirm = async () => {
    if (!newSupplierName.trim()) return;
    const newPartner = await onAddSupplier(newSupplierName.trim());
    if (newPartner) {
      setSelectedSupplier(newPartner.id);
      setNewSupplierName('');
      setIsAddSupplierOpen(false);
    }
  };

  // Preview slice for the mapping step - show all rows
  const previewRows = fileData;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Приход товара</h2>
        <div className="flex bg-slate-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'new' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" /> Новый приход
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" /> Размещение на складе (История)
          </button>
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {selectedDocument ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedDocument(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <h3 className="text-xl font-bold text-slate-800">
                    Накладная №{selectedDocument.number || selectedDocument.id.slice(0, 8)}
                  </h3>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                    ПРИХОД
                  </span>
                  {selectedDocument.name && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg border border-slate-200">
                      {selectedDocument.name}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Поставщик</div>
                  <div className="font-bold text-slate-800">
                    {suppliers.find(s => s.id === selectedDocument.partnerId)?.name || 'Неизвестен'}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 font-semibold">Артикул</th>
                      <th className="p-3 font-semibold">Бренд</th>
                      <th className="p-3 font-semibold">Название</th>
                      <th className="p-3 font-semibold">Количество</th>
                      <th className="p-3 font-semibold w-1/4">Размещение (Полка)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedDocument.rows?.map((row, idx) => {
                      const product = products.find(p => p.id === row.productId);
                      if (!product) return null;
                      return (
                        <tr key={`${selectedDocument.id}-${row.productId}-${idx}`} className="hover:bg-slate-50 text-slate-700">
                          <td className="p-3 font-medium text-slate-900">{product.article}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border border-slate-200">
                              {product.brand}
                            </span>
                          </td>
                          <td className="p-3 truncate max-w-[200px]" title={product.name}>{product.name}</td>
                          <td className="p-3 font-bold text-emerald-600">+{row.qty} шт</td>
                          <td className="p-3">
                            <input
                              type="text"
                              list="locations-list"
                              placeholder="Стеллаж/Полка"
                              className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
                              value={draftLocations[product.id] !== undefined ? draftLocations[product.id] : (product.location && product.location !== 'Не на полке' ? product.location : '')}
                              onChange={(e) => {
                                setDraftLocations(prev => ({ ...prev, [product.id]: e.target.value }));
                              }}
                            />
                            <datalist id="locations-list">
                              {locations.map(loc => (
                                <option key={loc.id} value={loc.name} />
                              ))}
                            </datalist>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveLocations}
                  disabled={isSavingLocations || Object.keys(draftLocations).length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors shadow-sm"
                >
                  <CheckCheck className="w-5 h-5" />
                  {isSavingLocations ? 'Сохранение...' : 'Сохранить размещение'}
                </button>
              </div>

            </div>
          ) : (
            <>
              {documents.filter(d => d.type === 'income').length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <History className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">История приходов пуста</h3>
                  <p className="text-slate-500 max-w-md">Здесь будут отображаться все ранее проведенные документы закупки.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-sm">
                      <th className="p-4 font-semibold w-24">Статус</th>
                      <th className="p-4 font-semibold">Дата</th>
                      <th className="p-4 font-semibold">№</th>
                      <th className="p-4 font-semibold">Поставщик</th>
                      <th className="p-4 font-semibold">Название / Комментарий</th>
                      <th className="p-4 font-semibold text-right">Сумма</th>
                      <th className="p-4 font-semibold text-center w-24">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.filter(d => d.type === 'income')
                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors text-slate-700 group">
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                            <CheckCheck className="w-3 h-3" /> Ок
                          </span>
                        </td>
                        <td className="p-4 font-medium">{new Date(doc.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</td>
                        <td className="p-4">
                           <button 
                             onClick={() => handleOpenDocument(doc)}
                             className="font-mono font-bold text-blue-600 hover:text-blue-800 bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                             title="Открыть документ"
                           >
                             {doc.number || doc.id.slice(0, 8)}
                           </button>
                        </td>
                        <td className="p-4 font-bold text-slate-800">
                          {suppliers.find(s => s.id === doc.partnerId)?.name || 'Неизвестен'}
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                          {doc.name ? (
                            <span className="text-slate-700">{doc.name}</span>
                          ) : (
                            <span className="italic text-slate-400">Нет комментария</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-bold tabular-nums">
                          {doc.totalAmount.toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleOpenDocument(doc)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 text-sm font-medium"
                              title="Открыть и разместить"
                            >
                              <PackageOpen className="w-4 h-4" /> Разместить
                            </button>
                            <RollbackButton 
                              onConfirm={() => onRollbackDocument?.(doc.id)} 
                              title="Откатить приход"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'new' && step === 'upload' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Загрузка накладной от поставщика</h3>
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Скачать образец XLS
            </button>
          </div>

          {showSummaryReport && metrics && (
             <ImportSummaryReport 
               metrics={{ ...metrics, totalExecutionTimeSeconds: finalImportTime || metrics.totalExecutionTimeSeconds }} 
               onRefresh={() => setShowSummaryReport(false)} 
             />
          )}

          {renderSuccessStats()}
          {renderError()}

          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Поставщик:</label>
              <div className="flex gap-2 max-w-md w-full relative">
                <select
                  value={selectedSupplier}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Выберите поставщика...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              <button 
                onClick={() => setIsAddSupplierOpen(true)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                title="Добавить поставщика"
              >
                <Plus className="w-4 h-4" />
              </button>

              {isAddSupplierOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-slate-200 shadow-xl rounded-xl z-10 animate-in zoom-in-95">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      placeholder="Имя поставщика"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSupplierConfirm()}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button 
                      onClick={handleAddSupplierConfirm}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setIsAddSupplierOpen(false)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Название (Комментарий):</label>
            <input
              type="text"
              placeholder="Например: Поступление шин, 18 апреля..."
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors max-w-xl">
              <input 
                type="checkbox" 
                checked={isInitialBalance}
                onChange={(e) => setIsInitialBalance(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <div className="font-semibold text-amber-900">Ввод начальных остатков</div>
                <div className="text-sm text-amber-700 mt-1">
                  Закупочная цена будет установлена как 0 ₽. Розничная цена будет взята из файла. Партии будут помечены для будущей корректировки себестоимости.
                </div>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Выбрать файл на компьютере
            </button>
          </div>

          {fileName && (
            <div className="mt-6 flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-blue-200 shadow-sm transition-transform hover:scale-110">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{fileName}</div>
                  <div className="text-xs text-slate-500">Найдено строк: {fileData.length}</div>
                </div>
              </div>
              <button 
                onClick={handleProceedToMapping}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Columns className="w-4 h-4" />
                Настроить и Провести
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'mapping' && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-600">Настройка колонок и предпросмотр</h3>
          </div>
          
          {renderError()}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="text-sm font-bold text-slate-600">Строка начала данных (пропуск шапки):</label>
            <input
              type="number"
              value={startRow}
              onChange={(e) => setStartRow(Number(e.target.value))}
              min={1}
              className="w-20 px-3 py-1.5 text-center bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border border-slate-200 rounded-xl mb-8 max-h-[60vh] overflow-y-auto relative shadow-inner">
            <table className="w-full text-sm text-center border-separate border-spacing-0">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((col) => (
                    <th key={col} className="p-3 border-b border-r border-slate-200 last:border-r-0 bg-slate-50">
                      <select
                        value={mapping[col]}
                        onChange={(e) => {
                          setMapping({...mapping, [col]: e.target.value});
                          if (error) setError(null);
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 text-blue-700 font-bold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Пропустить --</option>
                        <option value="colArticle">Артикул</option>
                        <option value="colBrand">Бренд</option>
                        <option value="colName">Название</option>
                        <option value="colQty">Количество</option>
                        <option value="colPrice">Закуп. Цена</option>
                        <option value="colLocation">Полка (Размещение)</option>
                        <option value="colCrossType">Тип товара / Кросс</option>
                      </select>
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2 border-b border-r border-slate-200 bg-slate-100 sticky top-[53px] z-10 w-32">Колонка A</th>
                  <th className="py-2 border-b border-r border-slate-200 bg-slate-100 sticky top-[53px] z-10 w-32">Колонка B</th>
                  <th className="py-2 border-b border-r border-slate-200 bg-slate-100 sticky top-[53px] z-10 min-w-48">Колонка C</th>
                  <th className="py-2 border-b border-r border-slate-200 bg-slate-100 sticky top-[53px] z-10 w-24">Колонка D</th>
                  <th className="py-2 border-b border-r border-slate-200 bg-slate-100 sticky top-[53px] z-10 w-24">Колонка E</th>
                  <th className="py-2 border-b border-r border-slate-200 bg-slate-100 sticky top-[53px] z-10 w-32">Колонка F</th>
                  <th className="py-2 border-b border-slate-200 bg-slate-100 sticky top-[53px] z-10 w-32">Колонка G</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {[0, 1, 2, 3, 4, 5, 6].map((cellIdx) => (
                      <td key={cellIdx} className="p-3 border-r border-slate-200 last:border-r-0 text-slate-600 truncate max-w-[150px]">
                        {String(row[cellIdx] || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-blue-50 py-3 px-5 rounded-xl border border-blue-100 mb-8">
            <div className="text-slate-600 text-sm">
              Будет обработано позиций: <strong className="text-blue-700 ml-1">{Math.max(0, fileData.length - startRow + 1)}</strong>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setStep('upload')}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                disabled={isImporting}
              >
                <RotateCcw className="w-4 h-4" />
                Назад
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isProcessing || isImporting}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <CheckCheck className="w-4 h-4" />
                {(isProcessing || isImporting) ? 'Обработка...' : 'Провести накладную'}
              </button>
            </div>
          </div>
          <ImportProgress 
            isImporting={isImporting} 
            totalCount={totalCount} 
            processedCount={processedCount} 
            progress={progress} 
            errors={importErrors} 
          />
        </div>
      )}
    </div>
  );
}

function RollbackButton({ onConfirm, title }: { onConfirm: () => Promise<void> | void, title: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg transition-colors border border-rose-200 text-sm font-medium shadow-sm"
        title={title}
      >
        <Trash2 className="w-4 h-4" /> Откатить накладную
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-rose-200 w-full max-w-md overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <AlertCircle className="w-8 h-8 flex-shrink-0" />
                <h3 className="text-xl font-bold">Are you sure?</h3>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                This will deduct the items from current stock and delete the inventory batches. This action cannot be undone.
              </p>
              
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isProcessing ? 'Удаление...' : 'Да, откатить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

