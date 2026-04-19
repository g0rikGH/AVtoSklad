export type TabId = 'stock' | 'income' | 'expense' | 'reports' | 'price' | 'users';

export type UserRole = 'ADMIN' | 'MANAGER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
}

// 1. Catalog (Nomenclature)
export interface Brand {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  name: string;
}

export interface CatalogItem {
  id: string;
  article: string;
  brandId: string;
  name: string;
  locationId: string | null;
  comment?: string;
  type: 'real' | 'phantom';
  status: 'active' | 'draft' | 'archived';
  parentId?: string; // For phantoms, points to a real CatalogItem id
}

// 2. Stock Register
export interface StockRecord {
  productId: string;
  qty: number;
}

// 3. Pricing Register
export interface PriceRecord {
  productId: string;
  purchasePrice: number;
  sellingPrice: number;
}

// 4. Partners
export interface Partner {
  id: string;
  name: string;
  type: 'supplier' | 'client';
  importConfig?: string;
}

// 5. Documents (Transactions)
export interface DocumentRow {
  productId: string;
  qty: number;
  price: number; // Fixed price at the time of transaction
}

export interface Document {
  id: string;
  number?: number;
  name?: string;
  type: 'income' | 'expense';
  date: string;
  partnerId: string;
  rows: DocumentRow[];
  totalAmount: number;
}

// Helper type for the UI (Joined View)
export interface ProductView {
  id: string;
  article: string;
  brandId: string;
  brand: string;
  name: string;
  locationId: string | null;
  location: string | null;
  comment?: string;
  type: 'real' | 'phantom';
  parentId?: string;
  qty: number;
  purchasePrice: number;
  sellingPrice: number;
  status: 'active' | 'draft' | 'archived';
  batches?: { qty: number; price: number; date: string }[];
}

export interface ColumnMapping {
  startRow: number;
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
}

export interface ProductHistoryRecord {
  id: string;
  docId: string;
  docNumber?: number;
  date: string;
  supplier: string;
  qty: number;
  price: number;
}
