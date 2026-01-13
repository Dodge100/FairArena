import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/apiClient';
import { useMutation } from '@tanstack/react-query';
import { Check, Loader2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { toast } from 'sonner';

interface ImageUploaderProps {
    currentImageUrl?: string | null;
    onUploadComplete: (url: string) => void;
    className?: string;
    uploadLabel?: string;
    showUserDetails?: boolean;
}

export const ImageUploader = ({
    currentImageUrl,
    onUploadComplete,
    className = '',
    uploadLabel = 'Change Photo',
    showUserDetails = true
}: ImageUploaderProps) => {
    const { user } = useAuth();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isSignLoading, setIsSignLoading] = useState(false);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }

            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result as string);
                setZoom(1);
            });
            reader.readAsDataURL(file);
        }
    };

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: Area
    ): Promise<Blob> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('No 2d context');
        }

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'));
                    return;
                }
                resolve(blob);
            }, 'image/jpeg', 0.95);
        });
    };

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!imageSrc || !croppedAreaPixels) throw new Error('No image to upload');

            setIsSignLoading(true);

            // 1. Get signature from backend
            const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
            const signatureResponse = await apiRequest<{
                success: boolean;
                data: {
                    signature: string;
                    timestamp: number;
                    folder: string;
                    apiKey: string;
                    cloudName: string;
                    eager?: string;
                    max_file_size?: number;
                    allowed_formats?: string;
                }
            }>(`${API_BASE}/api/v1/profile/image/signature`);

            const signatureData = signatureResponse; // apiRequest returns parsed body

            if (!signatureData.success) {
                throw new Error('Failed to get upload signature');
            }

            setIsSignLoading(false);
            const { signature, timestamp, folder, apiKey, cloudName, eager, max_file_size, allowed_formats } = signatureData.data;

            // 2. Crop image
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

            // 3. Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', croppedBlob);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp.toString());
            formData.append('signature', signature);
            formData.append('folder', folder);

            if (max_file_size) formData.append('max_file_size', max_file_size.toString());
            if (allowed_formats) formData.append('allowed_formats', allowed_formats);

            // Pass eager transformations to generate variants immediately
            if (eager) {
                formData.append('eager', eager);
            }

            const clRes = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            const clData = await clRes.json();

            if (!clRes.ok) {
                throw new Error(clData.error?.message || 'Failed to upload to Cloudinary');
            }

            // 4. Update backend with new URL
            const updateResponse = await apiRequest<{ success: boolean; message?: string }>(`${API_BASE}/api/v1/profile/image`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: clData.secure_url,
                    publicId: clData.public_id,
                }),
            });

            if (!updateResponse.success) {
                throw new Error(updateResponse.message || 'Failed to update profile');
            }

            return clData.secure_url;
        },
        onSuccess: (url) => {
            toast.success('Profile photo updated successfully!');
            onUploadComplete(url);
            setImageSrc(null);
            setIsSignLoading(false);
        },
        onError: (error) => {
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload image');
            setIsSignLoading(false);
        }
    });

    const handleUpload = () => {
        uploadMutation.mutate();
    };

    if (imageSrc) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-background w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-border">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Adjust Photo</h3>
                        <button
                            onClick={() => setImageSrc(null)}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="relative w-full h-80 bg-black">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            cropShape="round"
                            showGrid={false}
                            objectFit='contain'
                        />
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <ZoomOut className="w-4 h-4 text-muted-foreground" />
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <ZoomIn className="w-4 h-4 text-muted-foreground" />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setImageSrc(null)}
                                className="flex-1 px-4 py-2 rounded-lg border font-medium hover:bg-muted transition-colors"
                                disabled={uploadMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploadMutation.isPending}
                                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                {uploadMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {isSignLoading ? 'Signing...' : 'Uploading...'}
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Save Photo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <label className="cursor-pointer group relative block">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-background shadow-lg group-hover:shadow-xl transition-all duration-300">
                    {currentImageUrl ? (
                        <img
                            src={currentImageUrl}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground">
                            {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-1 text-white">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Change</span>
                    </div>
                </div>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </label>
            {showUserDetails && (
                <div className="mt-4 text-center sm:text-left">
                    <p className="font-semibold text-lg">{user?.firstName} {user?.lastName}</p>
                    <p className="text-muted-foreground text-sm mb-2">{user?.email}</p>
                    <label className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 transition-colors inline-block">
                        {uploadLabel}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </label>
                </div>
            )}
        </div>
    );
};
