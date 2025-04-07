import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadProgressProps {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  onDismiss: () => void;
}

export function UploadProgress({
  filename,
  bytesTransferred,
  totalBytes,
  onDismiss,
}: UploadProgressProps) {
  const progress = Math.min(100, Math.round((bytesTransferred / totalBytes) * 100));

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 shadow-lg w-80 z-50">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-900">Uploading Document</h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-500 hover:text-gray-700"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-500 mb-2 truncate" title={filename}>
          {filename}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-secondary h-2.5 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          <span>{formatBytes(bytesTransferred)}</span> of{" "}
          <span>{formatBytes(totalBytes)}</span> ({progress}%)
        </p>
      </CardContent>
    </Card>
  );
}
