import { Document, FilterOptions } from "@/lib/types";
import { DocumentCard } from "./document-card";
import { LoadingSpinner } from "../ui/loading-spinner";

interface DocumentGridProps {
  documents: Document[];
  isLoading: boolean;
  filters: FilterOptions;
}

export function DocumentGrid({ documents, isLoading, filters }: DocumentGridProps) {
  // Apply filters
  const filteredDocuments = documents.filter((doc) => {
    let match = true;
    
    // Filter by file type
    if (filters.fileType && filters.fileType !== "all") {
      match = match && doc.fileType.includes(filters.fileType);
    }
    
    // Filter by search term
    if (filters.searchTerm && filters.searchTerm !== "") {
      match = match && doc.originalFilename.toLowerCase().includes(filters.searchTerm.toLowerCase());
    }
    
    // Filter by date range (handled by the backend)
    if (filters.dateRange && filters.dateRange !== "all") {
      // The back-end would handle this in a real implementation
      // This is just for completeness in the client-side code
    }
    
    return match;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner text="Loading documents..." />
      </div>
    );
  }

  if (filteredDocuments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-muted-foreground mx-auto mb-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
            clipRule="evenodd"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
        <p className="text-gray-500">
          {documents.length === 0
            ? "Upload your first document to get started."
            : "No documents match your current filters."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredDocuments.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}
    </div>
  );
}
