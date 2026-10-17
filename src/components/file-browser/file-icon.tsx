import {
  File as FileIconBase,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder as FolderIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type IconComponent = typeof FileIconBase;

/**
 * Picks an icon from the MIME type, falling back to the extension because
 * browsers report `application/octet-stream` for plenty of ordinary files.
 */
function pickIcon(
  mimeType: string,
  name: string,
): { Icon: IconComponent; className: string } {
  const mime = mimeType.toLowerCase();
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();

  if (mime.startsWith('image/'))
    return { Icon: FileImage, className: 'text-violet-500' };
  if (mime.startsWith('video/'))
    return { Icon: FileVideo, className: 'text-rose-500' };
  if (mime.startsWith('audio/'))
    return { Icon: FileAudio, className: 'text-amber-500' };
  if (mime === 'application/pdf')
    return { Icon: FileText, className: 'text-red-500' };

  const archive = ['zip', 'gz', 'tar', 'rar', '7z', 'bz2', 'xz'];
  if (archive.includes(extension))
    return { Icon: FileArchive, className: 'text-orange-500' };

  const sheet = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
  if (sheet.includes(extension))
    return { Icon: FileSpreadsheet, className: 'text-emerald-500' };

  const code = [
    'js',
    'ts',
    'tsx',
    'jsx',
    'json',
    'html',
    'css',
    'py',
    'go',
    'rs',
    'sh',
    'yml',
    'yaml',
    'sql',
  ];
  if (code.includes(extension))
    return { Icon: FileCode, className: 'text-sky-500' };

  const text = ['txt', 'md', 'rtf', 'doc', 'docx', 'odt'];
  if (mime.startsWith('text/') || text.includes(extension)) {
    return { Icon: FileText, className: 'text-slate-500' };
  }

  return { Icon: FileIconBase, className: 'text-muted-foreground' };
}

export function FileTypeIcon({
  mimeType,
  name,
  className,
}: {
  mimeType: string;
  name: string;
  className?: string;
}) {
  const { Icon, className: colour } = pickIcon(mimeType, name);
  return <Icon className={cn(colour, className)} aria-hidden />;
}

export function FolderTypeIcon({ className }: { className?: string }) {
  return <FolderIcon className={cn('text-primary', className)} aria-hidden />;
}
