'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { resolveAssetUrl } from '@/lib/asset-url';

interface PhotoUploadProps {
  /** Controlled File value - null when no new file is selected. */
  value: File | null;
  /** Current stored photo URL (from the server) to show as preview when no File is picked. */
  previewUrl?: string | null;
  /** Called whenever the user picks or clears a file. */
  onChange: (file: File | null) => void;
  /** Field label shown above the control. */
  label?: string;
  /** File type filter. Defaults to `image/*`. */
  accept?: string;
  /** Max allowed size in bytes. Defaults to 5 MB. */
  maxBytes?: number;
  /** Optional class for the outer container. */
  className?: string;
  /** Circular (avatar) vs rectangular (logo) preview. Defaults to rectangular. */
  shape?: 'circle' | 'rect';
  /** Whether a current value can be removed (also emits null). Default true. */
  clearable?: boolean;
  /** Hint copy shown below the control (before file is picked). */
  hint?: string;
  disabled?: boolean;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const PLACEHOLDER_URL = 'https://';

function isPlaceholder(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  return !trimmed || trimmed === PLACEHOLDER_URL;
}

/**
 * Drop-in photo/logo upload control used across forms that persist a
 * `photoURL` / `logoURL`. Mirrors the shieldgo-admin-web `<input type="file"
 * accept="image/*">` + `handleFileUpload()` pattern but wraps it in a
 * premium shadcn-style UI with live preview, drag-and-drop, size guard and
 * clear button.
 *
 * Parent keeps the File in state and passes it to the service's
 * `create(payload, file)` / `update(id, payload, file)` methods - the
 * existing multipart upload path in the API Gateway handles persistence.
 */
export function PhotoUpload({
  value,
  previewUrl,
  onChange,
  label,
  accept = 'image/*',
  maxBytes = DEFAULT_MAX_BYTES,
  className,
  shape = 'rect',
  clearable = true,
  hint,
  disabled = false,
}: PhotoUploadProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Revoke transient object URLs on unmount / change.
  /* eslint-disable react-hooks/set-state-in-effect --
     localPreview is derived from the File prop; URL.createObjectURL returns
     a string that must be paired with revokeObjectURL on change. Doing this
     via useMemo would leak blob URLs. This is the intentional pattern. */
  useEffect(() => {
    if (!value) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resolvedPreview = useMemo(() => {
    if (localPreview) return localPreview;
    if (!isPlaceholder(previewUrl)) return resolveAssetUrl(previewUrl) || null;
    return null;
  }, [localPreview, previewUrl]);

  const accept1 = accept || 'image/*';

  const handleFile = (file: File | null | undefined) => {
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }
    // Reject empty files - some mobile browsers/emulators return a File
    // with metadata but zero bytes, which the backend then tries to persist
    // as a 0-byte image and blows up.
    if (file.size === 0) {
      setError(t('common.fileEmpty'));
      onChange(null);
      return;
    }
    if (file.size > maxBytes) {
      setError(
        t('common.fileTooLarge', {
          size: `${Math.round(maxBytes / (1024 * 1024))} MB`,
        }),
      );
      return;
    }
    if (accept1 && !matchesAccept(file.type, accept1)) {
      setError(t('common.fileTypeInvalid'));
      return;
    }
    onChange(file);
  };

  const fileLabel = value?.name ?? t('common.fileNone');

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}

      <div
        className={cn(
          'rounded-xl border p-4 transition-colors',
          isDragging
            ? 'border-brand-500/60 bg-brand-500/5'
            : 'border-white/[0.08] bg-white/[0.02]',
          disabled && 'opacity-60 pointer-events-none',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          handleFile(file);
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden bg-white/[0.04] ring-1 ring-white/10',
              shape === 'circle' ? 'rounded-full' : 'rounded-xl',
            )}
          >
            {resolvedPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-text-muted" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-sm text-white">{fileLabel}</p>
            <p className="text-xs text-text-muted">
              {hint ??
                t('common.photoUploadHint', {
                  size: `${Math.round(maxBytes / (1024 * 1024))} MB`,
                })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                <Upload className="h-4 w-4" />
                {value ? t('common.changePhoto') : t('common.choosePhoto')}
              </Button>
              {clearable && (value || (!isPlaceholder(previewUrl))) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onChange(null);
                    setError(null);
                  }}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.remove')}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Most mobile browsers honor `capture` on file inputs to open
                  // the camera directly. Desktop falls back to the picker.
                  inputRef.current?.setAttribute('capture', 'user');
                  inputRef.current?.click();
                  setTimeout(
                    () => inputRef.current?.removeAttribute('capture'),
                    200,
                  );
                }}
                disabled={disabled}
                title={t('common.takePhoto')}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept1}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          // Reset so selecting the same file again fires `onChange` again.
          e.target.value = '';
        }}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function matchesAccept(mimeType: string, accept: string): boolean {
  if (!accept) return true;
  return accept
    .split(',')
    .map((t) => t.trim())
    .some((entry) => {
      if (!entry) return true;
      if (entry === '*/*') return true;
      if (entry.endsWith('/*')) {
        const prefix = entry.slice(0, entry.length - 1); // keep "image/"
        return mimeType.startsWith(prefix);
      }
      return mimeType === entry;
    });
}
