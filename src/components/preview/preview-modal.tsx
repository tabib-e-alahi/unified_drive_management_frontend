'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Download,
  ExternalLink,
  FileQuestion,
  VideoOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatBytes } from '@/lib/format';
import { fileStreamUrl, useFileDetail } from '@/hooks/use-files';
import type { FileSummary } from '@/lib/schemas';

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none';

/**
 * Which types the browser can display. Anything else gets a download prompt
 * rather than an empty frame.
 */
export function previewKindFor(mimeType: string): PreviewKind {
  const mime = mimeType.toLowerCase();
  if (/^image\/(png|jpeg|gif|webp|avif|bmp|x-icon|svg\+xml)$/.test(mime))
    return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'text';
  return 'none';
}

/**
 * Images and videos show at their original size. Only one larger than the
 * screen is scaled down, keeping its proportions, to fit beside the header
 * (about 3.5rem) and the dialog's margins. Nothing is ever scaled up.
 */
const MEDIA_BOUNDS = 'max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-2rem)]';

/** PDFs and text have no size of their own, so they get most of the screen. */
const DOCUMENT_FRAME: CSSProperties = {
  width: 'min(64rem, calc(100vw - 2rem))',
  height: 'calc(100dvh - 6rem)',
};

/** Spinners and messages: compact, whatever the file. */
const MESSAGE_FRAME: CSSProperties = {
  width: 'min(32rem, calc(100vw - 2rem))',
  minHeight: '16rem',
};

/**
 * - loading: waiting for the first frame or metadata
 * - ready: showing
 * - audio-only: the browser decoded the sound but not the picture
 * - failed: the browser could not play it at all
 */
type MediaState = 'loading' | 'ready' | 'audio-only' | 'failed';

export interface PreviewModalProps {
  file: Pick<FileSummary, 'id' | 'name' | 'mimeType' | 'size'> | null;
  onClose: () => void;
}

export function PreviewModal({ file, onClose }: PreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (file && !dialog.open) dialog.showModal();
    if (!file && dialog.open) dialog.close();
  }, [file]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // w-fit: the dialog takes the size of what it shows.
      className="border-border bg-surface text-foreground m-auto w-fit max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border p-0 backdrop:bg-black/70"
    >
      {/* Keyed by file so every opening starts from a clean loading state. */}
      {file && <PreviewBody key={file.id} file={file} onClose={onClose} />}
    </dialog>
  );
}

function PreviewBody({
  file,
  onClose,
}: {
  file: NonNullable<PreviewModalProps['file']>;
  onClose: () => void;
}) {
  const kind = previewKindFor(file.mimeType);
  const [state, setState] = useState<MediaState>('loading');
  const detail = useFileDetail(file.id);
  const driveUrl = detail.data?.driveUrl ?? null;
  // Video and audio stream with Range requests, which is what makes seeking
  // work without downloading the whole file first.
  const src = fileStreamUrl(file.id, 'preview');

  const sized = kind === 'image' || kind === 'video';
  const showMedia = state === 'ready' || state === 'loading';

  return (
    <>
      {/* w-0 min-w-full: the header spans the dialog without widening it,
          so a long file name truncates instead of stretching the preview. */}
      <header className="border-border flex w-0 min-w-full items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </h2>
          <p className="text-muted-foreground text-xs">
            {formatBytes(file.size)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Drive"
              aria-label="Open in Google Drive"
              className="text-muted-foreground hover:bg-surface-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-lg"
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
          <a
            href={fileStreamUrl(file.id, 'download')}
            download={file.name}
            className="border-border hover:bg-surface-muted inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
          >
            <Download className="size-4" aria-hidden />
            <span className="hidden sm:inline">Download</span>
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      <div className="bg-background relative flex min-w-80 items-center justify-center">
        {sized && state === 'loading' && (
          <div
            style={MESSAGE_FRAME}
            className="flex items-center justify-center"
          >
            <Spinner label="Loading preview" />
          </div>
        )}

        {kind === 'image' && showMedia && (
          // eslint-disable-next-line @next/next/no-img-element -- served by the API with the session cookie
          <img
            src={src}
            alt={file.name}
            onLoad={() => setState('ready')}
            onError={() => setState('failed')}
            className={
              state === 'ready'
                ? `block h-auto w-auto ${MEDIA_BOUNDS}`
                : 'absolute size-px opacity-0'
            }
          />
        )}

        {kind === 'video' && showMedia && (
          <VideoPlayer
            src={src}
            ready={state === 'ready'}
            onReady={() => setState('ready')}
            onAudioOnly={() => setState('audio-only')}
            onFailed={() => setState('failed')}
          />
        )}

        {kind === 'audio' && (
          <div className="w-[min(32rem,92vw)] p-6">
            <audio src={src} controls autoPlay className="w-full">
              Your browser cannot play this audio.
            </audio>
          </div>
        )}

        {(kind === 'pdf' || kind === 'text') && (
          <iframe
            src={src}
            title={file.name}
            style={DOCUMENT_FRAME}
            className="block bg-white"
          />
        )}

        {state === 'audio-only' && (
          <Notice
            icon={<VideoOff className="size-6" aria-hidden />}
            title="This video’s picture can’t be shown in this browser"
            driveUrl={driveUrl}
          >
            Its sound plays, but the video is in a format your browser cannot
            decode — usually HEVC (H.265), which most phones record in. Google
            Drive converts videos for playback, so it plays there.
          </Notice>
        )}

        {state === 'failed' && (
          <Notice
            icon={<FileQuestion className="size-6" aria-hidden />}
            title="This file can’t be previewed in the browser"
            driveUrl={driveUrl}
          >
            Download it to open it in an app
            {driveUrl ? ', or open it in Google Drive' : ''}.
          </Notice>
        )}

        {kind === 'none' && (
          <Notice
            icon={<FileQuestion className="size-6" aria-hidden />}
            title="No preview for this file type"
            driveUrl={driveUrl}
          >
            {file.mimeType} cannot be shown in the browser. Download it to open
            it in an app.
          </Notice>
        )}
      </div>
    </>
  );
}

/**
 * Plays a video, and notices when the browser can only manage its sound.
 *
 * Browsers handle an undecodable video track by silently dropping it and
 * playing the audio: no error fires, the picture just stays black. Two
 * signals catch it — no picture dimensions once metadata is in, or no
 * frames decoded after a second of playback.
 */
function VideoPlayer({
  src,
  ready,
  onReady,
  onAudioOnly,
  onFailed,
}: {
  src: string;
  ready: boolean;
  onReady: () => void;
  onAudioOnly: () => void;
  onFailed: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  const giveUp = () => {
    ref.current?.pause();
    onAudioOnly();
  };

  return (
    <video
      ref={ref}
      src={src}
      controls
      autoPlay
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        if (event.currentTarget.videoWidth === 0) giveUp();
        else onReady();
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget;
        if (video.currentTime < 1) return;
        const frames = video.getVideoPlaybackQuality?.().totalVideoFrames;
        if (frames === 0) giveUp();
      }}
      onError={onFailed}
      className={
        ready
          ? `block h-auto w-auto bg-black ${MEDIA_BOUNDS}`
          : 'absolute size-px opacity-0'
      }
    >
      Your browser cannot play this video.
    </video>
  );
}

function Notice({
  icon,
  title,
  driveUrl,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  driveUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      style={MESSAGE_FRAME}
      className="flex flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div className="bg-surface-muted text-muted-foreground rounded-full p-3">
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{children}</p>
      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium hover:opacity-90"
        >
          <ExternalLink className="size-4" aria-hidden />
          Play in Google Drive
        </a>
      )}
    </div>
  );
}
