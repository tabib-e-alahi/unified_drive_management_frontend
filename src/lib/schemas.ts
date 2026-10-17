import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const setupStatusSchema = z.object({
  setupRequired: z.boolean(),
});

export const successSchema = z.object({
  success: z.boolean(),
});

/** Shared by the login and setup forms. */
export const credentialsSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(128, 'Use at most 128 characters'),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Accounts & storage
//
// BigInt values (quotas, sizes) arrive as strings: they can exceed
// Number.MAX_SAFE_INTEGER, so they are parsed to bigint rather than number.
// ---------------------------------------------------------------------------

export const driveAccountStatusSchema = z.enum([
  'ACTIVE',
  'REAUTH_REQUIRED',
  'DISABLED',
]);
export type DriveAccountStatus = z.infer<typeof driveAccountStatusSchema>;

const bigintString = z.string().transform((value) => BigInt(value));
const nullableBigintString = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : BigInt(value)));

export const accountSchema = z.object({
  id: z.string(),
  googleEmail: z.string(),
  status: driveAccountStatusSchema,
  quotaTotal: nullableBigintString,
  quotaUsed: bigintString,
  reservedBytes: bigintString,
  freeBytes: nullableBigintString,
  appStoredBytes: bigintString,
  fileCount: z.number(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type DriveAccount = z.infer<typeof accountSchema>;

export const accountListSchema = z.array(accountSchema);

export const storageSummarySchema = z.object({
  totalBytes: nullableBigintString,
  usedBytes: bigintString,
  reservedBytes: bigintString,
  freeBytes: nullableBigintString,
  appStoredBytes: bigintString,
  activeAccounts: z.number(),
  accountsNeedingReauth: z.number(),
  accounts: accountListSchema,
});
export type StorageSummary = z.infer<typeof storageSummarySchema>;

export const connectUrlSchema = z.object({ url: z.string() });

// ---------------------------------------------------------------------------
// Folders & the file browser
// ---------------------------------------------------------------------------

export const fileStatusSchema = z.enum([
  'UPLOADING',
  'READY',
  'FAILED',
  'MISSING',
]);
export type FileStatus = z.infer<typeof fileStatusSchema>;

/**
 * UPLOADED files live in the app's own Drive folder; IMPORTED ones were
 * picked from the user's existing Drive and are never deleted from it.
 */
export const fileSourceSchema = z.enum(['UPLOADED', 'IMPORTED']);
export type FileSource = z.infer<typeof fileSourceSchema>;

export const breadcrumbSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Breadcrumb = z.infer<typeof breadcrumbSchema>;

export const folderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  childFolderCount: z.number(),
  fileCount: z.number(),
});
export type FolderSummary = z.infer<typeof folderSummarySchema>;

export const fileSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: bigintString,
  folderId: z.string().nullable(),
  status: fileStatusSchema,
  source: fileSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FileSummary = z.infer<typeof fileSummarySchema>;

export const folderContentsSchema = z.object({
  folder: z
    .object({
      id: z.string(),
      name: z.string(),
      parentId: z.string().nullable(),
    })
    .nullable(),
  breadcrumbs: z.array(breadcrumbSchema),
  folders: z.array(folderSummarySchema),
  files: z.array(fileSummarySchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    totalFiles: z.number(),
    totalPages: z.number(),
  }),
});
export type FolderContents = z.infer<typeof folderContentsSchema>;

export const trashResultSchema = z.object({
  trashedFolders: z.number(),
  trashedFiles: z.number(),
});

/** Sort keys accepted by GET /folders/:id/contents. */
export const SORT_KEYS = ['name', 'size', 'date'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const uploadSessionSchema = z.object({
  fileId: z.string(),
  uploadUrl: z.string(),
});

export const fileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: bigintString,
  folderId: z.string().nullable(),
  status: fileStatusSchema,
  source: fileSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Importing existing Drive files (Google Picker)
// ---------------------------------------------------------------------------

export const pickerConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    clientId: z.string(),
    apiKey: z.string(),
    appId: z.string(),
  }),
]);
export type PickerConfig = z.infer<typeof pickerConfigSchema>;

export const importResultSchema = z.object({
  imported: z.array(fileResponseSchema),
  folders: z.number(),
  skipped: z.array(
    z.object({
      googleFileId: z.string(),
      name: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});
export type ImportResult = z.infer<typeof importResultSchema>;

// ---------------------------------------------------------------------------
// File operations, search and trash
// ---------------------------------------------------------------------------

export const fileDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: bigintString,
  folderId: z.string().nullable(),
  status: fileStatusSchema,
  source: fileSourceSchema,
  trashedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  storedOn: z.object({
    accountId: z.string(),
    googleEmail: z.string(),
  }),
  driveUrl: z.string().nullable(),
});
export type FileDetail = z.infer<typeof fileDetailSchema>;

export const restoreFileSchema = z.object({
  file: fileDetailSchema,
  movedToRoot: z.boolean(),
});

export const searchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: bigintString,
  folderId: z.string().nullable(),
  source: fileSourceSchema,
  folderPath: z.string(),
  updatedAt: z.string(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchResultsSchema = z.array(searchHitSchema);

export const trashListingSchema = z.object({
  folders: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      trashedAt: z.string(),
      nested: z.boolean(),
    }),
  ),
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      size: bigintString,
      source: fileSourceSchema,
      trashedAt: z.string(),
      nested: z.boolean(),
    }),
  ),
});
export type TrashListing = z.infer<typeof trashListingSchema>;

export const emptyTrashSchema = z.object({
  deletedFiles: z.number(),
  deletedFolders: z.number(),
  failed: z.number(),
});

export const restoreFolderSchema = z.object({
  restoredFolders: z.number(),
  restoredFiles: z.number(),
  movedToRoot: z.boolean(),
});
