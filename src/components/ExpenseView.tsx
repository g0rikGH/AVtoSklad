import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Partner, Document, ProductView } from '../types';
import { FolderOpen, Plus, FileSpreadsheet, Columns, RotateCcw, CheckCheck, Eye, TableProperties, History, X, Trash2, Download } from 'lucide-react';

interface ExpenseViewProps {
  clients: Partner[];
  products: ProductView[];
  documents: Document[];
  onAddClient: (name: string) => Promise<Partner | undefined>;
  onSaveDocument: (doc: Document) => Promise<{ success: boolean; error?: string }>;
  onRollbackDocument: (id: string) => Promise<void>;
  onUpdateClientConfig?: (id: string, config: string) => Promise<void>;
}

type Step = 'upload' | 'mapping' | 'reconcile';

interface ReconcileItem {
  productId: string;
  sku: string;
  brand: string;
  name: string;
  reqQty: number;
  stockQty: number;
  price: number;
  shipQty: number;
  filePrice?: number;
  stockPrice?: number;
  parentSku?: string;
}

export default function ExpenseView({ clients, products, documents, onAddClient, onSaveDocument, onRollbackDocument, onUpdateClientConfig }: ExpenseViewProps) {
  const [step, setStep] = useState<Step>('upload');
  const [selectedClient, setSelectedClient] = useState('');
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapping state
  const [startRow, setStartRow] = useState(2);
  const [mapping, setMapping] = useState({ A: '', B: '', C: '', D: '', E: '' });

  // Reconcile state
  const [items, setItems] = useState<ReconcileItem[]>([]);

  // History state
  const [historyFilterClient, setHistoryFilterClient] = useState<string>('all');
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client && client.importConfig) {
      try {
        const config = JSON.parse(client.importConfig);
        if (config.startRow) setStartRow(config.startRow);
        if (config.mapping) setMapping(config.mapping);
      } catch (e) {
        console.error('Failed to parse import config', e);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        setFileData(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  const filteredDocs = documents
    .filter(d => historyFilterClient === 'all' || d.partnerId === historyFilterClient)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [isRollbackConfirmOpen, setIsRollbackConfirmOpen] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async (docId: string) => {
    if (!docId) {
      alert('Ошибка: ID документа не найден');
      return;
    }
    
    setIsRollingBack(true);
    try {
      console.log('Initiating rollback via prop for:', docId);
      await onRollbackDocument(docId);
      setViewingDoc(null);
      setIsRollbackConfirmOpen(false);
    } catch (err: any) {
      console.error('Rollback failed in component', err);
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleExportToExcel = (doc: Document) => {
    const client = clients.find(c => c.id === doc.partnerId);
    
    // Header data
    const hasCrosses = doc.rows.some(row => products.find(p => p.id === row.productId)?.type === 'phantom');
    
    const tableHeader = ['Артикул', 'Название', 'Количество', 'Цена (₽)', 'Сумма (₽)'];
    if (hasCrosses) {
      tableHeader.push('Кросс');
    }

    const headerRows = [
      ['РЕКВИЗИТЫ КОМПАНИИ: ООО "МОЯ КОМПАНИЯ", ИНН 1234567890, г. Москва'],
      [''],
      [`Реализация № ${doc.number || doc.id}`],
      [`Дата: ${new Date(doc.date).toLocaleString('ru-RU')}`],
      [`Покупатель: ${client?.name || 'Неизвестно'}`],
      [''],
      tableHeader
    ];

    // Table data
    const tableRows = doc.rows.map(row => {
      const product = products.find(p => p.id === row.productId);
      const rowData = [
        product?.article || 'Неизвестно',
        product?.name || 'Товар удален',
        row.qty,
        row.price,
        row.qty * row.price
      ];
      
      if (hasCrosses) {
        let parentSku = '';
        if (product?.type === 'phantom' && product.parentId) {
          const parent = products.find(p => p.id === product.parentId);
          parentSku = parent?.article || '';
        }
        rowData.push(parentSku);
      }
      
      return rowData;
    });

    // Total row
    const totalRow = ['', '', '', 'ИТОГО:', doc.totalAmount];
    if (hasCrosses) totalRow.push('');

    const fullData = [...headerRows, ...tableRows, totalRow];
    
    const ws = XLSX.utils.aoa_to_sheet(fullData);
    
    // Basic styling/widths could be added here if needed for more complex needs
    // ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Реализация");
    
    const fileNameDate = new Date(doc.date).toISOString().split('T')[0];
    const safeClientName = (client?.name || 'Неизвестно').replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `${safeClientName}_${doc.number || doc.id}_${fileNameDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleProceedToMapping = () => {
    if (!selectedClient) {
      alert('Пожалуйста, выберите покупателя!');
      return;
    }
    setStep('mapping');
  };

  const handleProceedToReconcile = () => {
    const getColumnIndex = (type: string) => {
      const entry = Object.entries(mapping).find(([col, val]) => val === type);
      if (!entry) return -1;
      return entry[0].charCodeAt(0) - 65; // A=0, B=1...
    };

    const artIdx = getColumnIndex('colArticle');
    const reqQtyIdx = getColumnIndex('colQty');
    const priceIdx = getColumnIndex('colPrice');

    if (artIdx === -1 || reqQtyIdx === -1) {
      alert('Необходимо выбрать колонки для Артикула и Количества!');
      return;
    }

    const dataRows = fileData.slice(startRow - 1);
    const reconcileItems: ReconcileItem[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      
      const article = String(row[artIdx] || '').trim();
      const reqQtyVal = String(row[reqQtyIdx] || '0').replace(/\s+/g, '').replace(/[^\d.-]/g, '');
      const reqQty = parseInt(reqQtyVal) || 0;

      let filePrice = 0;
      if (priceIdx !== -1) {
        const pVal = String(row[priceIdx] || '0').replace(/\s+/g, '').replace(/[^\d.-]/g, '');
        filePrice = parseFloat(pVal) || 0;
      }

      if (!article) continue;

      const product = products.find(p => p.article === article);
      if (product) {
        // Если цена в файле больше чем в цена остатка, берем цену из файла списания. 
        // Если меньше- выдаем предупреждение (но всё равно берем из файла или стоковую?)
        // Исходя из "списание производим исходя из цены файла списание", берем цену файла.
        const stockPrice = product.sellingPrice;
        const usedPrice = filePrice > 0 ? filePrice : stockPrice;

        let parentSku = undefined;
        if (product.type === 'phantom' && product.parentId) {
          const parent = products.find(p => p.id === product.parentId);
          parentSku = parent?.article;
        }

        reconcileItems.push({
          productId: product.id,
          sku: product.article,
          brand: product.brand,
          name: product.name,
          reqQty: reqQty,
          stockQty: product.qty,
          price: usedPrice,
          filePrice: filePrice > 0 ? filePrice : undefined,
          stockPrice: stockPrice,
          shipQty: Math.min(reqQty, product.qty),
          parentSku
        });
      } else {
        reconcileItems.push({
          productId: 'unknown',
          sku: article,
          brand: 'Неизвестно',
          name: 'Товар отсутствует в базе',
          reqQty: reqQty,
          stockQty: 0,
          price: 0,
          shipQty: 0
        });
      }
    }

    if (reconcileItems.length === 0) {
      alert('Не удалось найти данные для сверки. Проверьте настройки колонок.');
      return;
    }

    // Save config for the selected client
    if (onUpdateClientConfig) {
      const configObj = { startRow, mapping };
      onUpdateClientConfig(selectedClient, JSON.stringify(configObj));
    }

    setItems(reconcileItems);
    setStep('reconcile');
  };

  const handleShipQtyChange = (index: number, val: string) => {
    const newItems = [...items];
    let numVal = parseInt(val) || 0;
    const max = newItems[index].stockQty;
    
    if (numVal > max) {
      alert(`Внимание! Запрошено к отгрузке ${numVal}, но на складе доступно всего ${max} шт.`);
      numVal = max;
    } else if (numVal < 0) {
      numVal = 0;
    }
    
    newItems[index].shipQty = numVal;
    setItems(newItems);
  };

  const handleConfirm = async () => {
    const documentRows = items
      .filter(item => item.shipQty > 0 && item.productId !== 'unknown')
      .map(item => ({
        productId: item.productId,
        qty: item.shipQty,
        price: item.price
      }));

    if (documentRows.length === 0) {
      alert("Нет товаров к отгрузке!");
      return;
    }

    const totalAmount = documentRows.reduce((sum, row) => sum + (row.qty * row.price), 0);

    const newDoc: Document = {
      id: `doc_${Date.now()}`,
      type: 'expense',
      date: new Date().toISOString(),
      partnerId: selectedClient,
      rows: documentRows,
      totalAmount
    };

    const result = await onSaveDocument(newDoc);
    if (!result.success) {
      alert(`Ошибка: ${result.error || 'Сбой операции'}`);
      return;
    }

    alert("Накладная проведена! Остатки списаны.");
    setStep('upload');
    setFileName('');
    setSelectedClient('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddClientConfirm = async () => {
    if (!newClientName.trim()) return;
    const newPartner = await onAddClient(newClientName.trim());
    if (newPartner) {
      setSelectedClient(newPartner.id);
      setNewClientName('');
      setIsAddClientOpen(false);
    }
  };

  const totalSum = items.reduce((sum, item) => sum + (item.shipQty * item.price), 0);

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Списание товара (Формирование накладной)</h2>

      {step === 'upload' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Загрузка файла-заявки от клиента</h3>

          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Покупатель:</label>
              <div className="flex gap-2 max-w-md w-full">
                <select
                  value={selectedClient}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Выберите покупателя...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setIsAddClientOpen(!isAddClientOpen)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Добавить покупателя"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {isAddClientOpen && (
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-sm text-slate-500 whitespace-nowrap hidden sm:block">Новый покупатель:</div>
                <div className="flex gap-2 max-w-md w-full pl-[95px] sm:pl-0">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Название организации..."
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddClientConfirm()}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={handleAddClientConfirm}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Сохранить"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsAddClientOpen(false)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Отмена"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
              Выбрать файл-заявку
            </button>
          </div>

          {fileName && (
            <div className="mt-6 flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <span className="font-semibold text-slate-800">{fileName}</span>
              </div>
              <button 
                onClick={handleProceedToMapping}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Columns className="w-4 h-4" />
                Настроить и Сверить
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'mapping' && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-600">Предпросмотр файла и настройка колонок</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Выберите в заголовках таблицы, какие данные находятся в колонке. Настройки сохранятся для текущего покупателя.
          </p>

          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-bold text-slate-600">Строка начала данных:</label>
            <input
              type="number"
              value={startRow}
              onChange={(e) => setStartRow(Number(e.target.value))}
              min={1}
              className="w-20 px-3 py-1.5 text-center bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
            <table className="w-full text-sm text-center">
              <thead className="bg-slate-50">
                <tr>
                  {['A', 'B', 'C', 'D', 'E'].map((col) => (
                    <th key={col} className="p-2 border-b border-r border-slate-200 last:border-r-0">
                      <select
                        value={mapping[col as keyof typeof mapping]}
                        onChange={(e) => setMapping({...mapping, [col]: e.target.value})}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 text-blue-700 font-bold rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Пропустить --</option>
                        <option value="colArticle">Артикул</option>
                        <option value="colBrand">Бренд</option>
                        <option value="colName">Название</option>
                        <option value="colQty">Количество</option>
                        <option value="colPrice">Цена продажи</option>
                      </select>
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-2 border-b border-r border-slate-200">Колонка A</th>
                  <th className="py-2 border-b border-r border-slate-200">Колонка B</th>
                  <th className="py-2 border-b border-r border-slate-200">Колонка C</th>
                  <th className="py-2 border-b border-r border-slate-200">Колонка D</th>
                  <th className="py-2 border-b border-slate-200">Колонка E</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {fileData.slice(startRow - 1, startRow + 3).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 border-r border-slate-200">{String(row[0] || '')}</td>
                    <td className="py-2 border-r border-slate-200">{String(row[1] || '')}</td>
                    <td className="py-2 border-r border-slate-200">{String(row[2] || '')}</td>
                    <td className="py-2 border-r border-slate-200">{String(row[3] || '')}</td>
                    <td className="py-2">{String(row[4] || '')}</td>
                  </tr>
                ))}
                {fileData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Файл пуст или еще не загружен
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setStep('upload')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Назад
            </button>
            <button 
              onClick={handleProceedToReconcile}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <TableProperties className="w-4 h-4" />
              Сверить со складом
            </button>
          </div>
        </div>
      )}

      {step === 'reconcile' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
              <TableProperties className="w-5 h-5" />
              Сверка заказа со складом
            </h3>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium border border-slate-200">
              Клиент: {clients.find(c => c.id === selectedClient)?.name || selectedClient}
            </span>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Отредактируйте колонку "К отгрузке". Если товара меньше, чем в заявке, строка подсвечена.
          </p>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm text-center">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="py-3 px-4 font-semibold text-left border-r border-slate-700">Артикул</th>
                  <th className="py-3 px-4 font-semibold border-r border-slate-700">Бренд</th>
                  <th className="py-3 px-4 font-semibold text-left border-r border-slate-700">Название</th>
                  <th className="py-3 px-4 font-semibold border-r border-slate-700">Запрошено</th>
                  <th className="py-3 px-4 font-semibold border-r border-slate-700">На складе</th>
                  <th className="py-3 px-4 font-semibold bg-blue-600 border-r border-blue-700 w-32">К отгрузке</th>
                  <th className="py-3 px-4 font-semibold border-r border-slate-700">Замена</th>
                  <th className="py-3 px-4 font-semibold border-r border-slate-700">Цена (₽)</th>
                  <th className="py-3 px-4 font-semibold">Сумма (₽)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => {
                  const isOutOfStock = item.stockQty === 0;
                  const isPartial = !isOutOfStock && item.shipQty < item.reqQty;
                  
                  // Warning if file price is lower than stock price
                  const isLowPrice = item.filePrice !== undefined && item.stockPrice !== undefined && item.filePrice < item.stockPrice;

                  let rowClass = "bg-white hover:bg-slate-50";
                  if (isOutOfStock) rowClass = "bg-rose-50 hover:bg-rose-100";
                  else if (isPartial) rowClass = "bg-amber-50 hover:bg-amber-100";
                  else if (isLowPrice) rowClass = "bg-yellow-50 hover:bg-yellow-100";

                  return (
                    <tr key={idx} className={`${rowClass} transition-colors`}>
                      <td className="py-3 px-4 font-bold text-left border-r border-slate-200">{item.sku}</td>
                      <td className="py-3 px-4 border-r border-slate-200">{item.brand}</td>
                      <td className="py-3 px-4 text-left border-r border-slate-200">{item.name}</td>
                      <td className="py-3 px-4 border-r border-slate-200">{item.reqQty}</td>
                      <td className="py-3 px-4 font-bold border-r border-slate-200">{item.stockQty}</td>
                      <td className="py-2 px-4 border-r border-slate-200">
                        <input
                          type="number"
                          value={item.shipQty}
                          onChange={(e) => handleShipQtyChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 text-center font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        {item.parentSku ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                             {item.parentSku}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="flex flex-col items-center">
                          <span className={isLowPrice ? 'text-rose-600 font-bold' : ''}>{item.price}</span>
                          {isLowPrice && (
                            <span className="text-[10px] text-rose-500 font-medium whitespace-nowrap" title={`Цена в базе: ${item.stockPrice}`}>
                              В файле ниже базы!
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{item.shipQty * item.price}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={8} className="py-4 px-4 text-right font-bold text-lg text-slate-700">
                    Итого к оплате:
                  </td>
                  <td className="py-4 px-4 font-bold text-lg text-emerald-600">
                    {totalSum}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setStep('upload')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Назад (Отмена)
            </button>
            <button 
              onClick={handleConfirm}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <CheckCheck className="w-4 h-4" />
              Подтвердить и Списать
            </button>
          </div>
        </div>
      )}

      {/* History Section */}
      {step === 'upload' && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              История реализаций
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Фильтр по покупателю:</label>
              <select
                value={historyFilterClient}
                onChange={(e) => setHistoryFilterClient(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Все покупатели</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold border-b border-slate-200">Дата</th>
                  <th className="py-3 px-4 font-semibold border-b border-slate-200">Номер документа</th>
                  <th className="py-3 px-4 font-semibold border-b border-slate-200">Покупатель</th>
                  <th className="py-3 px-4 font-semibold border-b border-slate-200 text-right">Сумма</th>
                  <th className="py-3 px-4 font-semibold border-b border-slate-200 text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Нет проведенных реализаций
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => {
                    const client = clients.find(c => c.id === doc.partnerId);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">{new Date(doc.date).toLocaleString('ru-RU')}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{doc.number ? `№ ${doc.number}` : doc.id}</td>
                        <td className="py-3 px-4">{client?.name || 'Неизвестный покупатель'}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">{doc.totalAmount} ₽</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setViewingDoc(doc)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Просмотр"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <RollbackButton 
                              onConfirm={() => onRollbackDocument?.(doc.id)} 
                              title="Откатить списание"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Реализация {viewingDoc.number ? `№ ${viewingDoc.number}` : viewingDoc.id}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  от {new Date(viewingDoc.date).toLocaleString('ru-RU')} • Покупатель: {clients.find(c => c.id === viewingDoc.partnerId)?.name || 'Неизвестно'}
                </p>
              </div>
              <button 
                onClick={() => setViewingDoc(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold border-b border-slate-200">Артикул</th>
                    <th className="py-3 px-4 font-semibold border-b border-slate-200">Название</th>
                    <th className="py-3 px-4 font-semibold border-b border-slate-200">Замена</th>
                    <th className="py-3 px-4 font-semibold border-b border-slate-200 text-center">Кол-во</th>
                    <th className="py-3 px-4 font-semibold border-b border-slate-200 text-right">Цена</th>
                    <th className="py-3 px-4 font-semibold border-b border-slate-200 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {viewingDoc.rows.map((row, idx) => {
                    const product = products.find(p => p.id === row.productId);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-4 font-medium">{product?.article || 'Неизвестно'}</td>
                        <td className="py-2 px-4">{product?.name || 'Товар удален'}</td>
                        <td className="py-2 px-4">
                          {product?.type === 'phantom' && product.parentId ? (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                               {products.find(p => p.id === product.parentId)?.article || '-'}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-center">{row.qty}</td>
                        <td className="py-2 px-4 text-right">{row.price} ₽</td>
                        <td className="py-2 px-4 text-right font-medium">{row.qty * row.price} ₽</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-slate-700">Итого:</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{viewingDoc.totalAmount} ₽</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
              <div className="flex gap-3">
                {!isRollbackConfirmOpen ? (
                  <button
                    onClick={() => setIsRollbackConfirmOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Откат реализации (вернуть на склад)
                  </button>
                ) : (
                  <div className="flex items-center gap-3 animate-in zoom-in-95 duration-200">
                    <span className="text-sm font-bold text-rose-600">Вы уверены?</span>
                    <button
                      disabled={isRollingBack}
                      onClick={() => handleRollback(viewingDoc.id)}
                      className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {isRollingBack ? 'Отмена...' : 'Да, подтверждаю'}
                    </button>
                    <button
                      disabled={isRollingBack}
                      onClick={() => setIsRollbackConfirmOpen(false)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      Нет
                    </button>
                  </div>
                )}

                {!isRollbackConfirmOpen && (
                  <button
                    onClick={() => handleExportToExcel(viewingDoc)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Скачать Excel
                  </button>
                )}
              </div>
              <button
                disabled={isRollingBack}
                onClick={() => setViewingDoc(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RollbackButton({ onConfirm, title }: { onConfirm: () => void, title: string }) {
  const [isConfirming, setIsConfirming] = React.useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center gap-1 animate-in zoom-in-95 duration-200">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
            setIsConfirming(false);
          }}
          className="px-2 py-1 bg-rose-600 text-white text-[10px] uppercase font-bold rounded hover:bg-rose-700 transition-colors"
        >
          Да
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsConfirming(false);
          }}
          className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] uppercase font-bold rounded hover:bg-slate-300 transition-colors"
        >
          Нет
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        setIsConfirming(true);
      }}
      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-200 active:scale-90"
      title={title}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
