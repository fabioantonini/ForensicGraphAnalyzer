import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Activity, FormattedStorage } from "@/lib/types";
import { useTranslation } from "react-i18next";

interface StatsCardProps {
  title: string;
  value: string | number;
  label?: string;
  badgeText?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  subValue?: string;
  progress?: number;
}

export function StatsCard({
  title,
  value,
  label,
  badgeText,
  badgeColor = "bg-blue-100 text-info",
  icon,
  subValue,
  progress,
}: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-700">{title}</h3>
          {badgeText && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeColor}`}>
              {badgeText}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {icon && <div className="mr-3">{icon}</div>}
          <div>
            <p className="text-3xl font-bold text-primary">{value}</p>
            {subValue && (
              <p className="text-sm text-gray-700 mt-2">{subValue}</p>
            )}
          </div>
        </div>
        {progress !== undefined && (
          <>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
              <div
                className="bg-secondary h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-700 mt-2">{progress}% {label}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function formatStorageSize(bytes: number): FormattedStorage {
  const maxStorage = 500 * 1024 * 1024; // 500MB limit
  const percentage = Math.round((bytes / maxStorage) * 100);
  
  let formatted: string;
  if (bytes < 1024) {
    formatted = `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    formatted = `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    formatted = `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  
  return {
    bytes,
    formatted,
    percentage
  };
}

export function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never';
  return formatDistanceToNow(date, { addSuffix: true });
}

interface DocumentCardProps {
  count: number;
  lastUpload: Date | null;
}

export function DocumentCard({ count, lastUpload }: DocumentCardProps) {
  const { t } = useTranslation();
  return (
    <StatsCard
      title={t('dashboard.documents')}
      value={count}
      badgeText={t('common.total')}
      badgeColor="bg-blue-100 text-info"
      subValue={`${t('documents.lastUploaded')}: ${formatTimeAgo(lastUpload)}`}
    />
  );
}

interface QueryCardProps {
  count: number;
  lastQuery: Date | null;
}

export function QueryCard({ count, lastQuery }: QueryCardProps) {
  const { t } = useTranslation();
  return (
    <StatsCard
      title={t('dashboard.queries')}
      value={count}
      badgeText={t('common.thisMonth')}
      badgeColor="bg-green-100 text-secondary"
      subValue={`${t('dashboard.lastQuery')}: ${formatTimeAgo(lastQuery)}`}
    />
  );
}

interface StorageCardProps {
  storageUsed: number;
}

export function StorageCard({ storageUsed }: StorageCardProps) {
  const { t } = useTranslation();
  const storage = formatStorageSize(storageUsed);
  
  return (
    <StatsCard
      title={t('dashboard.storage')}
      value={storage.formatted}
      badgeText={t('common.storageLimit', { limit: '500MB' })}
      badgeColor="bg-yellow-100 text-warning"
      progress={storage.percentage}
      label={t('common.used')}
    />
  );
}
