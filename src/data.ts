import { CatalogItem, StockRecord, PriceRecord, Partner, Document, Brand, Location } from './types';

export const initialBrands: Brand[] = [
  { id: 'b1', name: 'VAG' },
  { id: 'b2', name: 'Nissan' },
  { id: 'b3', name: 'Toyota' },
];

export const initialLocations: Location[] = [
  { id: 'loc1', name: 'Стеллаж А-12' },
  { id: 'loc2', name: 'Стеллаж Б-3' },
  { id: 'loc3', name: 'Стеллаж В-1' },
];

export const initialCatalog: CatalogItem[] = [
  {
    id: '1',
    article: 'L06L109259E',
    brandId: 'b1',
    name: 'Магнит клапана фазорегулятора',
    locationId: 'loc1',
    comment: 'Ходовой товар',
    type: 'real',
    status: 'active',
  },
  {
    id: '2',
    article: '06L109259a',
    brandId: 'b1',
    name: 'Магнит клапана (кросс)',
    locationId: null,
    comment: '',
    type: 'phantom',
    status: 'active',
    parentId: '1',
  },
  {
    id: '3',
    article: '15208-65F0A',
    brandId: 'b2',
    name: 'Фильтр масляный',
    locationId: 'loc2',
    comment: '',
    type: 'real',
    status: 'active',
  },
  {
    id: '4',
    article: '90915-10001',
    brandId: 'b3',
    name: 'Фильтр масляный',
    locationId: 'loc3',
    comment: 'Заказано 20 шт.',
    type: 'real',
    status: 'active',
  },
];

export const initialStock: StockRecord[] = [
  { productId: '1', qty: 15 },
  { productId: '3', qty: 8 },
  { productId: '4', qty: 0 },
];

export const initialPrices: PriceRecord[] = [
  { productId: '1', purchasePrice: 1000, sellingPrice: 1500 },
  { productId: '2', purchasePrice: 1000, sellingPrice: 1200 }, // Phantom specific selling price
  { productId: '3', purchasePrice: 450, sellingPrice: 800 },
  { productId: '4', purchasePrice: 300, sellingPrice: 600 },
];

export const initialPartners: Partner[] = [
  { id: 's1', name: 'ООО КитайПартс', type: 'supplier' },
  { id: 's2', name: 'ИП Иванов (Опт)', type: 'supplier' },
  { id: 's3', name: 'Local Parts Ltd.', type: 'supplier' },
  { id: 'c1', name: 'Иван (Розница)', type: 'client' },
  { id: 'c2', name: 'Автосервис "У Гаража"', type: 'client' },
  { id: 'c3', name: 'ООО АвтоВектор', type: 'client' },
];

export const initialDocuments: Document[] = [
  {
    id: 'doc_1710840000000',
    type: 'expense',
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 дня назад
    partnerId: 'c1', // Иван (Розница)
    rows: [
      { productId: '1', qty: 2, price: 1500 }
    ],
    totalAmount: 3000
  },
  {
    id: 'doc_1710926400000',
    type: 'expense',
    date: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 день назад
    partnerId: 'c2', // Автосервис "У Гаража"
    rows: [
      { productId: '1', qty: 1, price: 1500 },
      { productId: '3', qty: 2, price: 800 }
    ],
    totalAmount: 3100
  },
  {
    id: 'doc_1711012800000',
    type: 'expense',
    date: new Date().toISOString(), // сегодня
    partnerId: 'c3', // ООО АвтоВектор
    rows: [
      { productId: '3', qty: 1, price: 800 }
    ],
    totalAmount: 800
  }
];

