export type UserRole = 'admin' | 'editor' | 'viewer' | 'User';
export type UserStatus = 'pending' | 'active' | 'approved' | 'blocked' | 'rejected';

export type Sector = 
  | 'Fiscal'
  | 'Departamento Pessoal'
  | 'Contábil'
  | 'Diretoria'
  | 'Financeiro'
  | 'Geral';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  sector: Sector;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  first_access_completed?: boolean;
  lgpd_accepted_at?: string;
  password_changed_at?: string;
  lgpd_terms_version?: string;
}

export type PermissionLevel = 'viewer' | 'editor' | 'admin';

export interface FolderPermission {
  id: string;
  folder_id: string;
  profile_id: string;
  permission_level: PermissionLevel;
  granted_by?: string;
  created_at: string;
}

export interface Folder {
  id: string;
  parent_id: string | null;
  name: string;
  sector: Sector;
  created_by: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface DocumentFile {
  id: string;
  folder_id: string;
  name: string;
  storage_key: string;
  mime_type: string;
  original_size: number;
  optimized_size: number;
  compression_ratio: number; // e.g. 65 means 65% reduction
  pages_count?: number;
  tags: string[];
  uploaded_by: string;
  uploader_name?: string;
  sector: Sector;
  checksum_sha256?: string;
  due_date?: string; // Data de Vencimento da Guia / Obrigação (YYYY-MM-DD)
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
  preview_url?: string;
}

export type AuditAction = 
  | 'LOGIN'
  | 'ACCESS_REQUEST'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_BLOCKED'
  | 'PROFILE_UPDATED'
  | 'PASSWORD_CHANGED'
  | 'LGPD_TERMS_ACCEPTED'
  | 'PERMISSION_CHANGE'
  | 'FILE_UPLOAD'
  | 'FILE_VIEW'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'FOLDER_CREATE'
  | 'FOLDER_DELETE'
  | 'BACKGROUND_IMAGE_CHANGED'
  | 'AUTH_BANNER_CHANGED'
  | 'USER_DELETED';

export interface AuditLog {
  id: string;
  action: AuditAction;
  target_type: 'USER' | 'FILE' | 'FOLDER' | 'PERMISSION' | 'SECURITY' | 'SETTINGS';
  target_id: string;
  details: Record<string, any>;
  profile_id: string;
  user_name: string;
  sector: Sector;
  ip_address?: string;
  created_at: string;
}

export interface SiteBackgroundConfig {
  enabled: boolean;
  imageUrl: string;
  presetId?: string;
  opacity: number; // 5 to 100
  blur: number; // 0 to 20 px
  overlayType: 'light' | 'dark' | 'none';
  overlayOpacity: number; // 0 to 90
  position: 'cover' | 'contain' | 'repeat' | 'center';
  updatedAt?: string;
  updatedBy?: string;
}

export interface AuthHeaderConfig {
  title: string;
  subtitle: string;
  badgeText: string;
  showBadge: boolean;
  showTitle?: boolean; // Permite ocultar título de texto sobreposto (evita duplicar com a imagem/logo)
  showSubtitle?: boolean; // Permite ocultar subtítulo sobreposto
  showIcon?: boolean; // Permite ocultar caixa de ícone centralizada (desbloqueia arte da imagem)
  bgType: 'gradient' | 'image';
  gradientPreset: string; // e.g., 'slate-indigo-blue' | 'midnight-navy' | 'emerald-dark' | 'royal-purple' | 'graphite-dark' | 'blue-cyan'
  bgImageUrl?: string;
  bgSize?: 'contain' | 'cover' | 'auto'; // 'contain' ajusta imagem inteira sem cortar nada
  bgPosition?: 'center' | 'top' | 'bottom';
  headerHeight?: 'compact' | 'normal' | 'tall' | 'banner' | 'auto'; // Altura harmoniosa do cabeçalho
  bgColor?: string; // Cor de fundo do container para mesclar perfeitamente com a imagem
  bgOpacity: number; // 10 to 100
  bgBlur: number; // 0 to 15
  bgOverlayType: 'dark' | 'light' | 'none';
  bgOverlayOpacity: number; // 0 to 90
  logoType: 'icon' | 'image';
  logoImageUrl?: string;
  iconName: 'FolderLock' | 'ShieldCheck' | 'Building2' | 'Landmark' | 'FileText' | 'Lock';
  updatedAt?: string;
  updatedBy?: string;
}

export interface OptimizationResult {
  file: File | Blob;
  originalSize: number;
  optimizedSize: number;
  reductionPercentage: number;
  mimeType: string;
  pagesCount?: number;
  dataUrl?: string;
}

export interface StorageMetrics {
  totalCapacityBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  freePercent: number;
  filesCount: number;
  maxFilesCapacity?: number;
  remainingFilesCapacity?: number;
  originalBytes: number;
  savedBytes: number;
  savingsPercent: number;
  quotaTier: string;
  bySector?: Record<string, { usedBytes: number; filesCount: number }>;
}
