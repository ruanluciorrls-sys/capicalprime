/**
 * Tradução e descrição das features premium em PT-BR.
 * Master Admin libera/restringe por usuário no painel admin.
 */
export const FEATURE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  AUTO_PAYMENT: {
    label: 'Pagamento Automático',
    description: 'O sistema paga o QR automaticamente assim que recebe — sem precisar clicar em "Aprovar".',
    icon: '⚡',
  },
  BULK_QR: {
    label: 'QR em Lote',
    description: 'Permite colar vários QR Codes de uma vez e pagar todos juntos.',
    icon: '📦',
  },
  API_ACCESS: {
    label: 'Acesso à API',
    description: 'Pode usar a API Key para integrar com sistemas externos e scripts próprios.',
    icon: '🔌',
  },
  WEBHOOK: {
    label: 'Webhooks',
    description: 'Recebe notificações em tempo real (HTTP) quando pagamentos são concluídos.',
    icon: '🔔',
  },
};

export const ALL_FEATURES = Object.keys(FEATURE_LABELS) as Array<keyof typeof FEATURE_LABELS>;
