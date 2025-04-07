import { useQuery } from "@tanstack/react-query";
import { Stats, Activity } from "@/lib/types";
import { DocumentCard, QueryCard, StorageCard } from "@/components/dashboard/stats-card";
import { ActivityList } from "@/components/dashboard/activity-list";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <LoadingSpinner text="Loading dashboard data..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto py-6">
        <h2 className="text-2xl font-bold text-primary mb-6">Dashboard</h2>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">Failed to load dashboard data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h2 className="text-2xl font-bold text-primary mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <DocumentCard count={stats.documentCount} lastUpload={stats.lastUpload} />
        <QueryCard count={stats.queryCount} lastQuery={stats.lastQuery} />
        <StorageCard storageUsed={stats.storageUsed} />
      </div>
      
      <div className="mb-8">
        <ActivityList activities={stats.recentActivity} />
      </div>
      
      <QuickActions />
    </div>
  );
}
