import { useMemo } from 'react';
import { ProductView } from '../types';

export interface GroupedProductRow extends ProductView {
  isPhantom: boolean;
  groupIndex: number;
  parentName?: string;
}

export function useGroupedProducts(products: ProductView[], searchQuery: string): GroupedProductRow[] {
  return useMemo(() => {
    // 1. Organize into families
    const families = new Map<string, { parent: ProductView | null, phantoms: ProductView[] }>();
    const standalonePhantoms: ProductView[] = [];

    products.forEach(p => {
      if (p.type === 'real') {
        if (!families.has(p.id)) {
          families.set(p.id, { parent: p, phantoms: [] });
        } else {
          families.get(p.id)!.parent = p;
        }
      }
    });

    products.forEach(p => {
      if (p.type === 'phantom') {
        if (p.parentId && families.has(p.parentId)) {
          families.get(p.parentId)!.phantoms.push(p);
        } else {
          standalonePhantoms.push(p);
        }
      }
    });

    // 2. Filter families by search
    const lowerSearch = searchQuery.toLowerCase().trim();
    const filteredFamilyIds = new Set<string>();
    const filteredStandalonePhantoms = new Set<ProductView>();

    if (lowerSearch) {
      // Check families
      families.forEach((family, parentId) => {
        const parentMatch = family.parent && (
            family.parent.name.toLowerCase().includes(lowerSearch) ||
            family.parent.article.toLowerCase().includes(lowerSearch) ||
            family.parent.brand.toLowerCase().includes(lowerSearch)
        );
        const phantomMatch = family.phantoms.some(ph =>
            ph.name.toLowerCase().includes(lowerSearch) ||
            ph.article.toLowerCase().includes(lowerSearch) ||
            ph.brand.toLowerCase().includes(lowerSearch)
        );

        if (parentMatch || phantomMatch) {
          filteredFamilyIds.add(parentId);
        }
      });

      // Check standalone
      standalonePhantoms.forEach(ph => {
         if (ph.name.toLowerCase().includes(lowerSearch) || ph.article.toLowerCase().includes(lowerSearch) || ph.brand.toLowerCase().includes(lowerSearch)) {
             filteredStandalonePhantoms.add(ph);
         }
      });
    }

    // 3. Flatten and assign styles
    const result: GroupedProductRow[] = [];
    let groupCounter = 0;

    // Iterate all families or filtered
    families.forEach((family, parentId) => {
       if (lowerSearch && !filteredFamilyIds.has(parentId)) return;

       const currentGroupIndex = groupCounter++;

       if (family.parent) {
         result.push({ ...family.parent, isPhantom: false, groupIndex: currentGroupIndex });
       }

       // Sort phantoms by article (optional, but good for stability)
       family.phantoms.sort((a, b) => a.article.localeCompare(b.article));
       
       family.phantoms.forEach(ph => {
         result.push({ ...ph, isPhantom: true, groupIndex: currentGroupIndex, parentName: family.parent?.name });
       });
    });

    // Add standalone phantoms
    standalonePhantoms.forEach(ph => {
       if (lowerSearch && !filteredStandalonePhantoms.has(ph)) return;
       const currentGroupIndex = groupCounter++;
       result.push({ ...ph, isPhantom: true, groupIndex: currentGroupIndex });
    });

    return result;
  }, [products, searchQuery]);
}
