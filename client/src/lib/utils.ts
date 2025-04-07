import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export function getFileTypeIcon(fileType: string) {
  if (fileType.includes("pdf")) {
    return {
      bgColor: "bg-red-100",
      textColor: "text-red-500"
    };
  } else if (fileType.includes("docx")) {
    return {
      bgColor: "bg-blue-100",
      textColor: "text-blue-500"
    };
  } else if (fileType.includes("pptx")) {
    return {
      bgColor: "bg-yellow-100",
      textColor: "text-yellow-500"
    };
  } else {
    return {
      bgColor: "bg-gray-100",
      textColor: "text-gray-500"
    };
  }
}
