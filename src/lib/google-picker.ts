/**
 * The Google Picker, for importing files already in a linked Drive.
 *
 * Two Google scripts are involved, both free:
 *  - Google Identity Services (GIS) gets a short-lived access token in the
 *    browser, scoped to `drive.file`. The backend's stored refresh tokens
 *    never leave the server.
 *  - The Picker itself, loaded through `gapi`.
 *
 * Picking a file grants this app — not just this token — access to it under
 * `drive.file`, so once the ids reach the backend its own credentials can
 * read the files. That only works if the Picker is told the Cloud project
 * number (`appId`); without it the grant attaches to nothing.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Matches the backend's per-request import limit. */
export const MAX_PICK = 100;

// ---------------------------------------------------------------------------
// Minimal typings for the slices of Google's globals used here
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: {
    prompt?: string;
    login_hint?: string;
  }): void;
}

interface PickerDocument {
  id: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDocument[];
}

interface PickerBuilder {
  setAppId(id: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setMaxItems(max: number): PickerBuilder;
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface DocsView {
  setIncludeFolders(include: boolean): DocsView;
  setSelectFolderEnabled(enabled: boolean): DocsView;
  setOwnedByMe(owned: boolean): DocsView;
  setMode(mode: string): DocsView;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        login_hint?: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string; message?: string }) => void;
      }): TokenClient;
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: string) => DocsView;
    ViewId: { DOCS: string };
    DocsViewMode: { LIST: string };
    Feature: { MULTISELECT_ENABLED: string };
    Action: { PICKED: string; CANCEL: string };
  };
}

interface GapiGlobal {
  load(
    library: string,
    options: { callback: () => void; onerror: () => void },
  ): void;
}

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: GapiGlobal;
  }
}

// ---------------------------------------------------------------------------
// Script loading
// ---------------------------------------------------------------------------

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let loading = scripts.get(src);
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const element = document.createElement('script');
      element.src = src;
      element.async = true;
      element.onload = () => resolve();
      element.onerror = () => {
        // Let a later attempt retry rather than caching the failure.
        scripts.delete(src);
        element.remove();
        reject(
          new Error(
            'Could not load Google’s picker. Check your connection or ad blocker.',
          ),
        );
      };
      document.head.append(element);
    });
    scripts.set(src, loading);
  }
  return loading;
}

let pickerReady: Promise<void> | null = null;

/**
 * Loads both scripts. Call it early (when the Import button appears): the
 * token popup must open straight from a click, and browsers block popups
 * opened after an `await` on a network load.
 */
export function preloadGooglePicker(): Promise<void> {
  pickerReady ??= Promise.all([
    loadScript(GIS_SRC),
    loadScript(GAPI_SRC).then(
      () =>
        new Promise<void>((resolve, reject) => {
          window.gapi?.load('picker', {
            callback: resolve,
            onerror: () => reject(new Error('Could not load Google’s picker.')),
          });
        }),
    ),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      pickerReady = null;
      throw error;
    });
  return pickerReady;
}

export function isGooglePickerLoaded(): boolean {
  return Boolean(window.google?.accounts && window.google.picker);
}

// ---------------------------------------------------------------------------
// Token + picker
// ---------------------------------------------------------------------------

/** Tokens last an hour; reusing one avoids a popup on every import. */
const tokens = new Map<string, { token: string; expiresAt: number }>();

function requestToken(clientId: string, email: string): Promise<string> {
  const cached = tokens.get(email);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return Promise.resolve(cached.token);
  }

  const google = window.google;
  if (!google)
    return Promise.reject(
      new Error('Google’s picker is still loading. Try again in a moment.'),
    );

  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      // Pre-selects the linked account in Google's chooser.
      login_hint: email,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ?? 'Google did not grant access.',
            ),
          );
          return;
        }
        tokens.set(email, {
          token: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        });
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          error.type === 'popup_closed'
            ? new PickerCancelled()
            : new Error(
                error.type === 'popup_failed_to_open'
                  ? 'Your browser blocked the Google window. Allow popups for this site and try again.'
                  : (error.message ?? 'Google sign-in failed.'),
              ),
        );
      },
    });
    // Empty prompt: no consent screen if this account already granted it.
    client.requestAccessToken({ prompt: '' });
  });
}

/** The user backed out; not worth an error toast. */
export class PickerCancelled extends Error {
  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'PickerCancelled';
  }
}

export interface PickOptions {
  clientId: string;
  apiKey: string;
  appId: string;
  /** The linked account to browse; Google pre-selects it. */
  accountEmail: string;
}

/**
 * Opens the Picker on one linked account and resolves with the chosen file
 * ids, or rejects with PickerCancelled if the user backs out. Must be
 * called directly from a click handler, after preloadGooglePicker().
 */
export async function pickDriveFiles(options: PickOptions): Promise<string[]> {
  const token = await requestToken(options.clientId, options.accountEmail);
  const picker = window.google?.picker;
  if (!picker)
    throw new Error('Google’s picker is still loading. Try again in a moment.');

  const view = new picker.DocsView(picker.ViewId.DOCS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMode(picker.DocsViewMode.LIST);

  return new Promise((resolve, reject) => {
    new picker.PickerBuilder()
      .setAppId(options.appId)
      .setOAuthToken(token)
      .setDeveloperKey(options.apiKey)
      .setOrigin(window.location.origin)
      .setTitle(`Pick files or folders from ${options.accountEmail}`)
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setMaxItems(MAX_PICK)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) {
          resolve((response.docs ?? []).map((doc) => doc.id));
        } else if (response.action === picker.Action.CANCEL) {
          reject(new PickerCancelled());
        }
        // Other actions ("loaded") are progress notifications; ignore them.
      })
      .build()
      .setVisible(true);
  });
}
