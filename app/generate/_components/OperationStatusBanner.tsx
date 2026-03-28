'use client';

type OperationStatusBannerProps = {
  operationPending: boolean;
  operationNotice: string;
  operationId?: string | null;
  statusLabel?: string | null;
};

export function OperationStatusBanner({
  operationPending,
  operationNotice,
  operationId,
  statusLabel,
}: OperationStatusBannerProps) {
  return (
    <section
      data-testid="operation-status-banner"
      className={`rounded-2xl border p-4 shadow-sm ${
        operationPending ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-gray-200 bg-gray-50 text-gray-700'
      }`}
    >
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold">{operationPending ? '后台任务处理中' : '后台任务状态'}</div>
          <div className="mt-1 text-sm">{operationNotice}</div>
        </div>
        {operationId && statusLabel && <div className="text-xs font-medium">{statusLabel} / {operationId}</div>}
      </div>
    </section>
  );
}
