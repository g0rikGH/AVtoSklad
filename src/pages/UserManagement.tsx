import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { User, UserRole } from '../types';
import { Loader2, Plus, Shield, ShieldAlert, User as UserIcon, Edit2, Trash2, X, Check } from 'lucide-react';

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  // New user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('MANAGER');

  // Edit user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка загрузки пользователей');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsCreating(true);

    try {
      await api.post('/users/create', { email, password, name, role });
      await fetchUsers();
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
      setRole('MANAGER');
    } catch (err: any) {
      let msg = err.response?.data?.message || 'Ошибка при создании пользователя';
      if (Array.isArray(msg)) msg = msg.join(', ');
      setError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditingName(user.name);
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setIsSaving(true);
    try {
      await api.put(`/users/${id}`, { name: editingName.trim() });
      await fetchUsers();
      setEditingUserId(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка сохранения имени');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя ${user.email}?`)) {
      return;
    }
    
    try {
      await api.delete(`/users/${user.id}`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка удаления пользователя');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 border border-slate-200">
      <div className="mb-8 border-b-2 border-slate-900 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center">
          <ShieldAlert className="w-6 h-6 mr-2" />
          User Management
        </h2>
        <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">
          System Access Control & Administration
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Form Section */}
        <div className="xl:col-span-1 bg-slate-50 p-6 border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-900 uppercase mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-1" /> Provision User
          </h3>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-700 p-3 mb-4 text-sm text-red-800 font-medium whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-none border-slate-300 focus:border-slate-900 focus:ring-0 sm:text-sm bg-white"
                placeholder="user@erp.com"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Temporary Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-none border-slate-300 focus:border-slate-900 focus:ring-0 sm:text-sm bg-white"
                placeholder="Min 6 chars"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-none border-slate-300 focus:border-slate-900 focus:ring-0 sm:text-sm bg-white"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 block w-full rounded-none border-slate-300 focus:border-slate-900 focus:ring-0 sm:text-sm bg-white"
              >
                <option value="MANAGER">MANAGER (Standard Access)</option>
                <option value="ADMIN">ADMIN (Full Access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full mt-6 bg-slate-900 text-white font-bold uppercase tracking-wider text-sm py-2 px-4 border border-transparent focus:outline-none hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center"
            >
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create User
            </button>
          </form>
        </div>

        {/* Table Section */}
        <div className="xl:col-span-3 overflow-hidden border border-slate-200">
          <table className="min-w-full divide-y border-b border-slate-200 divide-slate-200 bg-white">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">
                  Employee
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-slate-100 flex items-center justify-center rounded-none border border-slate-300">
                        <UserIcon className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="ml-4 flex-1">
                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-2">
                             <input
                               type="text"
                               autoFocus
                               value={editingName}
                               onChange={(e) => setEditingName(e.target.value)}
                               className="block w-full rounded-none border-slate-300 focus:border-slate-900 focus:ring-0 sm:text-sm bg-white"
                               placeholder="Enter name"
                             />
                             <button
                               disabled={isSaving} 
                               onClick={() => handleSaveEdit(user.id)}
                               className="p-1 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                             >
                                <Check className="w-4 h-4" />
                             </button>
                             <button
                               onClick={cancelEditing}
                               className="p-1 bg-slate-200 text-slate-600 hover:bg-slate-300"
                             >
                                <X className="w-4 h-4" />
                             </button>
                          </div>
                        ) : (
                          <div className="text-sm font-bold text-slate-900">{user.name}</div>
                        )}
                        <div className="text-xs text-slate-500 tracking-wider">ID: {user.id.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900 font-medium">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold uppercase tracking-widest ${
                      user.role === 'ADMIN' 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-200 text-slate-800'
                    }`}>
                      {user.role === 'ADMIN' ? <Shield className="w-3 h-3 mr-1 mt-0.5" /> : null}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-3">
                       {editingUserId !== user.id && (
                         <button
                           onClick={() => startEditing(user)}
                           className="text-slate-500 hover:text-slate-900 transition-colors"
                           title="Удалить имя"
                         >
                           <Edit2 className="w-4 h-4" />
                         </button>
                       )}
                       <button
                         onClick={() => handleDeleteUser(user)}
                         className="text-red-400 hover:text-red-600 transition-colors"
                         title="Удалить пользователя"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
