function toError(status, data) {
  const err = new Error(data?.error || "Something went wrong. Please check your connection and try again.");
  err.status = status;
  err.fields = data?.fields || {};
  return err;
}

export async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw toError(0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw toError(res.status, data);
  return data;
}

// XHR instead of fetch so we can show upload progress on slow mobile connections.
export function upload(path, formData, { token, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      xhr.status >= 200 && xhr.status < 300 ? resolve(data) : reject(toError(xhr.status, data));
    };
    xhr.onerror = () => reject(toError(0));
    xhr.send(formData);
  });
}

export const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};
