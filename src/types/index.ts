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
  allowed_user_ids?: string[];
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
  company_name?: string; // Nome da empresa ou cliente
  client_phone?: string; // Telefone do cliente para WhatsApp
  notification_sent?: boolean; // Indicador se o aviso já foi disparado
  document_type?: string; // Tipo de Guia (DAS, DARF, FGTS, etc.)
  amount?: number; // Valor da Guia (opcional)
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
  | 'FILE_RENAME'
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

export interface CompanyCnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral?: string;
  descricao_motivo_situacao_cadastral?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo: number | string; descricao: string }>;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  email?: string | null;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  opcao_pelo_simples?: boolean;
  data_opcao_pelo_simples?: string | null;
  opcao_pelo_mei?: boolean;
  data_opcao_pelo_mei?: string | null;
  qsa?: Array<{
    nome_socio: string;
    qualificacao_socio?: string;
    faixa_etaria?: string;
    pais?: string | null;
  }>;
}

export type TaxRegime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';

export interface Company {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_estadual?: string;
  regime_tributario: TaxRegime;
  certificate_storage_key?: string;
  certificate_password?: string;
  certificate_filename?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  ncm: string;
  quantity: number;
  unit_value: number;
  subtotal: number;
  icms_rate: number;
  icms_value: number;
}

export interface Invoice {
  id: string;
  company_id: string;
  type: '0' | '1'; // '0' = Entrada, '1' = Saída
  natureza_operacao: string;
  cfop: string;
  serie: string;
  numero: string;
  dest_razao_social: string;
  dest_cnpj_cpf: string;
  dest_inscricao_estadual?: string;
  dest_endereco: string;
  items: InvoiceItem[];
  icms_base: number;
  icms_total: number;
  total_produtos: number;
  total_nota: number;
  pdf_storage_key?: string;
  document_id?: string;
  created_at: string;
}
