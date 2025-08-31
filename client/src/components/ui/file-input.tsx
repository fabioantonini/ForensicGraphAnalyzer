import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onFileSelect: (file: File) => void;
  label?: string;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
  buttonText?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export function FileInput({
  onFileSelect,
  label,
  accept = ".pdf,.docx,.pptx,.txt,.html,.png,.jpg,.jpeg",
  maxSize = 25 * 1024 * 1024, // 25MB default
  className = "",
  buttonText,
  icon = <Upload className="h-5 w-5 mr-2" />,
  helperText,
  ...props
}: FileInputProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Check file size
    if (file.size > maxSize) {
      setError(`File size exceeds the maximum limit of ${formatFileSize(maxSize)}`);
      return;
    }

    // Check file type
    if (accept) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const acceptedTypes = accept.split(',').map(type => 
        type.trim().replace('.', '').toLowerCase()
      );

      if (fileExtension && !acceptedTypes.includes(fileExtension)) {
        setError(`File type .${fileExtension} is not supported`);
        return;
      }
    }

    onFileSelect(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Set defaults using translations
  const defaultLabel = t('documents.uploadAFile');
  const defaultButtonText = t('documents.selectFile');
  const defaultHelperText = t('documents.fileFormatInfo');

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={accept}
          className="hidden"
          {...props}
        />
        <Button 
          type="button" 
          onClick={handleButtonClick}
          variant="outline"
          className="w-full h-auto py-6 border-2 border-dashed flex flex-col items-center justify-center"
        >
          <div className="flex flex-col items-center justify-center">
            {icon}
            <span>{buttonText || defaultButtonText}</span>
            <p className="text-xs text-gray-500 mt-1">{helperText || defaultHelperText}</p>
          </div>
        </Button>
        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>
    </div>
  );
}

export function SelectedFile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatFileType = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return t('documents.pdfDocument');
      case 'docx':
        return t('documents.wordDocument');
      case 'pptx':
        return t('documents.powerPointPresentation');
      case 'txt':
        return t('documents.textDocument');
      case 'html':
        return t('documents.htmlDocument');
      default:
        return t('documents.unknownType');
    }
  };

  return (
    <div className="mt-4 p-3 bg-muted rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {file.name.endsWith('.pdf') ? (
            <div className="bg-red-100 p-2 rounded-md mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          ) : file.name.endsWith('.docx') ? (
            <div className="bg-blue-100 p-2 rounded-md mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          ) : file.name.endsWith('.pptx') ? (
            <div className="bg-yellow-100 p-2 rounded-md mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          ) : file.name.endsWith('.txt') ? (
            <div className="bg-green-100 p-2 rounded-md mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          ) : file.name.endsWith('.html') ? (
            <div className="bg-purple-100 p-2 rounded-md mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <div className="bg-gray-100 p-2 rounded-md mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <span className="text-sm text-gray-700 truncate max-w-[200px]">
            {file.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {formatFileSize(file.size)} • {formatFileType(file.name)}
      </p>
    </div>
  );
}
