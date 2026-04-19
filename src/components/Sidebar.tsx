import React, { forwardRef } from 'react';
import { 
  PackageSearch, 
  ArrowRightToLine, 
  FileMinus2, 
  PieChart, 
  FileSpreadsheet,
  CarFront,
  ShieldAlert,
  LogOut
} from 'lucide-react';
import { TabId } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  width: number;
}

const Sidebar = forwardRef<HTMLElement, SidebarProps>(({ activeTab, onTabChange, width }, ref) => {
  const { user, logout } = useAuth();
  
  const navItems: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'stock', label: 'Остатки на складе', icon: PackageSearch },
    { id: 'income', label: 'Приход товара', icon: ArrowRightToLine },
    { id: 'expense', label: 'Списание / Расход', icon: FileMinus2 },
    { id: 'reports', label: 'Отчеты', icon: PieChart },
    { id: 'price', label: 'Прайс-лист', icon: FileSpreadsheet },
  ];

  if (user?.role === 'ADMIN') {
    navItems.push({ id: 'users', label: 'Управление доступом', icon: ShieldAlert });
  }

  return (
    <nav 
      ref={ref}
      className="min-h-screen bg-slate-900 text-white flex flex-col pt-6 pb-4 flex-shrink-0 relative transition-[width] duration-75 ease-out overflow-hidden"
      style={{ width }}
    >
      <div className="flex items-center justify-center gap-2 mb-8 px-4">
        <CarFront className="w-6 h-6 text-slate-100" />
        <h1 className="text-xl font-bold tracking-widest uppercase">ERP System</h1>
      </div>
      
      <ul className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-none transition-colors duration-200 whitespace-nowrap overflow-hidden ${
                  isActive 
                    ? 'bg-slate-800 text-white font-bold tracking-wide border-l-2 border-white' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-l-2 border-transparent font-medium'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate uppercase text-xs">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-3 mt-4 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between px-4">
           <div className="flex flex-col overflow-hidden">
             <span className="text-xs font-bold text-white uppercase tracking-widest truncate">{user?.name}</span>
             <span className="text-[10px] text-slate-400 uppercase">{user?.role}</span>
           </div>
           <button onClick={logout} className="text-slate-400 hover:text-white p-2 transition-colors">
              <LogOut className="w-4 h-4" />
           </button>
        </div>
      </div>
    </nav>
  );
});

export default Sidebar;
