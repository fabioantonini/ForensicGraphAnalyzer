import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, FileImage, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SignatureDragDropZoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  accept?: Record<string, string[]>;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  selectedFile?: File | null;
}

export function SignatureDragDropZone({
  onFileSelect,
  isUploading = false,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.tiff', '.bmp']
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  className = '',
  title,
  subtitle,
  selectedFile = null
}: SignatureDragDropZoneProps) {
  const { t } = useTranslation();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles[0].errors;
      console.warn('File rejection:', errors);
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections
  } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: disabled || isUploading
  });

  const getStatusColor = () => {
    if (isDragReject || fileRejections.length > 0) return 'border-destructive bg-destructive/5';
    if (isDragActive) return 'border-primary bg-primary/5';
    if (selectedFile) return 'border-green-500 bg-green-50';
    if (disabled || isUploading) return 'border-muted bg-muted/20';
    return 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20';
  };

  const getIcon = () => {
    if (isDragReject) return <AlertTriangle className="h-8 w-8 text-destructive" />;
    if (isDragActive) return <FileImage className="h-8 w-8 text-primary" />;
    if (selectedFile) return <FileImage className="h-8 w-8 text-green-600" />;
    return <Upload className="h-8 w-8 text-muted-foreground" />;
  };

  const getMessage = () => {
    if (fileRejections.length > 0) {
      const error = fileRejections[0].errors[0];
      if (error.code === 'file-too-large') {
        return t('signatures.upload.fileTooLarge', 'File troppo grande (max 10MB)');
      }
      if (error.code === 'file-invalid-type') {
        return t('signatures.upload.invalidType', 'Formato non supportato');
      }
      return t('signatures.upload.invalidFile', 'File non valido');
    }

    if (isDragReject) {
      return t('signatures.upload.invalidDrop', 'Formato file non supportato');
    }

    if (isDragActive) {
      return t('signatures.upload.dropHere', 'Rilascia qui la firma');
    }

    if (isUploading) {
      return t('signatures.upload.uploading', 'Caricamento in corso...');
    }

    if (selectedFile) {
      return `✓ ${selectedFile.name}`;
    }

    return title || t('signatures.upload.dragDropTitle', 'Trascina qui la firma o clicca per selezionare');
  };

  const getSubMessage = () => {
    if (fileRejections.length > 0 || isDragReject) return null;
    
    return subtitle || t('signatures.upload.supportedFormats', 'Formati supportati: JPEG, PNG, TIFF, BMP (max 10MB)');
  };

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
            ${getStatusColor()}
            ${(disabled || isUploading) ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center gap-3">
            {getIcon()}
            
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {getMessage()}
              </p>
              
              {getSubMessage() && (
                <p className="text-xs text-muted-foreground">
                  {getSubMessage()}
                </p>
              )}
            </div>
          </div>
        </div>

        {fileRejections.length > 0 && (
          <div className="p-4 pt-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {fileRejections[0].errors[0].message}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}