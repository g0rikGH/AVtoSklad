import React, { useState, useEffect } from 'react';
import { ProductView, Brand, Location, ProductHistoryRecord } from '../types';
import { X, MapPin, MessageSquare, Link as LinkIcon, Ghost, Plus, Save, DollarSign, Tag, Building2, History, Rocket, Trash2 } from 'lucide-react';
import api from '../api/axios';

interface ProductModalProps {
  product: ProductView | null;
  allProducts: ProductView[];
  brands: Brand[];
  locations: Location[];
  onClose: () => void;
  onSave: (updatedProduct: ProductView) => void;
  onDelete?: (productId: string) => Promise<{success: boolean, error?: string}>;
  onAddPhantom: (parentId: string, sku: string, price: number, brand: string, comment: string) => void;
  onRemovePhantom: (phantomId: string) => void;
  onUpdatePhantomInfo: (phantomId: string, updates: any) => Promise<void>;
  onOpenDocument?: (docId: string) => void;
}

export default function ProductModal({ product, allProducts, brands, locations, onClose, onSave, onDelete, onAddPhantom, onRemovePhantom, onUpdatePhantomInfo, onOpenDocument }: ProductModalProps) {
  const [editedProduct, setEditedProduct] = useState<ProductView | null>(null);
  const [newPhantomSku, setNewPhantomSku] = useState('');
  const [newPhantomPrice, setNewPhantomPrice] = useState('');
  const [newPhantomBrand, setNewPhantomBrand] = useState('');
  const [newPhantomComment, setNewPhantomComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ProductHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setEditedProduct(product ? { ...product } : null);
    
    if (product) {
      setLoadingHistory(true);
      api.get(`/catalog/${product.id}/history`)
        .then(res => {
          if (res.data.success) {
            setHistory(res.data.data);
          }
        })
        .catch(err => console.error('Ошибка загрузки истории:', err))
        .finally(() => setLoadingHistory(false));
    } else {
      setHistory([]);
    }
  }, [product]);

  if (!editedProduct) return null;

  const handleAddPhantomClick = () => {
    setError(null);
    const sku = newPhantomSku.trim();
    if (!sku) return;

    if (/[А-Яа-яЁё]/.test(sku)) {
      setError('Обнаружены запрещенные символы (кириллица)');
      return;
    }
    
    const parsedPrice = newPhantomPrice ? Number(newPhantomPrice) : 0;
    if (newPhantomPrice && (isNaN(parsedPrice) || parsedPrice < 0)) {
      setError('Ошибка: Цена продажи должна быть положительным числом.');
      return;
    }

    const parentId = editedProduct.type === 'real' ? editedProduct.id : editedProduct.parentId;
    
    if (parentId) {
      onAddPhantom(parentId, sku.toUpperCase(), parsedPrice, newPhantomBrand.trim().toUpperCase(), newPhantomComment.trim());
      setNewPhantomSku('');
      setNewPhantomPrice('');
      setNewPhantomBrand('');
      setNewPhantomComment('');
    }
  };

  const handleAddBrand = () => {
    const name = prompt('Введите название нового бренда:');
    if (name && name.trim()) {
      const tempId = `temp_b_${Date.now()}`;
      setEditedProduct({ ...editedProduct, brandId: tempId, brand: name.trim().toUpperCase() });
    }
  };

  const handleAddLocation = () => {
    const name = prompt('Введите название новой полки/стеллажа:');
    if (name && name.trim()) {
      const tempId = `temp_l_${Date.now()}`;
      setEditedProduct({ ...editedProduct, locationId: tempId, location: name.trim() });
    }
  };

  const parentId = editedProduct.type === 'real' ? editedProduct.id : editedProduct.parentId;
  const phantoms = parentId 
    ? allProducts.filter(p => p.type === 'phantom' && p.parentId === parentId)
    : [];

  const handlePublish = () => {
    if (editedProduct) {
      if (!editedProduct.sellingPrice || editedProduct.sellingPrice <= 0) {
        setError('Укажите цену продажи перед публикацией');
        return;
      }
      onSave({ ...editedProduct, status: 'active' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white">
          <h3 className="text-lg font-semibold">Карточка товара (Редактирование)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 px-4 py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-medium animate-in slide-in-from-top-2 flex items-start gap-2">
              <X className="w-5 h-5 shrink-0 mt-0.5 cursor-pointer" onClick={() => setError(null)} />
              <div>{error}</div>
            </div>
          )}

          <div className="flex justify-between items-start mb-6">

            <div>
              <h2 className="text-3xl font-bold text-blue-600 mb-1">{editedProduct.article}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={editedProduct.brandId}
                  onChange={(e) => {
                    const selectedBrand = brands.find(b => b.id === e.target.value);
                    if (selectedBrand) {
                      setEditedProduct({...editedProduct, brandId: selectedBrand.id, brand: selectedBrand.name});
                    }
                  }}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                  {/* Show temporary brand if added via prompt but not saved yet */}
                  {!brands.find(b => b.id === editedProduct.brandId) && (
                    <option value={editedProduct.brandId}>{editedProduct.brand}</option>
                  )}
                </select>
                <button onClick={handleAddBrand} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Добавить бренд">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-sm text-slate-500 mb-1">Остаток:</span>
              <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-lg font-bold ${
                editedProduct.qty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {editedProduct.qty}
              </span>
            </div>
          </div>

          <p className="text-slate-700 mb-6">
            <strong className="font-semibold text-slate-900">Название:</strong> {editedProduct.name}
          </p>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-2">
                <DollarSign className="w-4 h-4" /> Закупочная цена:
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={editedProduct.purchasePrice || ''}
                  onChange={(e) => setEditedProduct({...editedProduct, purchasePrice: Number(e.target.value)})}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₽</span>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-2">
                <Tag className="w-4 h-4" /> Цена продажи:
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={editedProduct.sellingPrice || ''}
                  onChange={(e) => setEditedProduct({...editedProduct, sellingPrice: Number(e.target.value)})}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₽</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-2">
                <MapPin className="w-4 h-4" /> Полка:
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={editedProduct.locationId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setEditedProduct({...editedProduct, locationId: null, location: null});
                    } else {
                      const selectedLoc = locations.find(l => l.id === val);
                      if (selectedLoc) {
                        setEditedProduct({...editedProduct, locationId: selectedLoc.id, location: selectedLoc.name});
                      }
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Нет полки --</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                  {/* Show temporary location if added via prompt but not saved yet */}
                  {editedProduct.locationId && !locations.find(l => l.id === editedProduct.locationId) && (
                    <option value={editedProduct.locationId}>{editedProduct.location}</option>
                  )}
                </select>
                <button onClick={handleAddLocation} className="p-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Добавить полку">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-2">
                <MessageSquare className="w-4 h-4" /> Коммент:
              </label>
              <input
                type="text"
                value={editedProduct.comment || ''}
                onChange={(e) => setEditedProduct({...editedProduct, comment: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <h4 className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
              <LinkIcon className="w-4 h-4" /> Привязанные кроссы:
            </h4>
            
            <ul className="space-y-3 mb-4">
              {phantoms.length === 0 ? (
                <li className="text-sm text-slate-500 italic">Нет привязанных кроссов</li>
              ) : (
                phantoms.map((phantom) => (
                  <li key={phantom.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-slate-200 rounded-lg gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Ghost className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-bold text-slate-700 whitespace-nowrap">{phantom.article}</span>
                      <input
                        type="text"
                        defaultValue={phantom.brand}
                        onBlur={(e) => {
                          if (e.target.value !== phantom.brand) {
                            onUpdatePhantomInfo(phantom.id, { brandName: e.target.value });
                          }
                        }}
                        placeholder="Бренд"
                        className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded w-full max-w-[100px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        defaultValue={phantom.comment || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (phantom.comment || '')) {
                            onUpdatePhantomInfo(phantom.id, { comment: e.target.value });
                          }
                        }}
                        placeholder="Комент"
                        className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded w-full flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          defaultValue={phantom.sellingPrice || ''}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val !== phantom.sellingPrice) {
                              onUpdatePhantomInfo(phantom.id, { sellingPrice: val });
                            }
                          }}
                          className="w-24 px-3 py-1.5 text-right bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Цена"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₽</span>
                      </div>
                      <button 
                        onClick={() => onRemovePhantom(phantom.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Добавить новый кросс:
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newPhantomSku}
                  onChange={(e) => {
                    setNewPhantomSku(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Артикул"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newPhantomBrand}
                  onChange={(e) => setNewPhantomBrand(e.target.value)}
                  placeholder="Производитель"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={newPhantomPrice}
                  onChange={(e) => setNewPhantomPrice(e.target.value)}
                  placeholder="Цена продажи"
                  className="w-full sm:w-32 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newPhantomComment}
                  onChange={(e) => setNewPhantomComment(e.target.value)}
                  placeholder="Коммент"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleAddPhantomClick}
                  className="px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* История приходов */}
          <div className="mb-4">
            <h4 className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
              <History className="w-4 h-4" /> История приходов
            </h4>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-center">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-slate-500 font-medium whitespace-nowrap">Дата</th>
                    <th className="py-2 px-3 text-slate-500 font-medium">№ Прихода</th>
                    <th className="py-2 px-3 text-slate-500 font-medium">Поставщик</th>
                    <th className="py-2 px-3 text-slate-500 font-medium">Кол-во</th>
                    <th className="py-2 px-3 text-slate-500 font-medium">Цена</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate-400">Загрузка истории...</td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate-400">Приходов по данному товару еще не было</td>
                    </tr>
                  ) : (
                    history.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                          {new Date(record.date).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="py-2 px-3">
                          {record.docId ? (
                            <button
                              onClick={() => onOpenDocument && onOpenDocument(record.docId)}
                              className="font-mono font-bold text-blue-600 hover:text-blue-800 bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Открыть документ"
                            >
                              {record.docNumber ? `№ ${record.docNumber}` : record.docId.slice(0, 8)}
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-700">{record.supplier}</td>
                        <td className="py-2 px-3 font-semibold text-emerald-600">+{record.qty}</td>
                        <td className="py-2 px-3 font-medium text-slate-700">{record.price.toLocaleString('ru-RU')} ₽</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center relative">
          
          {/* Custom Delete Confirmation Popover */}
          {showDeleteConfirm && (
            <div className="absolute bottom-full left-6 mb-2 bg-white border border-rose-200 shadow-lg rounded-xl p-4 w-72 animate-in slide-in-from-bottom-2 z-10">
              <h4 className="font-bold text-slate-800 mb-2">Удалить товар?</h4>
              <p className="text-sm text-slate-600 mb-4">
                Это действие полностью удалит {editedProduct.article} из базы данных.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    setIsDeleting(true);
                    setError(null);
                    const res = await onDelete?.(editedProduct.id);
                    if (res?.success) {
                      // Modal will be unmounted from parent automatically
                    } else {
                      setIsDeleting(false);
                      setShowDeleteConfirm(false);
                      if (res?.error) {
                        setError(`Ошибка: ${res.error}`);
                      }
                    }
                  }}
                  disabled={isDeleting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Удаление...' : 'Да, удалить'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button 
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Закрыть
            </button>
            {onDelete && editedProduct.id && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                title="Удалить товар"
                className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                  showDeleteConfirm 
                    ? 'bg-rose-600 text-white' 
                    : 'text-rose-500 hover:bg-rose-100 hover:text-rose-600'
                } disabled:opacity-50`}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {editedProduct.status === 'draft' && (
              <button 
                onClick={handlePublish}
                disabled={isDeleting}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <Rocket className="w-4 h-4" />
                Опубликовать
              </button>
            )}
            <button 
              onClick={() => onSave(editedProduct)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
