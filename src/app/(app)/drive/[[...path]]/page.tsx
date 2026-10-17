import { FileBrowser } from '@/components/file-browser/file-browser';

/**
 * The unified file browser. The optional catch-all carries the chain of
 * folder ids, so `/drive/a/b` means "folder b, reached through a" — which
 * keeps browser history and the back button meaningful. The last segment is
 * the folder being shown; a bare `/drive` is the root.
 */
export default async function DrivePage({
  params,
}: PageProps<'/drive/[[...path]]'>) {
  const { path } = await params;
  return <FileBrowser path={path ?? []} />;
}
