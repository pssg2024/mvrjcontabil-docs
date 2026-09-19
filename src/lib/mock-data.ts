import { Folder, DocumentFile, UserProfile, FolderPermission, AuditLog } from '../types';

export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: '57e1d483-669b-4791-b09e-7496570e63ea',
    email: 'evandro230655@gmail.com',
    full_name: 'Evandro (Administrador Geral)',
    sector: 'Diretoria',
    role: 'admin',
    status: 'active',
    avatar_url: '/api/r2/avatar/57e1d483-669b-4791-b09e-7496570e63ea.webp',
    first_access_completed: false, // Inicia como falso para acionar o fluxo obrigatório de troca de senha e LGPD
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-01T08:00:00Z',
  }
];

export const INITIAL_FOLDERS: Folder[] = [];
export const INITIAL_FILES: DocumentFile[] = [];
export const INITIAL_FOLDER_PERMISSIONS: FolderPermission[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
