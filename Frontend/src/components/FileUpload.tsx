import { AlertCircle, CheckCircle2, FileIcon, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { apiFetch } from '../lib/apiClient';

interface FileUploadProps {
    onUploadComplete?: (blobName: string) => void;
    onUploadError?: (error: string) => void;
    supportTicketId?: string;
    maxSizeMB?: number;
    allowedTypes?: string[];
    className?: string;
}

interface UploadingFile {
    file: File;
    progress: number;
    status: 'uploading' | 'success' | 'error';
    error?: string;
    blobName?: string;
}

const DEFAULT_ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
];

const DEFAULT_ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.csv', '.zip'
];

export function FileUpload({
    onUploadComplete,
    onUploadError,
    supportTicketId,
    maxSizeMB = 100,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    className = '',
}: FileUploadProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        // Check file size
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return `File size exceeds ${maxSizeMB}MB limit`;
        }

        // Check file type
        if (!allowedTypes.includes(file.type)) {
            return `File type not allowed. Allowed types: ${DEFAULT_ALLOWED_EXTENSIONS.join(', ')}`;
        }

        // Check file extension
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!DEFAULT_ALLOWED_EXTENSIONS.includes(extension)) {
            return `File extension not allowed`;
        }

        return null;
    };

    const uploadFile = async (file: File) => {
        const fileId = `${file.name}-${Date.now()}`;

        // Add to uploading files
        setUploadingFiles(prev => new Map(prev).set(fileId, {
            file,
            progress: 0,
            status: 'uploading',
        }));

        try {
            // Step 1: Request SAS token from backend
            const tokenResponse = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/support/upload/sas-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileSize: file.size,
                    contentType: file.type,
                }),
            });

            if (!tokenResponse.ok) {
                const error = await tokenResponse.json();
                throw new Error(error.message || 'Failed to get upload token');
            }

            const { data } = await tokenResponse.json();
            const { uploadUrl, blobName } = data;

            // Step 2: Upload directly to Azure Blob Storage with progress tracking
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    setUploadingFiles(prev => {
                        const updated = new Map(prev);
                        const fileData = updated.get(fileId);
                        if (fileData) {
                            updated.set(fileId, { ...fileData, progress });
                        }
                        return updated;
                    });
                }
            });

            await new Promise<void>((resolve, reject) => {
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });

                xhr.addEventListener('abort', () => {
                    reject(new Error('Upload cancelled'));
                });

                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
                xhr.setRequestHeader('Content-Type', file.type);
                xhr.send(file);
            });

            // Step 3: Confirm upload with backend
            await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/support/upload/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    blobName,
                    supportTicketId,
                }),
            });

            // Update status to success
            setUploadingFiles(prev => {
                const updated = new Map(prev);
                const fileData = updated.get(fileId);
                if (fileData) {
                    updated.set(fileId, { ...fileData, status: 'success', progress: 100, blobName });
                }
                return updated;
            });

            onUploadComplete?.(blobName);

            // Remove from list after 3 seconds
            setTimeout(() => {
                setUploadingFiles(prev => {
                    const updated = new Map(prev);
                    updated.delete(fileId);
                    return updated;
                });
            }, 3000);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';

            setUploadingFiles(prev => {
                const updated = new Map(prev);
                const fileData = updated.get(fileId);
                if (fileData) {
                    updated.set(fileId, { ...fileData, status: 'error', error: errorMessage });
                }
                return updated;
            });

            onUploadError?.(errorMessage);
        }
    };

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;

        Array.from(files).forEach(file => {
            const error = validateFile(file);
            if (error) {
                onUploadError?.(error);
                return;
            }

            uploadFile(file);
        });
    }, [maxSizeMB, allowedTypes]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [handleFiles]);

    const removeFile = (fileId: string) => {
        setUploadingFiles(prev => {
            const updated = new Map(prev);
            updated.delete(fileId);
            return updated;
        });
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className={className}>
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 hover:border-[#DDEF00]
          ${isDragging
                        ? 'border-[#DDEF00] bg-[#DDEF00]/10'
                        : isDark
                            ? 'border-neutral-700 bg-[rgba(15,15,15,0.65)] hover:bg-[rgba(15,15,15,0.85)]'
                            : 'border-neutral-300 bg-white hover:bg-neutral-50'
                    }
        `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    accept={allowedTypes.join(',')}
                    className="hidden"
                />

                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />

                <p className={`text-lg font-medium mb-2 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    {isDragging ? 'Drop files here' : 'Drag & drop files here'}
                </p>

                <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    or click to browse
                </p>

                <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    Max file size: {maxSizeMB}MB • Allowed: {DEFAULT_ALLOWED_EXTENSIONS.join(', ')}
                </p>
            </div>

            {/* Uploading Files List */}
            {uploadingFiles.size > 0 && (
                <div className="mt-4 space-y-2">
                    {Array.from(uploadingFiles.entries()).map(([fileId, fileData]) => (
                        <div
                            key={fileId}
                            className={`
                p-4 rounded-lg border
                ${isDark
                                    ? 'bg-[rgba(15,15,15,0.65)] border-neutral-800'
                                    : 'bg-white border-neutral-200'
                                }
              `}
                        >
                            <div className="flex items-start gap-3">
                                {/* File Icon */}
                                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                  ${fileData.status === 'success'
                                        ? 'bg-green-500/20'
                                        : fileData.status === 'error'
                                            ? 'bg-red-500/20'
                                            : 'bg-blue-500/20'
                                    }
                `}>
                                    {fileData.status === 'success' ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    ) : fileData.status === 'error' ? (
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    ) : (
                                        <FileIcon className="w-5 h-5 text-blue-500" />
                                    )}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                                        {fileData.file.name}
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                        {formatFileSize(fileData.file.size)}
                                    </p>

                                    {/* Progress Bar */}
                                    {fileData.status === 'uploading' && (
                                        <div className="mt-2">
                                            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                                                <div
                                                    className="h-full bg-[#DDEF00] transition-all duration-300"
                                                    style={{ width: `${fileData.progress}%` }}
                                                />
                                            </div>
                                            <p className={`text-xs mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                                {fileData.progress}%
                                            </p>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {fileData.status === 'error' && fileData.error && (
                                        <p className="text-xs text-red-500 mt-1">{fileData.error}</p>
                                    )}

                                    {/* Success Message */}
                                    {fileData.status === 'success' && (
                                        <p className="text-xs text-green-500 mt-1">Upload complete!</p>
                                    )}
                                </div>

                                {/* Status Icon */}
                                <div className="shrink-0">
                                    {fileData.status === 'uploading' ? (
                                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                    ) : fileData.status === 'error' ? (
                                        <button
                                            onClick={() => removeFile(fileId)}
                                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                        >
                                            <X className="w-4 h-4 text-red-500" />
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
