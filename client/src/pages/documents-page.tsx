import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Search } from "lucide-react";
import { Document, FilterOptions } from "@/lib/types";
import { DocumentGrid } from "@/components/documents/document-grid";
import { UploadModal } from "@/components/documents/upload-modal";
import { useQuery } from "@tanstack/react-query";

export default function DocumentsPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    fileType: "",
    searchTerm: "",
    dateRange: "",
  });

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({
      ...filters,
      searchTerm: e.target.value,
    });
  };

  const handleFileTypeChange = (value: string) => {
    setFilters({
      ...filters,
      fileType: value,
    });
  };

  const handleDateRangeChange = (value: string) => {
    setFilters({
      ...filters,
      dateRange: value,
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-primary">Document Library</h2>
        <Button
          onClick={() => setShowUploadModal(true)}
          className="bg-secondary hover:bg-secondary-dark"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4">
            <div className="relative flex-1">
              <Input
                className="pl-10 pr-4 py-2"
                placeholder="Search documents..."
                value={filters.searchTerm}
                onChange={handleSearchChange}
              />
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            <div className="flex-shrink-0">
              <Select value={filters.fileType} onValueChange={handleFileTypeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                  <SelectItem value="pptx">PPTX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-shrink-0">
              <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <DocumentGrid
        documents={documents || []}
        isLoading={isLoading}
        filters={filters}
      />

      {/* Upload Modal */}
      <UploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
      />
    </div>
  );
}
