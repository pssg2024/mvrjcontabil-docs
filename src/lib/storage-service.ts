import { DocumentFile, Folder, Sector, SiteBackgroundConfig, AuthHeaderConfig, AuditLog, FolderPermission, PermissionLevel, UserProfile } from '../types';

export interface PresignedUploadResponse {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  provider: string;
  isSimulation: boolean;
  message?: string;
}

export interface PresignedDownloadResponse {
  downloadUrl: string;
  expiresInSeconds: number;
  provider: string;
  isSimulation: boolean;
}

/**
 * Requests a presigned PUT URL from the backend
 */
export async function getPresignedUploadUrl(
  fileName: string,
  mimeType: string,
  sector: Sector,
  folderId: string,
  size: number
): Promise<PresignedUploadResponse> {
  const response = await fetch('/api/r2/presigned-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      mimeType,
      sector,
      folderId,
      size,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao obter URL pré-assinada do Cloudflare R2');
  }

  return response.json();
}

/**
 * Uploads a file through the resilient backend endpoint, transferring directly to Cloudflare R2
 * without browser CORS constraints.
 */
export async function uploadViaServerDirect(
  fileBlob: Blob | File,
  storageKey: string,
  mimeType: string,
  fileName: string,
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/upload-direct', true);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('x-storage-key', storageKey);
    xhr.setRequestHeader('x-mime-type', mimeType);
    xhr.setRequestHeader('x-file-name', encodeURIComponent(fileName));

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        try {
          const errJson = JSON.parse(xhr.responseText);
          reject(new Error(errJson.error || `Falha no envio pelo servidor: status ${xhr.status}`));
        } catch {
          reject(new Error(`Falha no envio pelo servidor: status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falha de conexão com o servidor GED'));
    };

    xhr.send(fileBlob);
  });
}

/**
 * Uploads the optimized file to Cloudflare R2 using the Presigned PUT URL.
 * Automatically falls back to resilient server-side upload if the browser's
 * direct request encounters CORS restrictions on the R2 bucket.
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  fileBlob: Blob | File,
  mimeType: string,
  onProgress?: (progressPercent: number) => void,
  storageKey?: string,
  fileName?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // If the presigned URL is a relative API mock/local url, handle it directly or via server
    const isExternalR2Url = uploadUrl.startsWith('http://') || uploadUrl.startsWith('https://');

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        // If R2 rejects direct PUT (e.g. 403 CORS or permissions), fallback to backend
        if (storageKey && fileName) {
          console.warn(`[Storage Service] Upload direto no R2 retornou ${xhr.status}. Acionando fallback resiliente via servidor...`);
          uploadViaServerDirect(fileBlob, storageKey, mimeType, fileName, onProgress)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Falha no upload para o R2. Status HTTP: ${xhr.status} ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      // CORS block from browser or network error during direct PUT to Cloudflare R2
      if (storageKey && fileName) {
        console.info('[Storage Service] Upload direto ao Cloudflare R2 encontrou restrição CORS do navegador. Concluindo envio via canal direto do servidor...');
        uploadViaServerDirect(fileBlob, storageKey, mimeType, fileName, onProgress)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error('Erro de conexão durante o envio para o Cloudflare R2'));
      }
    };

    xhr.send(fileBlob);
  });
}

/**
 * Requests a temporary Presigned GET URL for secure preview or download
 */
export async function getPresignedDownloadUrl(
  storageKey: string,
  fileName?: string,
  inline?: boolean
): Promise<PresignedDownloadResponse> {
  const response = await fetch('/api/r2/presigned-download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storageKey,
      fileName,
      inline: !!inline,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao gerar URL de download segura');
  }

  return response.json();
}

/**
 * Uploads an optimized WebP avatar directly to Cloudflare R2 at avatars/{user_id}.webp
 * and synchronizes with Supabase public.profiles table.
 */
export async function uploadAvatarToR2(
  userId: string,
  webpBlob: Blob,
  userEmail?: string,
  onProgress?: (progressPercent: number) => void
): Promise<{ avatarUrl: string; storageKey: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const cleanUserId = userId.replace(/\.webp$/i, '');
    xhr.open('POST', `/api/r2/avatar/${encodeURIComponent(cleanUserId)}`, true);
    xhr.setRequestHeader('Content-Type', 'image/webp');
    if (userEmail) {
      xhr.setRequestHeader('x-user-email', userEmail);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(100);
          resolve({
            avatarUrl: res.avatarUrl,
            storageKey: res.storageKey,
          });
        } catch {
          resolve({
            avatarUrl: `/api/r2/avatar/${cleanUserId}.webp?t=${Date.now()}`,
            storageKey: `avatars/${cleanUserId}.webp`,
          });
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Erro HTTP ${xhr.status} no upload de avatar`));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status} no upload de avatar`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Erro de conexão ao enviar foto de perfil para o Cloudflare R2'));
    };

    xhr.send(webpBlob);
  });
}

/**
 * Deletes the avatar object from Cloudflare R2 (avatars/{user_id}.webp)
 * and updates public.profiles setting avatar_url to NULL in Supabase.
 */
export async function deleteAvatarFromR2(
  userId: string,
  userEmail?: string
): Promise<{ success: boolean; message: string }> {
  const cleanUserId = userId.replace(/\.webp$/i, '');
  const url = `/api/r2/avatar/${encodeURIComponent(cleanUserId)}${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ''}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao remover foto de perfil do Cloudflare R2 e Supabase');
  }

  const data = await response.json();
  return { success: true, message: data.message || 'Avatar removido com sucesso' };
}

/**
 * Updates user profile metadata in Supabase public.profiles table
 */
export async function updateSupabaseProfile(
  userId: string,
  data: { full_name: string; avatar_url: string | null; email?: string }
): Promise<any> {
  const cleanUserId = userId.replace(/\.webp$/i, '');
  const response = await fetch(`/api/profiles/${encodeURIComponent(cleanUserId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao sincronizar perfil com o Supabase');
  }

  return response.json();
}

// ==============================================================================
// SITE BACKGROUND MANAGEMENT & PRESETS
// ==============================================================================

export interface BackgroundPreset {
  id: string;
  name: string;
  category: 'Foto Corporativa' | 'Padrão Geométrico' | 'Gradiente Executivo';
  description: string;
  thumbnail: string;
  imageUrl: string;
  defaultOpacity: number;
  defaultBlur: number;
  overlayType: 'light' | 'dark' | 'none';
  overlayOpacity: number;
  position: 'cover' | 'contain' | 'repeat' | 'center';
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'corp-architecture',
    name: 'Torre Corporativa de Vidro',
    category: 'Foto Corporativa',
    description: 'Arquitetura moderna espelhada transmitindo solidez e credibilidade institucional.',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=75',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=80',
    defaultOpacity: 25,
    defaultBlur: 1,
    overlayType: 'light',
    overlayOpacity: 35,
    position: 'cover',
  },
  {
    id: 'corp-office',
    name: 'Escritório Executivo Clean',
    category: 'Foto Corporativa',
    description: 'Ambiente executivo arejado com iluminação natural e linhas contemporâneas.',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=75',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=80',
    defaultOpacity: 20,
    defaultBlur: 2,
    overlayType: 'light',
    overlayOpacity: 40,
    position: 'cover',
  },
  {
    id: 'accounting-desk',
    name: 'Gestão Contábil & Análise',
    category: 'Foto Corporativa',
    description: 'Mesa corporativa focada em dados contábeis, relatórios e transparência fiscal.',
    thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=75',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=2000&q=80',
    defaultOpacity: 22,
    defaultBlur: 2,
    overlayType: 'light',
    overlayOpacity: 40,
    position: 'cover',
  },
  {
    id: 'indigo-gradient',
    name: 'Ondas & Gradiente Índigo',
    category: 'Gradiente Executivo',
    description: 'Fluidez elegante em tons de azul e anil corporativo, ideal para visual moderno.',
    thumbnail: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=75',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=2000&q=80',
    defaultOpacity: 30,
    defaultBlur: 3,
    overlayType: 'light',
    overlayOpacity: 30,
    position: 'cover',
  },
  {
    id: 'dark-slate-luxury',
    name: 'Ardósia & Textura Noturna',
    category: 'Gradiente Executivo',
    description: 'Fundo escuro sóbrio e aveludado para um visual executivo de alta fidelidade.',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=75',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2000&q=80',
    defaultOpacity: 35,
    defaultBlur: 0,
    overlayType: 'dark',
    overlayOpacity: 60,
    position: 'cover',
  },
  {
    id: 'grid-matrix',
    name: 'Grade Milimetrada Contábil',
    category: 'Padrão Geométrico',
    description: 'Padrão geométrico suave estilo folha de balancete/ledger fiscal.',
    thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f5f9'/%3E%3Cpath d='M0 20h100M0 40h100M0 60h100M0 80h100M20 0v100M40 0v100M60 0v100M80 0v100' stroke='%23cbd5e1' stroke-width='1' fill='none'/%3E%3C/svg%3E",
    imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M0 40h40V0' fill='none' stroke='%233b82f6' stroke-width='0.75' stroke-opacity='0.15'/%3E%3C/svg%3E",
    defaultOpacity: 45,
    defaultBlur: 0,
    overlayType: 'light',
    overlayOpacity: 10,
    position: 'repeat',
  },
  {
    id: 'dots-pattern',
    name: 'Malha de Pontos Tecnológica',
    category: 'Padrão Geométrico',
    description: 'Pontilhado sutil de matriz de dados em alta precisão visual.',
    thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f8fafc'/%3E%3Ccircle cx='25' cy='25' r='3' fill='%2394a3b8'/%3E%3Ccircle cx='75' cy='25' r='3' fill='%2394a3b8'/%3E%3Ccircle cx='25' cy='75' r='3' fill='%2394a3b8'/%3E%3Ccircle cx='75' cy='75' r='3' fill='%2394a3b8'/%3E%3C/svg%3E",
    imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='1.5' fill='%236366f1' fill-opacity='0.25'/%3E%3C/svg%3E",
    defaultOpacity: 50,
    defaultBlur: 0,
    overlayType: 'light',
    overlayOpacity: 10,
    position: 'repeat',
  },
];

export async function getSiteBackgroundConfig(): Promise<SiteBackgroundConfig> {
  try {
    const res = await fetch('/api/settings/background');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Erro ao obter config de fundo do servidor:', err);
  }
  // Fallback para localStorage
  const saved = localStorage.getItem('mvrj_background_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return {
    enabled: false,
    imageUrl: '',
    presetId: 'none',
    opacity: 25,
    blur: 0,
    overlayType: 'light',
    overlayOpacity: 40,
    position: 'cover',
  };
}

export async function updateSiteBackgroundConfig(
  config: Partial<SiteBackgroundConfig>,
  adminName?: string
): Promise<{ status: string; config: SiteBackgroundConfig }> {
  const payload = {
    ...config,
    updatedBy: adminName || 'Administrador',
  };

  const response = await fetch('/api/settings/background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao atualizar configurações de fundo');
  }

  const data = await response.json();
  if (data.config) {
    localStorage.setItem('mvrj_background_config', JSON.stringify(data.config));
  }
  return data;
}

export async function uploadSiteBackgroundImage(
  imageBlobOrFile: Blob | File,
  adminName: string,
  onProgress?: (percent: number) => void
): Promise<{ imageUrl: string; config: SiteBackgroundConfig }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/background-image', true);
    xhr.setRequestHeader('Content-Type', imageBlobOrFile.type || 'image/jpeg');
    xhr.setRequestHeader('x-admin-user', encodeURIComponent(adminName));

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.config) {
            localStorage.setItem('mvrj_background_config', JSON.stringify(res.config));
          }
          if (onProgress) onProgress(100);
          resolve({
            imageUrl: res.imageUrl,
            config: res.config,
          });
        } catch (e) {
          reject(new Error('Resposta inválida do servidor ao processar imagem de fundo'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Erro HTTP ${xhr.status} no upload da imagem de fundo`));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status} no upload da imagem de fundo`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falha de conexão com o servidor ao enviar imagem de fundo'));
    };

    xhr.send(imageBlobOrFile);
  });
}

export async function resetSiteBackground(
  adminName: string
): Promise<{ status: string; config: SiteBackgroundConfig }> {
  const response = await fetch(`/api/settings/background?admin=${encodeURIComponent(adminName)}`, {
    method: 'DELETE',
    headers: {
      'x-admin-user': encodeURIComponent(adminName),
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao redefinir imagem de fundo');
  }

  const data = await response.json();
  if (data.config) {
    localStorage.setItem('mvrj_background_config', JSON.stringify(data.config));
  }
  return data;
}

// ==============================================================================
// AUTH / LOGIN HEADER CUSTOMIZATION HELPERS
// ==============================================================================

export const DEFAULT_AUTH_HEADER_CONFIG: AuthHeaderConfig = {
  title: 'MVRJ CONTÁBIL',
  subtitle: 'Gestão Eletrônica de Documentos Segura',
  badgeText: 'Supabase RLS & Cloudflare R2',
  showBadge: true,
  showTitle: true,
  showSubtitle: true,
  showIcon: true,
  bgType: 'gradient',
  gradientPreset: 'slate-indigo-blue',
  bgImageUrl: '',
  bgSize: 'contain',
  bgPosition: 'center',
  headerHeight: 'normal',
  bgColor: '#091830',
  bgOpacity: 100,
  bgBlur: 0,
  bgOverlayType: 'dark',
  bgOverlayOpacity: 40,
  logoType: 'icon',
  logoImageUrl: '',
  iconName: 'FolderLock',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema MVRJCONTÁBIL',
};

export async function getAuthHeaderConfig(): Promise<AuthHeaderConfig> {
  try {
    const res = await fetch('/api/settings/auth-header');
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('mvrj_auth_header_config', JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Erro ao carregar cabeçalho de login do servidor, usando fallback local:', err);
  }

  const local = localStorage.getItem('mvrj_auth_header_config');
  if (local) {
    try {
      return { ...DEFAULT_AUTH_HEADER_CONFIG, ...JSON.parse(local) };
    } catch {}
  }
  return DEFAULT_AUTH_HEADER_CONFIG;
}

export async function saveAuthHeaderConfig(
  config: Partial<AuthHeaderConfig>
): Promise<{ status: string; config: AuthHeaderConfig }> {
  const current = await getAuthHeaderConfig();
  const merged: AuthHeaderConfig = { ...current, ...config, updatedAt: new Date().toISOString() };
  localStorage.setItem('mvrj_auth_header_config', JSON.stringify(merged));

  const response = await fetch('/api/settings/auth-header', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao atualizar cabeçalho de login');
  }

  const data = await response.json();
  if (data.config) {
    localStorage.setItem('mvrj_auth_header_config', JSON.stringify(data.config));
  }
  return data;
}

export async function uploadAuthHeaderImage(
  imageBlobOrFile: Blob | File,
  adminName: string,
  onProgress?: (percent: number) => void
): Promise<{ imageUrl: string; config: AuthHeaderConfig }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/auth-header-image', true);
    xhr.setRequestHeader('Content-Type', imageBlobOrFile.type || 'image/jpeg');
    xhr.setRequestHeader('x-admin-user', encodeURIComponent(adminName));

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.config) {
            localStorage.setItem('mvrj_auth_header_config', JSON.stringify(res.config));
          }
          if (onProgress) onProgress(100);
          resolve({
            imageUrl: res.imageUrl,
            config: res.config,
          });
        } catch (e) {
          reject(new Error('Resposta inválida do servidor ao processar imagem de cabeçalho'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Erro HTTP ${xhr.status} no upload da imagem do cabeçalho`));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status} no upload da imagem do cabeçalho`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falha de conexão com o servidor ao enviar imagem do cabeçalho'));
    };

    xhr.send(imageBlobOrFile);
  });
}

export async function uploadCompanyLogo(
  imageBlobOrFile: Blob | File,
  adminName: string,
  onProgress?: (percent: number) => void
): Promise<{ imageUrl: string; config: AuthHeaderConfig }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/logo-image', true);
    xhr.setRequestHeader('Content-Type', imageBlobOrFile.type || 'image/png');
    xhr.setRequestHeader('x-admin-user', encodeURIComponent(adminName));

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.config) {
            localStorage.setItem('mvrj_auth_header_config', JSON.stringify(res.config));
          }
          if (onProgress) onProgress(100);
          resolve({
            imageUrl: res.imageUrl,
            config: res.config,
          });
        } catch (e) {
          reject(new Error('Resposta inválida do servidor ao processar logotipo'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Erro HTTP ${xhr.status} no upload do logotipo`));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status} no upload do logotipo`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falha de conexão com o servidor ao enviar logotipo'));
    };

    xhr.send(imageBlobOrFile);
  });
}

export async function resetAuthHeaderConfig(
  adminName: string
): Promise<{ status: string; config: AuthHeaderConfig }> {
  const response = await fetch(`/api/settings/auth-header?admin=${encodeURIComponent(adminName)}`, {
    method: 'DELETE',
    headers: {
      'x-admin-user': encodeURIComponent(adminName),
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao redefinir cabeçalho de login');
  }

  const data = await response.json();
  if (data.config) {
    localStorage.setItem('mvrj_auth_header_config', JSON.stringify(data.config));
  }
  return data;
}

// ==============================================================================
// SUPABASE DATABASE & CLOUDFLARE R2 PERSISTENCE FUNCTIONS
// ==============================================================================

/**
 * Fetch folders from Supabase / Unified Storage
 */
export async function fetchFoldersFromApi(): Promise<Folder[]> {
  try {
    const res = await fetch(`/api/folders?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('Not JSON');
    const data = await res.json();
    if (Array.isArray(data.folders)) {
        return data.folders;
    }
  } catch (err) {
    console.warn('[StorageService] Falha ao buscar pastas da API:', err);
  }
  return [];
}

/**
 * Create folder in Supabase / Unified Storage
 */
export async function createFolderInApi(
  name: string,
  parentId: string | null,
  sector: Sector,
  createdBy?: string | null,
  customId?: string
): Promise<Folder> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId, sector, created_by: createdBy, id: customId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao criar pasta no Supabase');
  }

  const data = await res.json();
  return data.folder;
}

/**
 * Delete folder in Supabase / Unified Storage
 */
export async function deleteFolderInApi(folderId: string): Promise<void> {
  const res = await fetch(`/api/folders/${folderId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao excluir pasta no Supabase');
  }
}

/**
 * Fetch files from Supabase / Unified Storage
 */
export async function fetchFilesFromApi(): Promise<DocumentFile[]> {
  try {
    const res = await fetch(`/api/files?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('Not JSON');
    const data = await res.json();
    if (Array.isArray(data.files)) {
      return data.files;
    }
  } catch (err) {
    console.warn('[StorageService] Falha ao buscar arquivos da API:', err);
  }
  return [];
}

/**
 * Save newly uploaded file record into Supabase
 */
export async function saveFileRecordToApi(file: DocumentFile): Promise<DocumentFile> {
  const res = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(file),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao registrar arquivo no Supabase');
  }

  const data = await res.json();
  return data.file;
}

/**
 * Delete file from Supabase & Cloudflare R2
 */
export async function deleteFileInApi(fileId: string): Promise<void> {
  const res = await fetch(`/api/files/${fileId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao excluir arquivo');
  }
}

/**
 * Fetch audit logs from Supabase
 */
export async function fetchAuditLogsFromApi(): Promise<AuditLog[]> {
  try {
    const res = await fetch('/api/audit-logs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.logs)) {
      return data.logs;
    }
  } catch (err) {
    console.warn('[StorageService] Falha ao buscar logs de auditoria:', err);
  }
  return [];
}

/**
 * Save audit log to Supabase
 */
export async function saveAuditLogInApi(log: Partial<AuditLog>): Promise<void> {
  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  } catch (err) {
    console.warn('[StorageService] Falha ao enviar log de auditoria:', err);
  }
}

/**
 * Fetch folder permissions from Supabase
 */
export async function fetchFolderPermissionsFromApi(): Promise<FolderPermission[]> {
  try {
    const res = await fetch('/api/folder-permissions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.permissions)) {
      return data.permissions;
    }
  } catch (err) {
    console.warn('[StorageService] Falha ao buscar permissões:', err);
  }
  return [];
}

/**
 * Save folder permission to Supabase
 */
export async function saveFolderPermissionToApi(
  folderId: string,
  profileId: string,
  level: PermissionLevel
): Promise<void> {
  const res = await fetch('/api/folder-permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId, profile_id: profileId, permission_level: level }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao salvar permissão no Supabase');
  }
}

/**
 * Fetch system connection health (Supabase + Cloudflare R2)
 */
export async function fetchSystemStatusFromApi(): Promise<{
  supabase: { connected: boolean; url: string; filesCount: number; foldersCount: number; profilesCount: number; error: string | null };
  r2: { connected: boolean; bucket: string; objectsCount: number; totalBytes: number; configured: boolean; error: string | null };
}> {
  const res = await fetch('/api/system/status');
  if (!res.ok) throw new Error('Falha ao verificar status do sistema');
  return res.json();
}

/**
 * Returns a permanent, non-expiring streaming URL through the server proxy for images and previews
 */
export function getPermanentViewUrl(storageKey: string, fileName?: string): string {
  return `/api/r2/view?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(fileName || '')}`;
}

/**
 * Fetch unified user profiles with avatar URLs from the backend and R2
 */
export async function fetchProfilesFromApi(): Promise<UserProfile[]> {
  try {
    const res = await fetch('/api/profiles');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.profiles)) {
      localStorage.setItem('mvrj_profiles', JSON.stringify(data.profiles));
      return data.profiles;
    }
  } catch (err) {
    console.warn('[StorageService] Falha ao buscar perfis da API:', err);
  }
  const cached = localStorage.getItem('mvrj_profiles');
  return cached ? JSON.parse(cached) : [];
}
