import { RecentPayments } from '@/components/dashboard/RecentPayments';

export default function PaymentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Pagamentos / Histórico</h1>
        <p className="text-gray-400 mt-1">Acompanhe todos os pagamentos executados via API bancária.</p>
      </div>

      <RecentPayments />
    </div>
  );
}
