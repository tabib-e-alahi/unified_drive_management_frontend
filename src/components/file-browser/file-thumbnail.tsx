'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { fileStreamUrl, fileThumbnailUrl } from '@/hooks/use-files';
import { previewKindFor } from '@/components/preview/preview-modal';
import type { FileSummary } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { FileTypeIcon } from './file-icon';

/**
 * Below this, an image with no Google thumbnail yet is shown from the file
 * itself; above it, loading the full bytes for a tile is not worth it.
 */
const FULL_IMAGE_FALLBACK_BYTES = 5n * 1024n * 1024n;

type Stage = 'thumbnail' | 'full' | 'icon';

/**
 * A grid tile's picture: Google's thumbnail for images and videos, falling
 * back to the file-type icon. Thumbnails can be missing for a while after
 * an upload, until Google has processed the file.
 */
export function FileThumbnail({
  file,
  className,
}: {
  file: Pick<FileSummary, 'id' | 'name' | 'mimeType' | 'size' | 'status'>;
  className?: string;
}) {
  const kind = previewKindFor(file.mimeType);
  const visual =
    file.status === 'READY' && (kind === 'image' || kind === 'video');
  const [stage, setStage] = useState<Stage>(visual ? 'thumbnail' : 'icon');

  if (stage === 'icon') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <FileTypeIcon
          className={cn('size-10', file.status !== 'READY' && 'opacity-40')}
          mimeType={file.mimeType}
          name={file.name}
        />
      </div>
    );
  }

  const src =
    stage === 'thumbnail'
      ? fileThumbnailUrl(file.id)
      : fileStreamUrl(file.id, 'preview');

  return (
    <div
      className={cn(
        'bg-surface-muted relative overflow-hidden rounded-lg',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session cookie; next/image cannot proxy that */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() =>
          setStage(
            stage === 'thumbnail' &&
              kind === 'image' &&
              file.size <= FULL_IMAGE_FALLBACK_BYTES
              ? 'full'
              : 'icon',
          )
        }
        className="size-full object-cover"
      />
      {kind === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-1.5 text-white">
            <Play className="size-4 fill-current" aria-hidden />
          </span>
        </span>
      )}
    </div>
  );
}
