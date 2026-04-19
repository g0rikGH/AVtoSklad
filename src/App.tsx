import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StockView from './components/StockView';
import IncomeView from './components/IncomeView';
import ExpenseView from './components/ExpenseView';
import ReportsView from './components/ReportsView';
import PriceView from './components/PriceView';
import ProductModal from './components/ProductModal';
import { UserManagement } from './pages/UserManagement';
import { TabId, Partner, Document, ProductView, Brand, Location } from './types';
import api from './api/axios';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { Login } from './pages/Login';
import { AuthProvider } from './context/AuthContext';

function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('stock');
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256); // keep for init, but bypass later
  
  const startSidebarResize = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarRef.current?.offsetWidth || 256;

    const doDrag = (dragEvent: MouseEvent) => {
      requestAnimationFrame(() => {
        if (sidebarRef.current) {
          const newWidth = Math.max(200, Math.min(450, startWidth + dragEvent.clientX - startX));
          sidebarRef.current.style.width = `${newWidth}px`;
        }
      });
    };

    const stopDrag = () => {
      if (sidebarRef.current) setSidebarWidth(sidebarRef.current.offsetWidth);
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'col-resize';
  }, []);
  
  // Global State (API Driven)
  const [productsView, setProductsView] = useState<ProductView[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState<ProductView | null>(null);
  const [externalDocIdToOpen, setExternalDocIdToOpen] = useState<string | null>(null);

  // Background color mapping based on active tab
  const bgColors: Record<TabId, string> = {
    stock: 'bg-slate-50',
    income: 'bg-teal-50/50',
    expense: 'bg-rose-50/50',
    reports: 'bg-fuchsia-50/50',
    price: 'bg-amber-50/50',
    users: 'bg-slate-100',
  };

  const [isSaving, setIsSaving] = useState(false);

  // Шаг 1: Загрузка Каталога (GET)
  const fetchCatalog = React.useCallback(async () => {
    try {
      const res = await api.get('/catalog');
      setProductsView(res.data.data);
    } catch (error: any) {
      if (error.response && error.response.status === 401) return; // Silent catching for auth redirect
      console.error('Ошибка загрузки каталога:', error);
    }
  }, []);

  // Шаг 3: Справочники и Документы (GET)
  const fetchReferences = React.useCallback(async () => {
    try {
      const [brandsRes, locRes, partnersRes, docsRes] = await Promise.all([
        api.get('/catalog/brands').catch((e) => { if (e.response?.status !== 401) console.error(e); return { data: { data: [] } }; }),
        api.get('/catalog/locations').catch((e) => { if (e.response?.status !== 401) console.error(e); return { data: { data: [] } }; }),
        api.get('/partners').catch((e) => { if (e.response?.status !== 401) console.error(e); return { data: { data: [] } }; }),
        api.get('/documents').catch((e) => { if (e.response?.status !== 401) console.error(e); return { data: { data: [] } }; })
      ]);
      setBrands(brandsRes.data?.data || []);
      setLocations(locRes.data?.data || []);
      setPartners(partnersRes.data?.data || []);
      setDocuments(docsRes.data?.data || []);
    } catch (error: any) {
      if (error.response && error.response.status === 401) return;
      console.error('Ошибка загрузки справочников:', error);
    }
  }, []);

  // Загружаем данные при старте компонента
  useEffect(() => {
    fetchCatalog();
    fetchReferences();
  }, [fetchCatalog, fetchReferences]);

  const handleSaveProduct = React.useCallback(async (updatedProductView: ProductView) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Handle brand creation if it's a temporary ID
      let finalBrandId = updatedProductView.brandId;
      if (finalBrandId.startsWith('temp_b_')) {
        const brandRes = await api.post('/catalog/brands', { name: updatedProductView.brand });
        finalBrandId = brandRes.data.data.id;
      }

      // Handle location creation if it's a temporary ID
      let finalLocationId = updatedProductView.locationId;
      if (finalLocationId && finalLocationId.startsWith('temp_l_')) {
        const locRes = await api.post('/catalog/locations', { name: updatedProductView.location });
        finalLocationId = locRes.data.data.id;
      }

      // Update Catalog API calls
      await api.put(`/catalog/${updatedProductView.id}`, {
        article: updatedProductView.article,
        name: updatedProductView.name,
        brandId: finalBrandId,
        locationId: finalLocationId,
        comment: updatedProductView.comment,
        purchasePrice: updatedProductView.purchasePrice,
        sellingPrice: updatedProductView.sellingPrice,
        status: updatedProductView.status
      });

      // Refetch catalog to show updated data
      await fetchCatalog();
      setSelectedProduct(null);
    } catch (err) {
      console.error('Failed to update product', err);
      alert('Ошибка при сохранении карточки товара');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, fetchCatalog]);

  const handleAddPartner = React.useCallback(async (name: string, type: 'supplier' | 'client') => {
    try {
      const res = await api.post('/partners', { 
        name, 
        type: type === 'supplier' ? 'SUPPLIER' : 'CLIENT' 
      });
      if (res.data.success) {
        setPartners(prev => [...prev, res.data.data]);
        return res.data.data;
      }
    } catch (error) {
      console.error('Ошибка добавления контрагента:', error);
      alert('Не удалось добавить контрагента');
    }
  }, []);

  const handleUpdatePartnerConfig = async (id: string, importConfig: string) => {
    try {
      const res = await api.put(`/partners/${id}/config`, { importConfig });
      if (res.data.success) {
        setPartners(prev => prev.map(p => p.id === id ? { ...p, importConfig } : p));
      }
    } catch (error) {
      console.error('Ошибка обновления конфигурации контрагента:', error);
    }
  };

  const handleCreateMissingProduct = async (data: { article: string; brandName: string; productName: string; parentId?: string; price?: number }) => {
    const article = data.article.trim().toUpperCase();
    const brandName = data.brandName.trim().toUpperCase();
    const { productName, parentId, price } = data;
    try {
      if (/[А-Яа-яЁё]/.test(article)) {
        console.error('Ошибка: артикул содержит кириллицу', article);
        return null;
      }

      let brandId = '';
      const existingBrand = brands.find(b => b.name.toLowerCase() === (brandName || 'Без бренда').toLowerCase());
      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        const brandRes = await api.post('/catalog/brands', { name: brandName || 'Без бренда' });
        brandId = brandRes.data.data.id;
        setBrands(prev => [...prev, brandRes.data.data]);
      }

      const status = 'DRAFT'; // Always draft on import as selling price is not set yet
      const payload = {
        article,
        name: productName || 'Новый товар',
        brandId,
        type: parentId ? 'PHANTOM' : 'REAL',
        parentId: parentId || undefined,
        status: status
      };
      
      const productRes = await api.post('/catalog', payload);
      const newProduct = productRes.data.data;

      // Update ONLY purchase price if provided, sellingPrice stays 0
      if (price && price > 0) {
        await api.put(`/catalog/${newProduct.id}`, {
          purchasePrice: price,
          sellingPrice: 0, // Explicitly 0 for draft
          status: 'DRAFT'
        });
      }

      const productViewObject = { 
        ...newProduct, 
        type: newProduct.type.toLowerCase(),
        brand: brandName || 'Без бренда',
        location: 'Не на полке',
        qty: 0, 
        purchasePrice: price || 0, 
        sellingPrice: 0,
        status: 'draft'
      };
      
      setProductsView(prev => [...prev, productViewObject]);
      return productViewObject;
    } catch (e) {
      console.error('Ошибка при создании нового товара', e);
      return null;
    }
  };

  // Шаг 2: Проведение Накладной (POST)
  const handleSaveDocument = async (doc: Document): Promise<{ success: boolean; error?: string }> => {
    try {
      // Формируем payload на основе нашего DTO (CreateDocumentDto)
      const payload = {
        type: doc.type.toUpperCase(), // 'income' | 'expense' -> 'INCOME' | 'EXPENSE'
        partnerId: doc.partnerId,
        totalAmount: doc.totalAmount,
        rows: doc.rows.map(row => ({
          productId: row.productId,
          qty: row.qty,
          price: row.price
        }))
      };

      // Отправляем запрос
      await api.post('/documents', payload);
      
      // Обновляем состояние каталога (остатки и цены) и историю документов
      await Promise.all([
        fetchCatalog(),
        fetchReferences()
      ]);
      return { success: true };
    } catch (error: any) {
      // Отлавливаем ошибку, включая тупиковые CHECK (недостаток товара)
      let errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка при проведении документа';
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join(', '); // For class-validator DTO arrays
      }
      console.error('Order creation error:', error);
      return { success: false, error: errorMessage };
    }
  };

  const handleRollbackDocument = async (documentId: string) => {
    console.log('App: handleRollbackDocument triggered for:', documentId);
    if (!documentId || String(documentId).startsWith('doc_')) {
      alert('Ошибка: Нельзя отменить несохраненный документ. Пожалуйста, обновите страницу.');
      return;
    }

    try {
      const res = await api.post(`/documents/${documentId}/rollback`);
      console.log('App: Rollback API response:', res.data);
      if (res.data.success) {
        await Promise.all([
          fetchReferences(),
          fetchCatalog()
        ]);
        alert('Документ успешно отменен! Все связанные остатки на складе скорректированы.');
      } else {
        alert('Ошибка при отмене: ' + (res.data.message || 'неизвестная ошибка сервера'));
      }
    } catch (err: any) {
      console.error('App: Failed to rollback document', err);
      const msg = err.response?.data?.message || err.message;
      alert('Не удалось отменить документ: ' + msg);
      throw err;
    }
  };

  const handleAddPhantom = async (parentId: string, sku: string, price: number, brandName: string, comment: string) => {
    try {
      const parentProduct = productsView.find(c => c.id === parentId);
      if (!parentProduct) return;

      let finalBrandId = parentProduct.brandId; // default to parent's brand
      if (brandName) {
        const existingBrand = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
        if (existingBrand) {
          finalBrandId = existingBrand.id;
        } else {
          const brandRes = await api.post('/catalog/brands', { name: brandName });
          finalBrandId = brandRes.data.data.id;
          setBrands(prev => [...prev, brandRes.data.data]);
        }
      }

      const payload = {
        article: sku,
        name: `${parentProduct.name} (кросс)`,
        brandId: finalBrandId,
        type: 'PHANTOM',
        parentId: parentId,
        comment: comment || undefined
      };

      const productRes = await api.post('/catalog', payload);
      
      if (price > 0) {
        await api.put(`/catalog/${productRes.data.data.id}`, {
          sellingPrice: price
        });
      }

      await fetchCatalog();
    } catch (err) {
      console.error('Failed to create phantom product', err);
    }
  };

  const handleRemovePhantom = async (phantomId: string) => {
    if (!window.confirm('Вы уверены, что хотите отвязать этот кросс-артикул?')) {
      return;
    }
    try {
      await api.delete(`/catalog/${phantomId}`);
      await fetchCatalog();
    } catch (err) {
      console.error('Failed to delete phantom product', err);
    }
  };

  const handleDeleteProduct = async (productId: string): Promise<{success: boolean, error?: string}> => {
    try {
      const res = await api.delete(`/catalog/${productId}`);
      if (res.data.success) {
        await fetchCatalog();
        setSelectedProduct(null);
        return { success: true };
      }
      return { success: false };
    } catch (err: any) {
      console.error('Ошибка при удалении товара', err);
      // Возвращаем сообщение об ошибке, чтобы UI мог его отрендерить 
      // (т.к. alert заблокирован в iframe)
      const msg = err.response?.data?.message || err.message;
      return { success: false, error: msg };
    }
  };

  const handleUpdatePhantomInfo = async (phantomId: string, updates: any) => {
    try {
      const apiUpdates: any = {};

      if (updates.brandName !== undefined) {
        let finalBrandId = null;
        if (updates.brandName) {
           const existingBrand = brands.find(b => b.name.toLowerCase() === updates.brandName.toLowerCase());
           if (existingBrand) {
             finalBrandId = existingBrand.id;
           } else {
             const brandRes = await api.post('/catalog/brands', { name: updates.brandName });
             finalBrandId = brandRes.data.data.id;
             setBrands(prev => [...prev, brandRes.data.data]);
           }
        }
        apiUpdates.brandId = finalBrandId;
      }
      
      if (updates.sellingPrice !== undefined) {
         apiUpdates.sellingPrice = updates.sellingPrice;
      }

      if (updates.comment !== undefined) {
        apiUpdates.comment = updates.comment;
      }
      
      if (Object.keys(apiUpdates).length > 0) {
        await api.put(`/catalog/${phantomId}`, apiUpdates);
      }
      
      await fetchCatalog();
    } catch (err) {
      console.error('Failed to update phantom info', err);
    }
  };

  const suppliers = partners.filter(p => p.type === 'supplier');
  const clients = partners.filter(p => p.type === 'client');

  return (
    <div className={`flex min-h-screen transition-colors duration-500 ease-in-out ${bgColors[activeTab]}`}>
      <Sidebar ref={sidebarRef} activeTab={activeTab} onTabChange={setActiveTab} width={sidebarWidth} />
      
      {/* Sidebar Resize Handle */}
      <div 
        onMouseDown={startSidebarResize}
        className="w-1.5 cursor-col-resize bg-transparent hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-50 flex-shrink-0"
        title="Перетащите, чтобы изменить ширину меню"
      />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'stock' && (
            <StockView 
              products={productsView} 
              onOpenProduct={setSelectedProduct} 
              onRefresh={fetchCatalog}
            />
          )}
          
          {activeTab === 'income' && (
            <IncomeView 
              suppliers={suppliers} 
              products={productsView}
              documents={documents}
              locations={locations}
              onAddSupplier={(name) => handleAddPartner(name, 'supplier')} 
              onSaveDocument={handleSaveDocument}
              onRollbackDocument={handleRollbackDocument}
              onCreateMissingProduct={handleCreateMissingProduct}
              onSaveLocations={async (updates: {productId: string, locationName: string}[]) => {
                try {
                  let currentLocations = [...locations];
                  for (const { productId, locationName } of updates) {
                    let finalLocationId = null;
                    if (locationName && locationName.trim()) {
                      const existingLoc = currentLocations.find(l => l.name.toLowerCase() === locationName.trim().toLowerCase());
                      if (existingLoc) {
                        finalLocationId = existingLoc.id;
                      } else {
                        const res = await api.post('/catalog/locations', { name: locationName.trim() });
                        finalLocationId = res.data.data.id;
                        currentLocations.push(res.data.data);
                      }
                    }
                    await api.put(`/catalog/${productId}`, { locationId: finalLocationId });
                  }
                  
                  // Only update state after full success
                  setLocations(currentLocations);
                  await fetchCatalog();
                } catch (err) {
                  console.error('Failed to update product locations', err);
                  throw err; // throw back to let the child know it failed
                }
              }}
              externalSelectedDocumentId={externalDocIdToOpen}
              onClearExternalDocument={() => setExternalDocIdToOpen(null)}
              onUpdateSupplierConfig={handleUpdatePartnerConfig}
            />
          )}
          
          {activeTab === 'expense' && (
            <ExpenseView 
              clients={clients} 
              products={productsView}
              documents={documents.filter(d => d.type === 'expense')}
              onAddClient={(name) => handleAddPartner(name, 'client')} 
              onSaveDocument={handleSaveDocument}
              onRollbackDocument={handleRollbackDocument}
              onUpdateClientConfig={handleUpdatePartnerConfig}
            />
          )}
          
          {activeTab === 'reports' && <ReportsView />}
          
          {activeTab === 'price' && <PriceView products={productsView} />}

          {activeTab === 'users' && <UserManagement />}
        </div>
      </main>

      {/* Modals */}
      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          allProducts={productsView}
          brands={brands}
          locations={locations}
          onClose={() => setSelectedProduct(null)}
          onSave={handleSaveProduct}
          onDelete={handleDeleteProduct}
          onAddPhantom={handleAddPhantom}
          onRemovePhantom={handleRemovePhantom}
          onUpdatePhantomInfo={handleUpdatePhantomInfo}
          onOpenDocument={(docId) => {
            setSelectedProduct(null);
            setActiveTab('income');
            setExternalDocIdToOpen(docId);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

