'use client';

import { useState, useEffect } from 'react';
import { Key, X, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { getApiKey, setApiKey, isUsingDefault } from '@/lib/apiKey';

export function ApiKeyModal() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [usingDefault, setUsingDefault] = useState(false);

  useEffect(() => {
    setUsingDefault(isUsingDefault());
  }, []);

  const testAndSave = async () => {
    if (!key.trim()) return;
    setStatus('testing');
    try {
      const res = await fetch('/api/users/me', {
        headers: { 'X-Api-Key': key.trim() },
      });
      if (res.ok) {
        setApiKey(key.trim());
        setStatus('ok');
        setUsingDefault(false);
        setTimeout(() => { setOpen(false); setStatus('idle'); }, 1200);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Configurar API Key"
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-xl transition-all duration-300 hover:scale-105 ${
          usingDefault
            ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
            : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
        }`}
      >
        <Key className="w-4 h-4" />
        {usingDefault ? 'Chave padrão (configurar)' : 'API Key configurada'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Configurar API Key</h3>
              <p className="text-xs text-gray-500 mt-0.5">Cole a chave gerada pelo backend</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {usingDefault && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                Usando chave padrão <code className="bg-amber-500/20 px-1 rounded">AIOS_DEFAULT_KEY_2025</code>.
                Cadastre sua própria chave para produção.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Sua API Key
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={key}
                onChange={(e) => { setKey(e.target.value); setStatus('idle'); }}
                placeholder="Cole sua API Key aqui..."
                className="input pr-10"
                onKeyDown={(e) => e.key === 'Enter' && testAndSave()}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {status === 'ok' && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Chave válida! Salvando...</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-400 text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4" />
              <span>Chave inválida ou backend indisponível.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={() => setOpen(false)}
            className="btn-outline flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={testAndSave}
            disabled={!key.trim() || status === 'testing'}
            className="btn-primary flex-1"
          >
            {status === 'testing' ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Validando...
              </span>
            ) : 'Salvar Chave'}
          </button>
        </div>
      </div>
    </div>
  );
}
