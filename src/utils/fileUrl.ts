/**
 * Helpers for converting local file system paths into safe file:// URLs.
 * Handles both raw and already-encoded paths without double-encoding.
 */

/**
 * Convert an absolute filesystem path to a properly encoded file:// URL.
 * Works for both Windows and POSIX paths, regardless of prior encoding.
 */
export function toFileUrl(filePath: string): string {
  const absolutePath = normalizeFilePath(filePath);

  if (absolutePath.startsWith('file://')) {
    return ensureEncodedFileUrl(absolutePath);
  }

  let normalized = absolutePath;
  normalized = normalized.replace(/\\/g, '/');

  if (/^[a-zA-Z]:\//.test(normalized)) {
    normalized = `/${normalized}`;
  } else if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  let decodedPath = normalized;
  try {
    decodedPath = decodeURI(normalized);
  } catch {
    // Best effort: keep normalized value if decode fails (already raw)
  }

  const encodedPath = encodeURI(decodedPath).replace(/#/g, '%23');
  return `file://${encodedPath}`;
}

function ensureEncodedFileUrl(fileUrl: string): string {
  try {
    const decoded = decodeURI(fileUrl);
    const reconstructed = encodeURI(decoded);
    return reconstructed.replace(/#/g, '%23');
  } catch {
    return fileUrl;
  }
}

function decodeFileUrlPath(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    let pathname = parsed.pathname;
    if (!pathname) return null;

    // Handle Windows drive letters which appear as /C:/...
    if (/^\/[a-zA-Z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }

    return decodeURI(pathname);
  } catch {
    return null;
  }
}

export function normalizeFilePath(input: string): string {
  if (!input) return input;

  if (input.startsWith('safe-file://')) {
    const resolved = decodeFileUrlPath(input.replace(/^safe-file/, 'file'));
    return resolved ?? input.replace(/^safe-file:\/\//, '');
  }

  if (input.startsWith('file://')) {
    const resolved = decodeFileUrlPath(input);
    return resolved ?? input;
  }

  return input;
}

interface FileUrlTestCase {
  input: string;
  expected: string;
  description: string;
}

/**
 * Lightweight runtime self-check used during development to guard the converter.
 * Emits console errors if any scenario fails, making regressions obvious.
 */
export function runFileUrlSelfCheck(): void {
  const cases: FileUrlTestCase[] = [
    {
      input: '/Users/example/Desktop/My File.mp4',
      expected: 'file:///Users/example/Desktop/My%20File.mp4',
      description: 'POSIX path with spaces',
    },
    {
      input: '/Users/example/Desktop/My%20File.mp4',
      expected: 'file:///Users/example/Desktop/My%20File.mp4',
      description: 'Already-encoded POSIX path',
    },
    {
      input: 'C:\\Videos\\Sample Clip.mp4',
      expected: 'file:///C:/Videos/Sample%20Clip.mp4',
      description: 'Windows path with spaces',
    },
    {
      input: 'C:/Videos/Sample%20Clip.mp4',
      expected: 'file:///C:/Videos/Sample%20Clip.mp4',
      description: 'Already-encoded Windows path',
    },
    {
      input: '/Users/example/Desktop/track#1.mp4',
      expected: 'file:///Users/example/Desktop/track%231.mp4',
      description: 'Path containing hash character',
    },
    {
      input: 'safe-file:///Users/example/Desktop/Safe File.mp4',
      expected: 'file:///Users/example/Desktop/Safe%20File.mp4',
      description: 'macOS safe-file scheme',
    },
  ];

  for (const testCase of cases) {
    const result = toFileUrl(testCase.input);
    if (result !== testCase.expected) {
      console.error('[fileUrl] Conversion regression detected:', {
        scenario: testCase.description,
        input: testCase.input,
        expected: testCase.expected,
        actual: result,
      });
      console.assert(result === testCase.expected, 'fileUrl self-check failed');
    }
  }
}

if (import.meta.env?.MODE !== 'production') {
  runFileUrlSelfCheck();
}
