import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { AlertCircle, Save, Loader2 } from 'lucide-react';

interface CorrectionBatch {
  id: string;
  productId: string;
  documentRowId: string;
  originalQuantity: number;
  remainingQuantity: number;
  purchasePrice: number;
  createdAt: string;
  product: {
    article: string;
    name: string;
    brand: { name: string } | null;
  };
}

export default function CostCorrectionQueue() {
  const [batches, setBatches] = useState<CorrectionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get('/batches/correction-queue');
      setBatches(res.data.data);
    } catch (err) {
      console.error('Failed to fetch correction queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleUpdateCost = async (batchId: string, newCost: number) => {
    try {
      await api.patch(`/batches/${batchId}/cost`, { purchasePrice: newCost });
      setBatches(prev => prev.filter(b => b.id !== batchId));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update cost', err);
      alert('Ошибка при сохранении себестоимости');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Корректировка себестоимости</h2>
          <p className="text-sm text-slate-500">Партии, загруженные как начальные остатки с нулевой закупочной ценой</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Артикул</th>
                <th className="px-6 py-4">Бренд</th>
                <th className="px-6 py-4">Наименование</th>
                <th className="px-6 py-4">Остаток</th>
                <th className="px-6 py-4">Дата загрузки</th>
                <th className="px-6 py-4 w-48">Реальная закупка (₽)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{batch.product.article}</td>
                  <td className="px-6 py-4 text-slate-600">{batch.product.brand?.name || '-'}</td>
                  <td className="px-6 py-4 text-slate-700">{batch.product.name}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800">{batch.remainingQuantity}</span>
                    <span className="text-slate-500 ml-1 text-xs">шт</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(batch.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        id={`cost-input-${batch.id}`}
                        className="w-24 px-3 py-1.5 font-bold border border-orange-300 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-white"
                        defaultValue={batch.purchasePrice}
                        min="0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateCost(batch.id, parseFloat((e.target as HTMLInputElement).value) || 0);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`cost-input-${batch.id}`) as HTMLInputElement;
                          if (input) handleUpdateCost(batch.id, parseFloat(input.value) || 0);
                        }}
                        className="p-1.5 text-orange-600 bg-orange-100 hover:bg-orange-600 hover:text-white rounded transition-colors shrink-0"
                        title="Сохранить себестоимость"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                      <div className="text-lg font-medium text-slate-800">Все чисто</div>
                      <div className="text-sm">Нет партий, требующих корректировки себестоимости.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
