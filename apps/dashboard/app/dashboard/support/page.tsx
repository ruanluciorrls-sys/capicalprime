'use client';
import { HelpCircle, MessageCircle, ExternalLink } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <HelpCircle className="w-6 h-6 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Central de Suporte</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
        {/* WhatsApp Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 flex flex-col items-center text-center hover:bg-slate-700/30 transition-colors shadow-lg">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
            <MessageCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Atendimento WhatsApp</h2>
          <p className="text-slate-400 mb-8">
            Fale diretamente com nossa equipe de suporte para tirar dúvidas, reportar problemas ou dar sugestões.
          </p>
          <a
            href="https://wa.link/zzjhks"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all hover:scale-105 w-full justify-center text-lg"
          >
            Abrir WhatsApp
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      <div className="mt-8 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 max-w-md mx-auto">
        <h3 className="text-lg font-bold text-amber-400 mb-2">Horário de Atendimento</h3>
        <p className="text-sm text-slate-300">
          Nossa equipe está disponível de <strong>Segunda a Sexta-feira, das 09h às 18h</strong>. 
          Mensagens enviadas fora deste horário serão respondidas no próximo dia útil.
        </p>
      </div>
    </div>
  );
}
