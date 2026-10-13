export const getApiUrl = (path: string): string => {
  // 1. Diagnostics: Check environment variables
  const envBackend = import.meta.env.VITE_BACKEND_URL;
  const envApi = import.meta.env.VITE_API_URL;
  
  if (!envBackend && !envApi) {
    console.warn("[API_DIAGNOSTIC] Attention: Ni VITE_BACKEND_URL ni VITE_API_URL ne sont définis. Utilisation de l'origine locale par défaut.");
  }

  let baseUrl = envBackend || envApi || window.location.origin;
  
  // 2. Sanitize Base URL (Remove trailing slashes)
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // 3. Ensure Protocol (Absolute URL)
  if (baseUrl && !baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
  }

  // 4. Sanitize Path (Ensure exactly one leading slash)
  const cleanPath = `/${path.replace(/^\/+/, '')}`;
  
  const finalUrl = `${baseUrl}${cleanPath}`;
  
  // 5. CRITICAL LOG: This will show up in the F12 console
  console.log(`[API_DIAGNOSTIC] URL appelée : ${finalUrl}`);
  
  return finalUrl;
};
