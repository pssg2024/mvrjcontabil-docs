export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- SISTEMA DE GESTÃO ELETRÔNICA DE DOCUMENTOS (GED) - MVRJCONTÁBIL
-- SCHEMA COMPLETO SUPABASE (PostgreSQL + RLS + Triggers + RBAC)
-- ==============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS DE CONTROLE
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending', 'active', 'blocked', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sector_type AS ENUM ('Fiscal', 'Departamento Pessoal', 'Contábil', 'Diretoria', 'Financeiro', 'Geral');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE permission_level AS ENUM ('viewer', 'editor', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. TABELA DE PERFIS DE USUÁRIOS (Vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  sector sector_type NOT NULL DEFAULT 'Geral',
  role user_role NOT NULL DEFAULT 'viewer',
  status user_status NOT NULL DEFAULT 'pending',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA DE PASTAS (Estrutura Hierárquica com Controle de Acesso Granular)
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sector sector_type NOT NULL DEFAULT 'Geral',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  allowed_user_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir coluna de controle de acesso granular para bases existentes
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS allowed_user_ids TEXT[] DEFAULT '{}';

-- 5. TABELA DE ARQUIVOS (Metadados Cloudflare R2 e Otimização)
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE, -- Chave no bucket Cloudflare R2
  mime_type TEXT NOT NULL,
  original_size BIGINT NOT NULL,    -- Tamanho original em bytes
  optimized_size BIGINT NOT NULL,   -- Tamanho após otimização (WebP/PDF stream)
  compression_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- % de economia
  pages_count INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  checksum_sha256 TEXT,
  due_date DATE,                    -- Data de vencimento da guia / obrigação
  company_name TEXT,                -- Nome da empresa ou cliente
  client_phone TEXT,                -- Telefone do cliente para WhatsApp
  notification_sent BOOLEAN DEFAULT FALSE, -- Indicador se o aviso de vencimento já foi disparado
  document_type TEXT,               -- Tipo de Guia (DAS, DARF, FGTS, etc.)
  amount NUMERIC(12,2),             -- Valor da Guia (opcional)
  is_archived BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALIAS / COMPATIBILIDADE: public.documents aponta para public.files
CREATE OR REPLACE VIEW public.documents AS SELECT * FROM public.files;

-- MIGRAÇÃO AUTOMÁTICA DE COLUNAS SE A TABELA JÁ EXISTIR NO BANCO
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);

-- 6. TABELA DE PERMISSÕES GRANULARES POR PASTA (Matriz RBAC)
CREATE TABLE IF NOT EXISTS public.folder_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_level permission_level NOT NULL DEFAULT 'viewer',
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_folder_profile UNIQUE(folder_id, profile_id)
);

-- 7. TABELA DE AUDITORIA (Trilha de Conformidade e Ações)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  sector sector_type,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES PARA ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_sector ON public.profiles(sector);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_sector ON public.folders(sector);
CREATE INDEX IF NOT EXISTS idx_files_folder ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON public.files(name);
CREATE INDEX IF NOT EXISTS idx_folder_perms_user ON public.folder_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_folder_perms_folder ON public.folder_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 8. FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER)
-- ==============================================================================

-- Verifica se o usuário atual é um Administrador ativo ou Diretoria
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR sector = 'Diretoria')
      AND (status = 'active' OR status = 'approved')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se o usuário tem permissão mínima na pasta (Regra de Negócios RBAC Granular)
CREATE OR REPLACE FUNCTION public.has_folder_permission(
  target_folder_id UUID,
  min_level permission_level
)
RETURNS BOOLEAN AS $$
DECLARE
  user_status_val user_status;
  user_role_val user_role;
  user_sector sector_type;
  folder_allowed_users TEXT[];
  user_perm permission_level;
BEGIN
  -- 1. Buscar status, papel e setor do usuário autenticado
  SELECT status, role, sector INTO user_status_val, user_role_val, user_sector
  FROM public.profiles
  WHERE id = auth.uid();

  -- Se não for ativo/aprovado, nega sumariamente
  IF user_status_val IS NULL OR (user_status_val <> 'active' AND user_status_val <> 'approved') THEN
    RETURN FALSE;
  END IF;

  -- 2. Administradores globais e Diretoria têm acesso TOTAL irrestrito
  IF user_role_val = 'admin' OR user_sector = 'Diretoria' THEN
    RETURN TRUE;
  END IF;

  -- 3. Usuários comuns: verificar se o ID do usuário está na lista allowed_user_ids da pasta
  SELECT allowed_user_ids INTO folder_allowed_users
  FROM public.folders
  WHERE id = target_folder_id;

  IF folder_allowed_users IS NOT NULL AND array_length(folder_allowed_users, 1) > 0 THEN
    IF auth.uid()::text = ANY(folder_allowed_users) THEN
      IF min_level = 'viewer' THEN
        RETURN TRUE;
      END IF;
    ELSE
      -- Se a pasta tem lista restritiva e o usuário NÃO está nela, acesso bloqueado
      RETURN FALSE;
    END IF;
  END IF;

  -- 4. Buscar permissão explícita atribuída na tabela folder_permissions
  SELECT permission_level INTO user_perm
  FROM public.folder_permissions
  WHERE folder_id = target_folder_id AND profile_id = auth.uid();

  IF user_perm IS NOT NULL THEN
    IF user_perm = 'none' THEN
      RETURN FALSE;
    END IF;
    IF min_level = 'viewer' THEN
      RETURN TRUE;
    ELSIF min_level = 'editor' AND user_perm IN ('editor', 'admin') THEN
      RETURN TRUE;
    ELSIF min_level = 'admin' AND user_perm = 'admin' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. TRIGGERS: CRIAÇÃO AUTOMÁTICA DE PERFIL NO SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_sector sector_type;
BEGIN
  -- Extrai o setor dos metadados ou assume 'Geral'
  BEGIN
    extracted_sector := (NEW.raw_user_meta_data->>'sector')::sector_type;
  EXCEPTION WHEN OTHERS THEN
    extracted_sector := 'Geral';
  END;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    sector,
    role,
    status
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(extracted_sector, 'Geral'),
    'viewer',
    'pending' -- Obrigatoriamente 'pending' até aprovação da Diretoria/Admin
  );

  -- Log de Auditoria da solicitação
  INSERT INTO public.audit_logs (
    action,
    target_type,
    target_id,
    details,
    profile_id,
    user_name,
    sector
  ) VALUES (
    'ACCESS_REQUEST',
    'USER',
    NEW.id::text,
    jsonb_build_object(
      'email', NEW.email,
      'requested_sector', extracted_sector
    ),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(extracted_sector, 'Geral')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar trigger na tabela auth.users do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Habilitar RLS em todas as tabelas sensíveis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLÍTICAS: PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles: Users can read own profile" ON public.profiles;
CREATE POLICY "Profiles: Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: Users can update own profile" ON public.profiles;
CREATE POLICY "Profiles: Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: Admins can view all profiles" ON public.profiles;
CREATE POLICY "Profiles: Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Profiles: Admins can update profiles" ON public.profiles;
CREATE POLICY "Profiles: Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- POLÍTICAS: FOLDERS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Folders: Users can view authorized folders" ON public.folders;
CREATE POLICY "Folders: Users can view authorized folders"
  ON public.folders FOR SELECT
  USING (public.has_folder_permission(id, 'viewer'));

DROP POLICY IF EXISTS "Folders: Authorized users can create folders" ON public.folders;
CREATE POLICY "Folders: Authorized users can create folders"
  ON public.folders FOR INSERT
  WITH CHECK (
    public.is_admin() OR (
      parent_id IS NOT NULL AND public.has_folder_permission(parent_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Folders: Admins can manage folders" ON public.folders;
CREATE POLICY "Folders: Admins can manage folders"
  ON public.folders FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- POLÍTICAS: FILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Files: Users can view files in authorized folders" ON public.files;
CREATE POLICY "Files: Users can view files in authorized folders"
  ON public.files FOR SELECT
  USING (public.has_folder_permission(folder_id, 'viewer'));

DROP POLICY IF EXISTS "Files: Editors can upload files to authorized folders" ON public.files;
CREATE POLICY "Files: Editors can upload files to authorized folders"
  ON public.files FOR INSERT
  WITH CHECK (public.has_folder_permission(folder_id, 'editor'));

DROP POLICY IF EXISTS "Files: Editors can update files in authorized folders" ON public.files;
CREATE POLICY "Files: Editors can update files in authorized folders"
  ON public.files FOR UPDATE
  USING (public.has_folder_permission(folder_id, 'editor'))
  WITH CHECK (public.has_folder_permission(folder_id, 'editor'));

DROP POLICY IF EXISTS "Files: Admins can delete files" ON public.files;
CREATE POLICY "Files: Admins can delete files"
  ON public.files FOR DELETE
  USING (public.has_folder_permission(folder_id, 'admin'));

-- ------------------------------------------------------------------------------
-- POLÍTICAS: FOLDER_PERMISSIONS (MATRIZ RBAC)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permissions: Users see own permissions" ON public.folder_permissions;
CREATE POLICY "Permissions: Users see own permissions"
  ON public.folder_permissions FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Permissions: Admins full control" ON public.folder_permissions;
CREATE POLICY "Permissions: Admins full control"
  ON public.folder_permissions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- POLÍTICAS: AUDIT_LOGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Audit: Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Audit: Admins can read audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Audit: Authenticated users can insert logs" ON public.audit_logs;
CREATE POLICY "Audit: Authenticated users can insert logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================================================
-- DADOS INICIAIS (PASTAS PADRÃO POR SETOR CONTÁBIL)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.folders WHERE name = 'Fiscal & Tributário') THEN
    INSERT INTO public.folders (name, sector) VALUES
      ('Fiscal & Tributário', 'Fiscal'),
      ('Departamento Pessoal & Folha', 'Departamento Pessoal'),
      ('Contabilidade & Balanços', 'Contábil'),
      ('Diretoria & Atas', 'Diretoria'),
      ('Financeiro & Faturamento', 'Financeiro'),
      ('Modelos & Documentos Gerais', 'Geral');
  END IF;
END $$;
`;
