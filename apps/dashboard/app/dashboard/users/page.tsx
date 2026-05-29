'use client';
import { useEffect, useState } from 'react';
import { getApiKey } from '@/lib/apiKey';
import { Users, Activity, Shield } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  bankAdapter: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const apiKeyLocal = getApiKey();
      if (!apiKeyLocal) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/users', {
          headers: { 'X-Api-Key': apiKeyLocal },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.items || []);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Carregando usuários...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Users className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Monitoramento de Usuários</h1>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800 text-xs uppercase text-slate-300">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Último Acesso / IP</th>
                <th className="px-6 py-4">Provedor Bancário</th>
                <th className="px-6 py-4">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="font-medium text-slate-200">
                        {user.name || 'Sem nome'}
                        {user.role === 'ADMIN' && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.lastLoginAt ? (
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300">
                          {new Date(user.lastLoginAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        {user.lastLoginIp && (
                          <span className="text-xs text-slate-500 font-mono">
                            IP: {user.lastLoginIp}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Nunca acessou</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {user.bankAdapter || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhum usuário encontrado.
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
