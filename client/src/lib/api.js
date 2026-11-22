const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${apiBase}/${path.replace(/^\/+/, '')}`, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ যাচাই করে আবার চেষ্টা করুন।',
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(data.message || 'অনুরোধটি সম্পন্ন করা যায়নি।', response.status, data.fields);
  return data;
}

export function mediaUrl(path) {
  return path ? new URL(path, new URL(apiBase, window.location.origin).origin).href : undefined;
}
