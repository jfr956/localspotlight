"use client";

import { useState, useRef, ChangeEvent } from "react";
import NextImage from "next/image";

interface ImageUploadSectionProps {
  onImageChange?: (imageData: string | null) => void;
}

const MAX_BASE64_BYTES = 900 * 1024; // Keep payload comfortably under Next.js 1 MB server action limit
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 900;
const OUTPUT_MIME = "image/webp";
const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5];

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    img.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to generate image blob"));
        }
      },
      OUTPUT_MIME,
      quality,
    );
  });

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read compressed image"));
    reader.readAsDataURL(blob);
  });

const estimateBase64Bytes = (dataUrl: string) => {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;
  return Math.ceil((base64.length * 3) / 4);
};

async function compressImage(file: File) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");

  const widthScale = MAX_WIDTH / image.width;
  const heightScale = MAX_HEIGHT / image.height;
  const scale = Math.min(1, widthScale, heightScale);

  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create drawing context");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    const dataUrl = await blobToDataUrl(blob);
    const byteSize = estimateBase64Bytes(dataUrl);

    if (byteSize <= MAX_BASE64_BYTES) {
      return {
        dataUrl,
        byteSize,
        dimensions: { width: targetWidth, height: targetHeight },
        format: OUTPUT_MIME,
      };
    }
  }

  throw new Error("compressed_image_too_large");
}

export function ImageUploadSection({ onImageChange }: ImageUploadSectionProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ format: string; sizeKb: number; width: number; height: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageDataRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      alert("Please upload a JPG or PNG image.");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB.");
      return;
    }

    setIsProcessingUpload(true);
    setError(null);

    try {
      const compressed = await compressImage(file);

      if (imagePreview !== compressed.dataUrl) {
        setImagePreview(compressed.dataUrl);
      }

      setImageMeta({
        format: compressed.format,
        sizeKb: Math.round(compressed.byteSize / 1024),
        width: compressed.dimensions.width,
        height: compressed.dimensions.height,
      });

      if (imageDataRef.current) {
        imageDataRef.current.value = compressed.dataUrl;
      }

      onImageChange?.(compressed.dataUrl);
    } catch (err) {
      console.error("Failed to process image:", err);

      if (err instanceof Error && err.message === "compressed_image_too_large") {
        setError("We could not reduce this image below 900 KB. Please upload a smaller image.");
      } else {
        setError("We ran into a problem processing this image. Please try again or choose a different file.");
      }

      if (imageDataRef.current) {
        imageDataRef.current.value = "";
      }

      setImagePreview(null);
      setImageMeta(null);
      onImageChange?.(null);
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (imageDataRef.current) {
      imageDataRef.current.value = "";
    }
    onImageChange?.(null);
    setImageMeta(null);
    setError(null);
  };

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      // TODO: Implement AI image generation
      // This will call your AI image generation API endpoint
      alert("AI image generation coming soon! This will use Runware.ai to generate images based on your post content.");
    } catch (error) {
      console.error("Failed to generate image:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Feature Image
        </label>
        <p className="text-xs text-slate-500 mb-4">
          Recommended: 1200 x 900 pixels (4:3 aspect ratio). JPG or PNG format — we auto-compress to WebP under 900 KB.
        </p>

        {/* Image preview area */}
        <div className="mb-4 rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/50 p-8 transition-all">
          {imagePreview ? (
            <div className="space-y-4">
              <div className="relative mx-auto" style={{ maxWidth: "600px", maxHeight: "256px" }}>
                <NextImage
                  src={imagePreview}
                  alt="Post preview"
                  width={600}
                  height={450}
                  className="mx-auto rounded-lg object-contain"
                  style={{ maxHeight: "256px", width: "auto", height: "auto" }}
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="mx-auto flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remove image
              </button>

              {imageMeta && (
                <p className="text-xs text-center text-slate-500">
                  {imageMeta.width}×{imageMeta.height}px • {imageMeta.format.replace("image/", "").toUpperCase()} •{" "}
                  {imageMeta.sizeKb} KB
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-slate-400">No image selected</p>
              <p className="mt-1 text-xs text-slate-500">
                Upload or generate an image optimized for Google Business Profile
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {/* Upload and AI generation options */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            htmlFor="imageUpload"
            className={`flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300 hover:bg-slate-800 ${
              isProcessingUpload ? "cursor-wait opacity-70" : "cursor-pointer"
            }`}
            aria-disabled={isProcessingUpload}
          >
            {isProcessingUpload ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload Image
              </>
            )}
            <input
              ref={fileInputRef}
              id="imageUpload"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isProcessingUpload}
            />
          </label>

          <button
            type="button"
            onClick={handleGenerateWithAI}
            disabled={isGenerating || isProcessingUpload}
            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Generate with AI
              </>
            )}
          </button>
        </div>

        {/* Hidden input to store image data for form submission */}
        <input ref={imageDataRef} type="hidden" id="imageData" name="imageData" />
      </div>
    </section>
  );
}
