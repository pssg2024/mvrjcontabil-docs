import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Multer configured with memoryStorage for direct streaming to Cloudflare R2
// NEVER writes files to local server directories (e.g. ./uploads, ./public/uploads, /tmp)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Raw body parsers for binary uploads MUST run before general json/urlencoded parsers
app.use('/api/r2/upload-direct', express.raw({ type: () => true, limit: '100mb' }));
app.use('/api/r2/avatar/:userId', express.raw({ type: () => true, limit: '10mb' }));
app.use('/api/r2/background-image', express.raw({ type: () => true, limit: '25mb' }));
app.use('/api/r2/auth-header-image', express.raw({ type: () => true, limit: '25mb' }));
app.use('/api/r2/logo-image', express.raw({ type: () => true, limit: '10mb' }));

// Middleware for parsing JSON with generous limit for metadata/base64 previews
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// In-memory mock storage cache for demo/preview mode fallback
const inMemoryFileStore = new Map<string, { buffer: Buffer; mimeType: string; name: string }>();

// Supabase Server Client (Service Role or Anon Key)
function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  
  const key = serviceKey || anonKey;
  
  if (!url || !key) return null;
  
  if (serviceKey) {
    console.log('[Supabase Server] Usando SERVICE_ROLE_KEY (Bypasses RLS)');
  } else {
    console.warn('[Supabase Server] Usando ANON_KEY (Sujeito a RLS - Pastas podem sumir se políticas não estiverem configuradas)');
  }

  try {
    return createClient(url, key);
  } catch (err) {
    console.error('[Supabase Server] Erro ao instanciar client:', err);
    return null;
  }
}

// R2 Client Initialization - strictly consumes the Cloudflare R2 environment variables
function getR2Client(): { client: S3Client | null; bucketName: string; isConfigured: boolean; endpoint: string } {
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucketName = (process.env.R2_BUCKET_NAME || 'mvrjcontabil-docs').trim();

  let endpoint = (process.env.R2_ENDPOINT || '').trim();
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();

  if (!endpoint && accountId) {
    endpoint = `https://${accountId.replace(/^https?:\/\//, '')}.r2.cloudflarestorage.com`;
  } else if (endpoint) {
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
  }

  if (endpoint && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    return { client, bucketName, isConfigured: true, endpoint };
  }

  return { client: null, bucketName, isConfigured: false, endpoint: endpoint || '' };
}

// ==============================================================================
// API ROUTES
// ==============================================================================

// 1. Status & Health Check
app.get('/api/health', (req: Request, res: Response) => {
  const { isConfigured, bucketName } = getR2Client();
  res.json({
    status: 'ok',
    service: 'MVRJCONTÁBIL GED Backend',
    r2_configured: isConfigured,
    r2_bucket: bucketName,
    timestamp: new Date().toISOString(),
  });
});

// 2. R2 Configuration Status
app.get('/api/r2/status', (req: Request, res: Response) => {
  const { isConfigured, bucketName } = getR2Client();
  res.json({
    isConfigured,
    bucketName,
    endpoint: process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com'),
    mode: isConfigured ? 'PRODUCTION_CLOUDFLARE_R2' : 'SECURE_SANDBOX_SIMULATION',
    supportedMimes: ['application/pdf', 'image/webp', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  });
});

// Helper to check if storage quota limit is reached (default 10 GB)
function isStorageQuotaExceeded(): { exceeded: boolean; usedBytes: number; quotaBytes: number } {
  const quotaBytes = process.env.R2_QUOTA_BYTES 
    ? parseInt(process.env.R2_QUOTA_BYTES, 10) 
    : 10 * 1024 * 1024 * 1024; // 10 GB

  let totalUsed = 0;
  for (const item of inMemoryFileStore.values()) {
    totalUsed += item.buffer.length;
  }

  return {
    exceeded: totalUsed >= quotaBytes,
    usedBytes: totalUsed,
    quotaBytes,
  };
}

// 3. Generate Presigned PUT URL for Upload
app.post('/api/r2/presigned-upload', async (req: Request, res: Response) => {
  try {
    const { fileName, mimeType, sector, folderId, size } = req.body;

    if (!fileName || !mimeType) {
      return res.status(400).json({ error: 'Parâmetros fileName e mimeType são obrigatórios' });
    }

    // Validação estrita de Quota de Armazenamento R2
    const quotaCheck = isStorageQuotaExceeded();
    if (quotaCheck.exceeded) {
      return res.status(403).json({
        error: 'Limite de armazenamento Cloudflare R2 atingido. Upload bloqueado.',
        code: 'STORAGE_QUOTA_EXCEEDED',
        supportContact: '21973960077',
        message: 'O limite de capacidade do sistema foi atingido. Entre em contato com o suporte de TI (21) 97396-0077.',
      });
    }

    // Gerar chave hierárquica e segura no Cloudflare R2
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeSector = (sector || 'Geral').toLowerCase().replace(/\s+/g, '-');
    const storageKey = `sectors/${safeSector}/${folderId || 'root'}/${Date.now()}-${cleanFileName}`;

    const { client, bucketName, isConfigured } = getR2Client();

    if (isConfigured && client) {
      // GERAÇÃO REAL DE PRESIGNED URL COM AWS S3 SDK PARA CLOUDFLARE R2
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        ContentType: mimeType,
        Metadata: {
          'uploaded-by': req.headers['x-user-id']?.toString() || 'anonymous',
          'client-name': 'MVRJCONTABIL-GED',
        },
      });

      // URL pré-assinada válida por 15 minutos (900 segundos)
      const presignedPutUrl = await getSignedUrl(client, command, { expiresIn: 900 });

      return res.json({
        storageKey,
        uploadUrl: presignedPutUrl,
        expiresInSeconds: 900,
        provider: 'Cloudflare R2 (S3 API)',
        isSimulation: false,
      });
    }

    // MODO SANDBOX/PREVIEW AUTOMÁTICO (Caso as credenciais não estejam no .env)
    const simulatedUploadUrl = `/api/r2/mock-upload/${encodeURIComponent(storageKey)}`;
    return res.json({
      storageKey,
      uploadUrl: simulatedUploadUrl,
      expiresInSeconds: 900,
      provider: 'Local Sandbox R2 Emulator',
      isSimulation: true,
      message: 'Operando em ambiente local. Para Cloudflare R2 de produção, insira R2_ACCOUNT_ID e chaves no .env.',
    });
  } catch (error: any) {
    console.error('Erro ao gerar Presigned PUT URL:', error);
    res.status(500).json({ error: 'Erro ao gerar URL pré-assinada de upload', details: error.message });
  }
});

// Helper to accurately detect MIME types for images, documents, certificates, and spreadsheets
function detectMimeType(fileNameOrKey: string, fallbackMime?: string): string {
  const ext = path.extname(fileNameOrKey).toLowerCase();
  switch (ext) {
    case '.pfx':
    case '.p12': return 'application/x-pkcs12';
    case '.cer':
    case '.crt': return 'application/x-x509-ca-cert';
    case '.key': return 'application/pkcs8';
    case '.xml':
    case '.nfe':
    case '.cte':
    case '.sped': return 'application/xml';
    case '.webp': return 'image/webp';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.bmp': return 'image/bmp';
    case '.ico': return 'image/x-icon';
    case '.pdf': return 'application/pdf';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls': return 'application/vnd.ms-excel';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc': return 'application/msword';
    case '.zip': return 'application/zip';
    case '.rar': return 'application/x-rar-compressed';
    case '.7z': return 'application/x-7z-compressed';
    case '.txt': return 'text/plain; charset=utf-8';
    case '.csv': return 'text/csv; charset=utf-8';
    case '.json': return 'application/json';
    case '.ofx': return 'application/x-ofx';
    default:
      if (fallbackMime && fallbackMime !== 'application/octet-stream') {
        return fallbackMime;
      }
      return 'application/octet-stream';
  }
}

// Helper to stream R2 object directly to response or fallback to memory store
async function streamR2Object(
  storageKey: string,
  fileName: string,
  mimeType: string,
  disposition: 'inline' | 'attachment',
  res: Response
) {
  const { client, bucketName, isConfigured } = getR2Client();
  const cleanMime = detectMimeType(fileName || storageKey, mimeType);

  if (isConfigured && client) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
      });
      const r2Response = await client.send(command);

      if (r2Response.Body) {
        const finalMime = (cleanMime !== 'application/octet-stream')
          ? cleanMime
          : (r2Response.ContentType || 'application/octet-stream');

        res.setHeader('Content-Type', finalMime);
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileName || path.basename(storageKey))}"`);
        if (r2Response.ContentLength) {
          res.setHeader('Content-Length', r2Response.ContentLength);
        }
        res.setHeader('Cache-Control', 'public, max-age=86400');

        const stream = r2Response.Body as NodeJS.ReadableStream;
        return stream.pipe(res);
      }
    } catch (s3Err: any) {
      console.warn(`[R2 Stream] Objeto ${storageKey} não encontrado no R2 (${s3Err.message}), verificando cache local`);
    }
  }

  // Fallback to memory store if present
  const cached = inMemoryFileStore.get(storageKey);
  if (cached) {
    res.setHeader('Content-Type', cleanMime !== 'application/octet-stream' ? cleanMime : (cached.mimeType || 'application/octet-stream'));
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileName || cached.name || path.basename(storageKey))}"`);
    res.setHeader('Content-Length', cached.buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(cached.buffer);
  }

  return res.status(404).json({ error: 'Arquivo não encontrado no Cloudflare R2' });
}

// 4. Generate Presigned GET URL for Secure Download/Preview (7 days expiration with resilient proxy fallback)
app.post('/api/r2/presigned-download', async (req: Request, res: Response) => {
  try {
    const { storageKey, fileName, inline } = req.body;

    if (!storageKey) {
      return res.status(400).json({ error: 'storageKey é obrigatório' });
    }

    const { client, bucketName, isConfigured } = getR2Client();
    const effectiveFileName = fileName || path.basename(storageKey);
    const serverProxyUrl = inline
      ? `/api/r2/view?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(effectiveFileName)}`
      : `/api/r2/download?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(effectiveFileName)}`;

    if (isConfigured && client) {
      try {
        const disposition = inline ? 'inline' : 'attachment';
        const cleanMime = detectMimeType(effectiveFileName);
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(effectiveFileName)}"`,
          ResponseContentType: cleanMime !== 'application/octet-stream' ? cleanMime : undefined,
        });

        // 7 dias de expiração (604800 segundos) para prevenir expiração prematura
        const presignedGetUrl = await getSignedUrl(client, command, { expiresIn: 604800 });

        return res.json({
          downloadUrl: inline ? serverProxyUrl : presignedGetUrl,
          directR2Url: presignedGetUrl,
          serverProxyUrl,
          expiresInSeconds: 604800,
          provider: 'Cloudflare R2 (S3 API)',
          isSimulation: false,
        });
      } catch (signErr: any) {
        console.warn('[R2 Presigned Download] Fallback para servidor streaming proxy:', signErr.message);
      }
    }

    // Sandbox / fallback download URL
    return res.json({
      downloadUrl: serverProxyUrl,
      serverProxyUrl,
      expiresInSeconds: 604800,
      provider: 'MVRJ Server Stream Proxy',
      isSimulation: !isConfigured,
    });
  } catch (error: any) {
    console.error('Erro ao gerar Presigned GET URL:', error);
    res.status(500).json({ error: 'Erro ao gerar URL de visualização segura', details: error.message });
  }
});

// 4.1 Route to View file by ID or StorageKey (Streams directly from Cloudflare R2)
app.get('/api/files/:id/view', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const supabase = getSupabaseServerClient();
    let fileRecord: any = null;

    if (supabase && isValidUuid(fileId)) {
      const { data } = await supabase.from('files').select('*').eq('id', fileId).single();
      fileRecord = data;
    }

    if (!fileRecord && supabase) {
      const { data } = await supabase.from('files').select('*').eq('storage_key', fileId).limit(1);
      if (data && data[0]) fileRecord = data[0];
    }

    const storageKey = fileRecord?.storage_key || fileId;
    const fileName = fileRecord?.name || path.basename(storageKey);
    const mimeType = fileRecord?.mime_type || 'application/pdf';

    await streamR2Object(storageKey, fileName, mimeType, 'inline', res);
  } catch (error: any) {
    console.error('Erro ao visualizar arquivo:', error);
    res.status(500).json({ error: 'Erro ao visualizar arquivo', details: error.message });
  }
});

// 4.2 Route to Download file by ID or StorageKey (Streams directly from Cloudflare R2)
app.get('/api/files/:id/download', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.id;
    const supabase = getSupabaseServerClient();
    let fileRecord: any = null;

    if (supabase && isValidUuid(fileId)) {
      const { data } = await supabase.from('files').select('*').eq('id', fileId).single();
      fileRecord = data;
    }

    if (!fileRecord && supabase) {
      const { data } = await supabase.from('files').select('*').eq('storage_key', fileId).limit(1);
      if (data && data[0]) fileRecord = data[0];
    }

    const storageKey = fileRecord?.storage_key || fileId;
    const fileName = fileRecord?.name || path.basename(storageKey);
    const mimeType = fileRecord?.mime_type || 'application/octet-stream';

    await streamR2Object(storageKey, fileName, mimeType, 'attachment', res);
  } catch (error: any) {
    console.error('Erro ao baixar arquivo:', error);
    res.status(500).json({ error: 'Erro ao baixar arquivo', details: error.message });
  }
});

// 4.3 General R2 Download Endpoint (Streams directly from Cloudflare R2 by key query param)
app.get('/api/r2/download', async (req: Request, res: Response) => {
  try {
    const storageKey = req.query.key as string;
    const fileName = (req.query.name as string) || path.basename(storageKey || 'download');
    if (!storageKey) return res.status(400).json({ error: 'Parâmetro key é obrigatório' });

    const mime = detectMimeType(fileName || storageKey);
    await streamR2Object(storageKey, fileName, mime, 'attachment', res);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao transferir arquivo', details: error.message });
  }
});

// 4.4 General R2 View Endpoint (Streams directly from Cloudflare R2 inline with proper MIME)
app.get('/api/r2/view', async (req: Request, res: Response) => {
  try {
    const storageKey = req.query.key as string;
    const fileName = (req.query.name as string) || path.basename(storageKey || 'document');
    if (!storageKey) return res.status(400).json({ error: 'Parâmetro key é obrigatório' });

    const mime = detectMimeType(fileName || storageKey);
    await streamR2Object(storageKey, fileName, mime, 'inline', res);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao visualizar arquivo', details: error.message });
  }
});

// 4.5 Standard Multipart Upload Endpoint using Multer MemoryStorage
// Streams IMMEDIATELY to Cloudflare R2 via PutObjectCommand and registers in Supabase files table
// NEVER saves files into local folders (./uploads, ./public/uploads, /tmp)
app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado no campo file (multipart/form-data)' });
    }

    const { folder_id, sector, uploaded_by, pages_count, tags, due_date } = req.body;
    const file = req.file;
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeSector = (sector || 'Geral').toLowerCase().replace(/\s+/g, '-');
    const storageKey = `sectors/${safeSector}/${folder_id || 'root'}/${Date.now()}-${cleanFileName}`;

    const { client, bucketName, isConfigured } = getR2Client();

    if (!isConfigured || !client) {
      return res.status(500).json({
        error: 'Cloudflare R2 não está configurado no servidor.',
        details: 'Verifique as variáveis R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME.',
      });
    }

    // Envia o buffer IMEDIATAMENTE para o Cloudflare R2
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'client-name': 'MVRJCONTABIL-GED',
        'uploaded-by': String(uploaded_by || 'admin'),
        'original-name': encodeURIComponent(file.originalname),
        'uploaded-at': new Date().toISOString(),
      },
    });

    await client.send(putCommand);
    console.log(`[Cloudflare R2 Multipart] Enviado com sucesso: ${storageKey} (${file.size} bytes) no bucket ${bucketName}`);

    // Armazena no cache local também para preview ultra-rápido instantâneo
    inMemoryFileStore.set(storageKey, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      name: file.originalname,
    });

    // Registra o metadado na tabela files do Supabase para persistir o histórico para sempre
    const supabase = getSupabaseServerClient();
    let insertedDoc: any = null;

    if (supabase) {
      let resolvedFolderId = folder_id;
      if (!isValidUuid(resolvedFolderId)) {
        const { data: allFolders } = await supabase.from('folders').select('id, sector, name');
        const matched = (allFolders || []).find(f => 
          f.sector === sector || 
          f.name.toLowerCase().includes(String(sector || '').toLowerCase())
        );
        resolvedFolderId = matched?.id || allFolders?.[0]?.id;
      }

      let resolvedUploaderId = isValidUuid(uploaded_by) ? uploaded_by : null;
      if (!resolvedUploaderId) {
        const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
        if (adminProfiles && adminProfiles[0]) {
          resolvedUploaderId = adminProfiles[0].id;
        }
      }

      const parsedTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? JSON.parse(tags || '[]') : []);

      const uploadPayload: any = {
        folder_id: resolvedFolderId,
        name: file.originalname,
        storage_key: storageKey,
        mime_type: file.mimetype,
        original_size: file.size,
        optimized_size: file.size,
        compression_ratio: 0,
        pages_count: Number(pages_count) || 1,
        tags: parsedTags,
        uploaded_by: resolvedUploaderId,
        updated_at: new Date().toISOString(),
      };
      if (due_date) {
        uploadPayload.due_date = due_date;
      }

      const { data: dbData, error: dbError } = await supabase
        .from('files')
        .insert(uploadPayload)
        .select('*, folders(name, sector)');

      if (!dbError && dbData && dbData[0]) {
        insertedDoc = dbData[0];
        try {
          await supabase.from('audit_logs').insert({
            action: 'FILE_UPLOAD',
            target_type: 'FILE',
            target_id: insertedDoc.id,
            profile_id: resolvedUploaderId,
            user_name: 'Evandro (Administrador)',
            sector: sector || 'Fiscal',
            details: {
              name: file.originalname,
              storage_key: storageKey,
              size: file.size,
              r2_bucket: bucketName,
              due_date: due_date || insertedDoc.due_date,
            },
          });
        } catch {}
      }
    }

    const docId = insertedDoc?.id || `r2-${Date.now()}`;
    return res.status(201).json({
      status: 'success',
      file: {
        id: docId,
        name: file.originalname,
        storage_key: storageKey,
        mime_type: file.mimetype,
        original_size: file.size,
        optimized_size: file.size,
        compression_ratio: 0,
        pages_count: Number(pages_count) || 1,
        folder_id: insertedDoc?.folder_id || folder_id,
        sector: sector || 'Fiscal',
        uploaded_by: insertedDoc?.uploaded_by || uploaded_by,
        due_date: due_date || insertedDoc?.due_date || undefined,
        created_at: insertedDoc?.created_at || new Date().toISOString(),
        preview_url: `/api/files/${docId}/view`,
        download_url: `/api/files/${docId}/download`,
      },
      storageKey,
      uploadedToR2: true,
      bucket: bucketName,
      message: 'Arquivo enviado e salvo permanentemente no Cloudflare R2',
    });
  } catch (error: any) {
    console.error('Erro no upload multipart:', error);
    res.status(500).json({ error: 'Falha ao processar upload para o Cloudflare R2', details: error.message });
  }
});

// 5. Direct Resilient Upload Endpoint (Uploads directly to Cloudflare R2 from buffer, never saving to local disk)
app.post('/api/r2/upload-direct', express.raw({ type: '*/*', limit: '100mb' }), async (req: Request, res: Response) => {
  try {
    // Validação estrita de Quota de Armazenamento R2
    const quotaCheck = isStorageQuotaExceeded();
    if (quotaCheck.exceeded) {
      return res.status(403).json({
        error: 'Limite de armazenamento Cloudflare R2 atingido. Upload bloqueado.',
        code: 'STORAGE_QUOTA_EXCEEDED',
        supportContact: '21973960077',
        message: 'O limite de capacidade do sistema foi atingido. Entre em contato com o suporte de TI (21) 97396-0077.',
      });
    }

    const storageKey = (req.headers['x-storage-key'] as string) || `uploads/${Date.now()}-doc`;
    const mimeType = (req.headers['x-mime-type'] as string) || (req.headers['content-type'] as string) || 'application/octet-stream';
    const rawFileName = req.headers['x-file-name'] as string;
    const fileName = rawFileName ? decodeURIComponent(rawFileName) : path.basename(storageKey);

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      buffer = Buffer.from(req.body, 'utf-8');
    } else if (req.body instanceof Uint8Array) {
      buffer = Buffer.from(req.body);
    } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      buffer = Buffer.from(JSON.stringify(req.body));
    } else {
      buffer = Buffer.alloc(0);
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Conteúdo do arquivo está vazio' });
    }

    // Armazena no cache em memória para preview ultra-rápido instantâneo
    inMemoryFileStore.set(storageKey, {
      buffer,
      mimeType,
      name: fileName,
    });

    const { client, bucketName, isConfigured } = getR2Client();
    let uploadedToR2 = false;
    let r2Message = '';

    if (isConfigured && client) {
      try {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
          Metadata: {
            'client-name': 'MVRJCONTABIL-GED',
            'uploaded-at': new Date().toISOString(),
          },
        });

        await client.send(command);
        uploadedToR2 = true;
        r2Message = `Enviado com sucesso para o Cloudflare R2 bucket: ${bucketName}`;
        console.log(`[R2 Direct Upload] Sucesso: ${storageKey} no bucket ${bucketName}`);
      } catch (err: any) {
        console.error(`[R2 Direct Upload Erro] Falha ao enviar para R2: ${err.message}`, err);
        return res.status(500).json({
          error: 'Falha ao salvar arquivo no Cloudflare R2',
          details: err.message,
        });
      }
    } else {
      return res.status(500).json({
        error: 'Cloudflare R2 não está configurado.',
        details: 'Defina as variáveis R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME.',
      });
    }

    return res.status(200).json({
      status: 'success',
      storageKey,
      bytes: buffer.length,
      uploadedToR2,
      provider: 'Cloudflare R2 (S3 API)',
      bucket: bucketName,
      message: r2Message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro no upload direto:', error);
    res.status(500).json({ error: 'Falha interna durante o envio do arquivo', details: error.message });
  }
});

// 6. Mock Upload Endpoint (Handles direct PUT in local sandbox mode)
app.put('/api/r2/mock-upload/:key(*)', express.raw({ type: '*/*', limit: '50mb' }), (req: Request, res: Response) => {
  const key = req.params.key;
  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

  inMemoryFileStore.set(key, {
    buffer,
    mimeType,
    name: path.basename(key),
  });

  res.status(200).json({
    status: 'uploaded',
    key,
    bytes: buffer.length,
    timestamp: new Date().toISOString(),
  });
});

// 6. Mock Download Endpoint (Serves cached binary file)
app.get('/api/r2/mock-download/:key(*)', (req: Request, res: Response) => {
  const key = req.params.key;
  const stored = inMemoryFileStore.get(key);

  if (!stored) {
    // If not found in memory, generate a placeholder PDF stream
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(Buffer.from('%PDF-1.4\n% MVRJCONTÁBIL Document\n'));
  }

  res.setHeader('Content-Type', stored.mimeType);
  res.setHeader('Content-Length', stored.buffer.length);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(stored.name)}"`);
  res.send(stored.buffer);
});

// 7. Avatar Upload Endpoint (Cloudflare R2 storage key: avatars/{userId}.webp)
app.post('/api/r2/avatar/:userId', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const userId = rawUserId.replace(/\.webp$/i, '');
    const storageKey = `avatars/${userId}.webp`;
    const userEmail = (req.headers['x-user-email'] as string) || '';

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      buffer = Buffer.from(req.body, 'utf-8');
    } else if (req.body instanceof Uint8Array) {
      buffer = Buffer.from(req.body);
    } else {
      buffer = Buffer.alloc(0);
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Nenhum dado de imagem recebido' });
    }

    // Cache no inMemoryFileStore para exibição instantânea
    inMemoryFileStore.set(storageKey, {
      buffer,
      mimeType: 'image/webp',
      name: `${userId}.webp`,
    });

    // Salvar também em cache em disco local para persistência permanente entre reinicializações
    try {
      const avatarDiskPath = path.join(process.cwd(), 'storage', 'avatars', `${userId}.webp`);
      const dir = path.dirname(avatarDiskPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(avatarDiskPath, buffer);
    } catch (diskErr: any) {
      console.warn('[Avatar Disk Cache Aviso]', diskErr.message);
    }

    const { client, bucketName, isConfigured } = getR2Client();
    let uploadedToR2 = false;

    if (isConfigured && client) {
      try {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          Body: buffer,
          ContentType: 'image/webp',
          Metadata: {
            'user-id': userId,
            'uploaded-at': new Date().toISOString(),
          },
        });
        await client.send(command);
        uploadedToR2 = true;
        console.log(`[R2 Avatar Upload] Sucesso para chave: ${storageKey} no bucket ${bucketName}`);
      } catch (err: any) {
        console.warn(`[R2 Avatar Upload Aviso] Falha ao enviar para R2 (${err.message}). Salvo no cache.`, err);
      }
    }

    // URL pública do avatar (com cache-buster timestamp para recarregar no navegador)
    const avatarUrl = `/api/r2/avatar/${userId}.webp?t=${Date.now()}`;

    // Sincronizar com persistedProfiles em memória, disco e R2
    try {
      const targetIdx = persistedProfiles.findIndex(
        p => p.id === userId || (userEmail && p.email && p.email.toLowerCase() === userEmail.toLowerCase())
      );
      if (targetIdx !== -1) {
        persistedProfiles[targetIdx].avatar_url = avatarUrl;
        persistedProfiles[targetIdx].updated_at = new Date().toISOString();
      } else if (userEmail) {
        persistedProfiles.push({
          id: userId,
          email: userEmail.toLowerCase(),
          full_name: 'Usuário',
          sector: 'Diretoria',
          role: 'editor',
          status: 'approved',
          avatar_url: avatarUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      savePersistedProfiles();
      saveR2Profiles(persistedProfiles).catch(() => {});
    } catch (profErr: any) {
      console.warn('[Avatar Profiles Sync Aviso]', profErr.message);
    }

    // Sincronizar com a tabela public.profiles no Supabase
    const supabase = getSupabaseServerClient();
    let updatedSupabase = false;
    if (supabase) {
      try {
        // Tenta atualizar pelo ID
        const { error, data } = await supabase
          .from('profiles')
          .update({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select();

        if (!error && data && data.length > 0) {
          updatedSupabase = true;
        } else if (userEmail) {
          // Se o id não for o UUID do Supabase, tenta encontrar e atualizar pelo email
          const emailRes = await supabase
            .from('profiles')
            .update({
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('email', userEmail)
            .select();
          if (!emailRes.error && emailRes.data && emailRes.data.length > 0) {
            updatedSupabase = true;
          }
        }
      } catch (sbErr: any) {
        console.warn('[Supabase Avatar Update Aviso]', sbErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      storageKey,
      avatarUrl,
      uploadedToR2,
      updatedSupabase,
      size: buffer.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro no upload de avatar:', error);
    res.status(500).json({ error: 'Falha interna ao processar foto de perfil', details: error.message });
  }
});

// 8. Avatar Serve/Download Endpoint (Serves optimized WebP from Cache, Disk, or R2)
app.get('/api/r2/avatar/:userId', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const userId = rawUserId.replace(/\.webp$/i, '');
    const storageKey = `avatars/${userId}.webp`;

    // 1. Verificar cache local em memória primeiro
    const cached = inMemoryFileStore.get(storageKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', cached.buffer.length);
      return res.send(cached.buffer);
    }

    // 2. Verificar cache permanente em disco local
    const avatarDiskPath = path.join(process.cwd(), 'storage', 'avatars', `${userId}.webp`);
    if (fs.existsSync(avatarDiskPath)) {
      try {
        const diskBuf = fs.readFileSync(avatarDiskPath);
        inMemoryFileStore.set(storageKey, {
          buffer: diskBuf,
          mimeType: 'image/webp',
          name: `${userId}.webp`,
        });
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', diskBuf.length);
        return res.send(diskBuf);
      } catch (e) {}
    }

    // 3. Se não estiver em cache local, buscar no Cloudflare R2
    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        });
        const r2Response = await client.send(command);

        if (r2Response.Body) {
          const chunks: Buffer[] = [];
          for await (const chunk of r2Response.Body as any) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          // Salvar em cache em memória e em disco para requisições subsequentes
          inMemoryFileStore.set(storageKey, {
            buffer,
            mimeType: 'image/webp',
            name: `${userId}.webp`,
          });
          try {
            const dir = path.dirname(avatarDiskPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(avatarDiskPath, buffer);
          } catch (e) {}

          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      } catch (s3Err: any) {
        return res.status(404).json({ error: 'Avatar não encontrado no R2' });
      }
    }

    return res.status(404).json({ error: 'Avatar não encontrado' });
  } catch (error: any) {
    console.error('Erro ao servir avatar:', error);
    res.status(500).json({ error: 'Erro ao carregar avatar', details: error.message });
  }
});

// 9. Avatar Deletion Endpoint (Removes from R2, Disk, Cache and clears avatar_url)
app.delete('/api/r2/avatar/:userId', async (req: Request, res: Response) => {
  try {
    const rawUserId = req.params.userId;
    const userId = rawUserId.replace(/\.webp$/i, '');
    const storageKey = `avatars/${userId}.webp`;
    const userEmail = (req.query.email || req.headers['x-user-email']) as string;

    // 1. Remover do cache local em memória e em disco
    inMemoryFileStore.delete(storageKey);
    try {
      const avatarDiskPath = path.join(process.cwd(), 'storage', 'avatars', `${userId}.webp`);
      if (fs.existsSync(avatarDiskPath)) fs.unlinkSync(avatarDiskPath);
    } catch (e) {}

    // 2. Excluir do Cloudflare R2
    const { client, bucketName, isConfigured } = getR2Client();
    let deletedFromR2 = false;

    if (isConfigured && client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        });
        await client.send(command);
        deletedFromR2 = true;
        console.log(`[R2 Avatar Delete] Excluído com sucesso: ${storageKey}`);
      } catch (r2Err: any) {
        console.warn('[R2 Avatar Delete Aviso]', r2Err.message);
      }
    }

    // 3. Atualizar persistedProfiles
    try {
      const targetIdx = persistedProfiles.findIndex(
        p => p.id === userId || (userEmail && p.email && p.email.toLowerCase() === userEmail.toLowerCase())
      );
      if (targetIdx !== -1) {
        persistedProfiles[targetIdx].avatar_url = undefined;
        persistedProfiles[targetIdx].updated_at = new Date().toISOString();
        savePersistedProfiles();
        saveR2Profiles(persistedProfiles).catch(() => {});
      }
    } catch (e) {}

    // 4. Atualizar no Supabase (definir avatar_url = null)
    const supabase = getSupabaseServerClient();
    let updatedSupabase = false;
    if (supabase) {
      try {
        const { error, data } = await supabase
          .from('profiles')
          .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select();

        if (!error && data && data.length > 0) {
          updatedSupabase = true;
        } else if (userEmail) {
          const emailRes = await supabase
            .from('profiles')
            .update({
              avatar_url: null,
              updated_at: new Date().toISOString(),
            })
            .eq('email', userEmail)
            .select();
          if (!emailRes.error && emailRes.data && emailRes.data.length > 0) {
            updatedSupabase = true;
          }
        }
      } catch (sbErr: any) {
        console.warn('[Supabase Avatar Delete Aviso]', sbErr.message);
      }
    }

    return res.status(200).json({
      status: 'success',
      storageKey,
      deletedFromR2,
      updatedSupabase,
      avatarUrl: null,
      message: 'Foto de perfil removida com sucesso do Cloudflare R2 e Supabase',
    });
  } catch (error: any) {
    console.error('Erro ao excluir avatar:', error);
    res.status(500).json({ error: 'Falha ao remover avatar', details: error.message });
  }
});

// ==============================================================================
// 10. PROFILES MANAGEMENT (Supabase + Local Disk Persistence)
// ==============================================================================
const PROFILES_FILE = path.join(process.cwd(), 'storage', 'profiles.json');

interface StoredProfile {
  id: string;
  email: string;
  full_name: string;
  sector: string;
  role: 'admin' | 'editor' | 'viewer' | 'User';
  status: 'pending' | 'active' | 'approved' | 'blocked' | 'rejected';
  avatar_url?: string | null;
  first_access_completed?: boolean;
  lgpd_accepted_at?: string | null;
  password_changed_at?: string | null;
  lgpd_terms_version?: string | null;
  created_at: string;
  updated_at: string;
}

let persistedProfiles: StoredProfile[] = [
  {
    id: '57e1d483-669b-4791-b09e-7496570e63ea',
    email: 'evandro230655@gmail.com',
    full_name: 'Evandro (Administrador)',
    sector: 'Diretoria',
    role: 'admin',
    status: 'active',
    avatar_url: '/api/r2/avatar/57e1d483-669b-4791-b09e-7496570e63ea.webp?t=1789404217549',
    created_at: '2026-09-14T16:21:34.630637+00:00',
    updated_at: '2026-09-14T16:43:39.722+00:00',
  }
];

function loadPersistedProfiles() {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        persistedProfiles = data;
        console.log(`[Profiles] ${persistedProfiles.length} perfis carregados do disco com sucesso`);
      }
    } else {
      savePersistedProfiles();
    }
  } catch (e) {
    console.warn('[Profiles] Aviso ao ler perfis do disco:', e);
  }
}

function savePersistedProfiles() {
  try {
    const dir = path.dirname(PROFILES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(persistedProfiles, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Profiles] Erro ao persistir perfis em disco:', e);
  }
}

loadPersistedProfiles();

// Cloudflare R2 Persistent Key for Profiles
const R2_PROFILES_KEY = 'system/profiles.json';

async function fetchR2Profiles(): Promise<StoredProfile[]> {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return [];
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: R2_PROFILES_KEY,
    }));
    if (res.Body) {
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    // Arquivo ainda não existe no R2
  }
  return [];
}

async function saveR2Profiles(profiles: StoredProfile[]) {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: R2_PROFILES_KEY,
      Body: Buffer.from(JSON.stringify(profiles, null, 2), 'utf-8'),
      ContentType: 'application/json',
      Metadata: {
        'system-sync': 'profiles',
        'updated-at': new Date().toISOString(),
      },
    }));
  } catch (err: any) {
    console.warn('[R2 Profiles Save Aviso]', err.message);
  }
}

// Cache in-memory for unified profiles to make GET /api/profiles respond in <1ms
let cachedUnifiedProfiles: StoredProfile[] | null = null;
let lastUnifiedProfilesFetchTime = 0;
const PROFILES_CACHE_TTL_MS = 6000; // 6 seconds cache

function invalidateProfilesCache() {
  cachedUnifiedProfiles = null;
  lastUnifiedProfilesFetchTime = 0;
}

// Reconstruct and unify profiles from R2, Supabase profiles, and Supabase audit_logs
async function getAllUnifiedProfiles(forceRefresh = false): Promise<StoredProfile[]> {
  const now = Date.now();
  if (!forceRefresh && cachedUnifiedProfiles && (now - lastUnifiedProfilesFetchTime < PROFILES_CACHE_TTL_MS)) {
    return cachedUnifiedProfiles;
  }

  const supabase = getSupabaseServerClient();
  const profilesMap = new Map<string, StoredProfile>();
  const masterAdminEmail = 'evandro230655@gmail.com';

  // 1. Carregar perfis do Cloudflare R2
  const r2Profiles = await fetchR2Profiles();
  for (const p of r2Profiles) {
    if (p && p.email) {
      profilesMap.set(p.email.toLowerCase().trim(), p);
    }
  }

  // 2. Carregar perfis locais do arquivo storage/profiles.json
  for (const p of persistedProfiles) {
    if (p && p.email && !profilesMap.has(p.email.toLowerCase().trim())) {
      profilesMap.set(p.email.toLowerCase().trim(), p);
    }
  }

  // 3. Carregar da tabela profiles do Supabase
  if (supabase) {
    try {
      const { data: dbProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, sector, role, status, avatar_url, first_access_completed, created_at, updated_at')
        .order('created_at', { ascending: true });
      if (Array.isArray(dbProfiles)) {
        for (const p of dbProfiles) {
          const emailKey = p.email?.toLowerCase().trim();
          if (emailKey) {
            const existing = profilesMap.get(emailKey);
            profilesMap.set(emailKey, {
              ...existing,
              ...p,
              avatar_url: p.avatar_url || existing?.avatar_url || (existing as any)?.avatarUrl || (p.id ? `/api/r2/avatar/${p.id}.webp` : undefined),
              status: p.status || existing?.status || 'pending',
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[Supabase Profiles Sync Aviso]', err.message);
    }

    // 4. Reconstrução precisa a partir de audit_logs (CONSULTA ÚNICA E OTIMIZADA)
    try {
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('id, action, target_id, user_name, sector, details, created_at')
        .in('action', ['ACCESS_REQUEST', 'USER_APPROVED', 'USER_DELETED', 'USER_REJECTED'])
        .order('created_at', { ascending: true });

      if (Array.isArray(auditLogs)) {
        const lastDeletedTimeByEmail = new Map<string, number>();
        const lastDeletedTimeById = new Map<string, number>();
        const lastApprovedTimeByEmail = new Map<string, number>();
        const lastApprovedTimeById = new Map<string, number>();
        const approvedRolesByEmail = new Map<string, string>();
        const approvedSectorsByEmail = new Map<string, string>();

        for (const log of auditLogs) {
          const logTime = new Date(log.created_at || 0).getTime();
          if (log.action === 'USER_REJECTED' || log.action === 'USER_DELETED') {
            const delId = String(log.target_id || '').toLowerCase().trim();
            const delEmail = (log.details?.deleted_email || log.details?.rejected_email || '').toLowerCase().trim();
            if (delId) lastDeletedTimeById.set(delId, Math.max(logTime, lastDeletedTimeById.get(delId) || 0));
            if (delEmail) lastDeletedTimeByEmail.set(delEmail, Math.max(logTime, lastDeletedTimeByEmail.get(delEmail) || 0));
          } else if (log.action === 'USER_APPROVED') {
            const appEmail = (log.details?.approved_email || log.details?.email || '').toLowerCase().trim();
            const appId = String(log.target_id || log.details?.user_id || '').toLowerCase().trim();
            if (appEmail) {
              lastApprovedTimeByEmail.set(appEmail, Math.max(logTime, lastApprovedTimeByEmail.get(appEmail) || 0));
              if (log.details?.role) approvedRolesByEmail.set(appEmail, log.details.role);
              if (log.details?.sector) approvedSectorsByEmail.set(appEmail, log.details.sector);
            }
            if (appId) {
              lastApprovedTimeById.set(appId, Math.max(logTime, lastApprovedTimeById.get(appId) || 0));
            }
          }
        }

        // Processar ACCESS_REQUEST
        for (const log of auditLogs) {
          if (log.action === 'ACCESS_REQUEST') {
            const email = (log.details?.email || '').toLowerCase().trim();
            const id = String(log.target_id || log.details?.user_id || '').toLowerCase().trim();
            if (!email || email === masterAdminEmail) continue;

            const logTime = new Date(log.created_at || 0).getTime();
            const delTime = Math.max(lastDeletedTimeByEmail.get(email) || 0, id ? (lastDeletedTimeById.get(id) || 0) : 0);
            
            // Se foi excluído APÓS a solicitação, não restaurar
            if (delTime > logTime) {
              continue;
            }

            const appTime = Math.max(lastApprovedTimeByEmail.get(email) || 0, id ? (lastApprovedTimeById.get(id) || 0) : 0);
            // REGRA FUNDAMENTAL: O usuário SÓ é aprovado se o admin aprovou DEPOIS da solicitação!
            const isApproved = appTime > logTime;

            const existing = profilesMap.get(email);
            if (!existing) {
              profilesMap.set(email, {
                id: id || `usr-${Date.now()}`,
                email,
                full_name: log.details?.name || log.user_name || email.split('@')[0],
                sector: approvedSectorsByEmail.get(email) || log.details?.sector || 'Fiscal',
                role: (approvedRolesByEmail.get(email) as any) || 'viewer',
                status: isApproved ? 'approved' : 'pending',
                created_at: log.created_at,
                updated_at: log.created_at,
              });
            } else {
              // Se o perfil existe, assegurar status de acordo com aprovação explícita
              if (email !== masterAdminEmail) {
                if (isApproved) {
                  existing.status = existing.status === 'active' ? 'active' : 'approved';
                  if (approvedRolesByEmail.has(email)) existing.role = approvedRolesByEmail.get(email) as any;
                } else {
                  existing.status = 'pending';
                }
              }
            }
          }
        }

        // Limpeza de perfis excluídos
        for (const [key, p] of Array.from(profilesMap.entries())) {
          if (p.email.toLowerCase() === masterAdminEmail) continue;
          const pEmail = p.email.toLowerCase().trim();
          const pId = p.id?.toLowerCase().trim();
          const delTime = Math.max(
            lastDeletedTimeByEmail.get(pEmail) || 0,
            pId ? (lastDeletedTimeById.get(pId) || 0) : 0
          );
          const pTime = new Date(p.created_at || p.updated_at || 0).getTime();
          if (delTime > 0 && delTime >= pTime) {
            profilesMap.delete(key);
          }
        }
      }
    } catch (auditErr: any) {
      console.warn('[Audit Logs Sync Aviso]', auditErr.message);
    }
  }

  // Assegurar Administrador Master (Evandro)
  if (profilesMap.has(masterAdminEmail)) {
    const admin = profilesMap.get(masterAdminEmail)!;
    admin.role = 'admin';
    admin.status = 'active';
  } else {
    profilesMap.set(masterAdminEmail, {
      id: '57e1d483-669b-4791-b09e-7496570e63ea',
      email: masterAdminEmail,
      full_name: 'Evandro (Administrador)',
      sector: 'Diretoria',
      role: 'admin',
      status: 'active',
      avatar_url: '/api/r2/avatar/57e1d483-669b-4791-b09e-7496570e63ea.webp?t=1789404217549',
      created_at: '2026-09-14T16:21:34.630637+00:00',
      updated_at: new Date().toISOString(),
    });
  }

  const result = Array.from(profilesMap.values());
  persistedProfiles = result;
  cachedUnifiedProfiles = result;
  lastUnifiedProfilesFetchTime = Date.now();

  return result;
}

// 10a. Create Profile / Access Request (POST /api/profiles)
app.post('/api/profiles', async (req: Request, res: Response) => {
  try {
    const { id, email, full_name, sector, role, status, avatar_url } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail corporativo é obrigatório' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingIndex = persistedProfiles.findIndex(p => p.email.toLowerCase() === cleanEmail);
    const resolvedId = (id && isValidUuid(id)) 
      ? id 
      : (existingIndex >= 0 && isValidUuid(persistedProfiles[existingIndex].id) 
          ? persistedProfiles[existingIndex].id 
          : crypto.randomUUID());

    const newProfile: StoredProfile = {
      id: resolvedId,
      email: cleanEmail,
      full_name: full_name?.trim() || email.split('@')[0],
      sector: sector || 'Fiscal',
      role: (role === 'User' || role === 'viewer') ? 'viewer' : (role || 'viewer'),
      status: status || 'pending',
      avatar_url: avatar_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      persistedProfiles[existingIndex] = { ...persistedProfiles[existingIndex], ...newProfile, updated_at: new Date().toISOString() };
    } else {
      persistedProfiles = [newProfile, ...persistedProfiles];
    }
    savePersistedProfiles();
    saveR2Profiles(persistedProfiles).catch(() => {});

    // Registra persistentemente no Supabase
    const supabase = getSupabaseServerClient();
    if (supabase) {
      // 0. Remove histórico de exclusão/rejeição prévia para permitir reingresso
      try {
        await supabase
          .from('audit_logs')
          .delete()
          .in('action', ['USER_REJECTED', 'USER_DELETED'])
          .or(`details->>deleted_email.ilike.${cleanEmail},details->>rejected_email.ilike.${cleanEmail}`);
      } catch (cleanErr: any) {
        console.warn('[Audit Log Cleanup on Re-request]', cleanErr.message);
      }

      // 1. Grava no audit_logs para recuperação definitiva
      try {
        await supabase.from('audit_logs').insert({
          action: 'ACCESS_REQUEST',
          target_type: 'USER',
          target_id: newProfile.id,
          user_name: newProfile.full_name,
          sector: newProfile.sector,
          details: {
            email: newProfile.email,
            name: newProfile.full_name,
            sector: newProfile.sector,
            role: newProfile.role,
            status: newProfile.status,
          },
        });
      } catch (logErr: any) {
        console.warn('[Audit Log Access Request Aviso]', logErr.message);
      }

      // 2. Tenta inserir na tabela profiles
      try {
        await supabase.from('profiles').upsert({
          id: newProfile.id,
          email: newProfile.email,
          full_name: newProfile.full_name,
          sector: newProfile.sector,
          role: newProfile.role === 'User' ? 'viewer' : newProfile.role,
          status: newProfile.status,
          avatar_url: newProfile.avatar_url,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
      } catch (dbErr: any) {
        console.warn('[Supabase Profiles] Erro não impeditivo ao gravar no Supabase:', dbErr.message);
      }
    }

    invalidateProfilesCache();

    return res.status(201).json({ status: 'success', profile: newProfile });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao cadastrar perfil', details: error.message });
  }
});

// 10b. Update Profile metadata (PUT /api/profiles/:userId)
app.put('/api/profiles/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { 
      full_name, 
      avatar_url, 
      email,
      sector,
      role,
      status,
      first_access_completed,
      lgpd_accepted_at,
      password_changed_at,
      lgpd_terms_version 
    } = req.body;

    const normalizedRole = role === 'User' ? 'viewer' : role;
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    // Atualiza armazenamento em memória e disco
    const idx = persistedProfiles.findIndex(p => p.id === userId || (cleanEmail && p.email.toLowerCase() === cleanEmail));
    if (idx >= 0) {
      if (full_name !== undefined) persistedProfiles[idx].full_name = full_name;
      if (avatar_url !== undefined) persistedProfiles[idx].avatar_url = avatar_url;
      if (sector !== undefined) persistedProfiles[idx].sector = sector;
      if (normalizedRole !== undefined) persistedProfiles[idx].role = normalizedRole;
      if (status !== undefined) persistedProfiles[idx].status = status;
      if (first_access_completed !== undefined) persistedProfiles[idx].first_access_completed = first_access_completed;
      if (lgpd_accepted_at !== undefined) persistedProfiles[idx].lgpd_accepted_at = lgpd_accepted_at;
      if (password_changed_at !== undefined) persistedProfiles[idx].password_changed_at = password_changed_at;
      if (lgpd_terms_version !== undefined) persistedProfiles[idx].lgpd_terms_version = lgpd_terms_version;
      persistedProfiles[idx].updated_at = new Date().toISOString();
    } else {
      const newProfile: StoredProfile = {
        id: userId,
        email: cleanEmail || '',
        full_name: full_name || (cleanEmail ? cleanEmail.split('@')[0] : 'Usuário'),
        sector: sector || 'Fiscal',
        role: normalizedRole || 'viewer',
        status: status || 'approved',
        avatar_url: avatar_url || null,
        first_access_completed: first_access_completed || false,
        lgpd_accepted_at: lgpd_accepted_at || null,
        password_changed_at: password_changed_at || null,
        lgpd_terms_version: lgpd_terms_version || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      persistedProfiles.push(newProfile);
    }
    savePersistedProfiles();
    saveR2Profiles(persistedProfiles).catch(() => {});
    invalidateProfilesCache();

    // Registra aprovação em audit_logs caso tenha sido aprovado
    const targetEmail = cleanEmail || (idx >= 0 ? persistedProfiles[idx].email : '');
    const supabase = getSupabaseServerClient();
    let updatedSupabaseProfile: any = null;

    if (supabase) {
      if (status === 'approved') {
        try {
          await supabase.from('audit_logs').insert({
            action: 'USER_APPROVED',
            target_type: 'USER',
            target_id: userId,
            user_name: 'Evandro (Administrador)',
            sector: sector || 'Diretoria',
            details: {
              approved_email: targetEmail,
              email: targetEmail,
              user_id: userId,
              role: normalizedRole || 'viewer',
              sector,
              approved_at: new Date().toISOString(),
            },
          });
        } catch (auditErr: any) {
          console.warn('[Audit Log User Approved Aviso]', auditErr.message);
        }
      }

      try {
        const payload: any = { 
          id: userId,
          email: targetEmail,
          full_name: full_name || (idx >= 0 ? persistedProfiles[idx]?.full_name : targetEmail.split('@')[0]),
          sector: sector || 'Fiscal',
          role: normalizedRole || 'viewer',
          status: status || 'approved',
          updated_at: new Date().toISOString() 
        };
        if (avatar_url !== undefined) payload.avatar_url = avatar_url;
        if (first_access_completed !== undefined) payload.first_access_completed = first_access_completed;
        if (lgpd_accepted_at !== undefined) payload.lgpd_accepted_at = lgpd_accepted_at;
        if (password_changed_at !== undefined) payload.password_changed_at = password_changed_at;
        if (lgpd_terms_version !== undefined) payload.lgpd_terms_version = lgpd_terms_version;

        let { data } = await supabase
          .from('profiles')
          .upsert(payload, { onConflict: 'email' })
          .select();

        if (data && data[0]) updatedSupabaseProfile = data[0];
      } catch (err: any) {
        console.warn('[Supabase Profiles] Erro na sincronização:', err.message);
      }
    }

    const finalProfile = updatedSupabaseProfile || (idx >= 0 ? persistedProfiles[idx] : null);
    return res.status(200).json({ status: 'success', profile: finalProfile });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao atualizar perfil', details: error.message });
  }
});

// 10c. Delete Profile (DELETE /api/profiles/:userId)
app.delete('/api/profiles/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const email = (req.query.email as string)?.trim().toLowerCase();

    // Localiza email antes de remover para logar e sincronizar
    const foundProfile = persistedProfiles.find(p => p.id === userId || (email && p.email.toLowerCase() === email));
    const targetEmail = email || foundProfile?.email || '';

    // Remove da memória e disco local
    persistedProfiles = persistedProfiles.filter(p => p.id !== userId && (!targetEmail || p.email.toLowerCase() !== targetEmail));
    savePersistedProfiles();
    await saveR2Profiles(persistedProfiles).catch(() => {});
    invalidateProfilesCache();

    // Deleta do Supabase e registra no audit_logs
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.from('audit_logs').insert({
          action: 'USER_DELETED',
          target_type: 'USER',
          target_id: userId,
          user_name: 'Administrador MVRJ',
          sector: 'Diretoria',
          details: {
            deleted_email: targetEmail,
            rejected_email: targetEmail,
            user_id: userId,
            deleted_at: new Date().toISOString(),
          },
        });
      } catch (auditErr: any) {
        console.warn('[Audit Log User Delete Aviso]', auditErr.message);
      }

      try {
        // Exclui permissões de pastas vinculadas ao usuário
        await supabase.from('folder_permissions').delete().eq('user_id', userId);
        if (targetEmail) {
          await supabase.from('folder_permissions').delete().eq('profile_id', userId);
        }
      } catch (permErr: any) {
        console.warn('[Folder Permissions Delete Aviso]', permErr.message);
      }

      try {
        let { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (targetEmail) {
          await supabase.from('profiles').delete().eq('email', targetEmail);
        }

        // Limpa registros anteriores de ACCESS_REQUEST do mesmo email no audit_logs para permitir nova solicitação limpa
        if (targetEmail) {
          await supabase.from('audit_logs').delete().eq('action', 'ACCESS_REQUEST').ilike('details->>email', targetEmail);
        }

        if (isValidUuid(userId)) {
          try {
            await supabase.auth.admin.deleteUser(userId);
          } catch (authErr) {
            // Silencioso se não houver auth.users
          }
        }
      } catch (dbErr: any) {
        console.warn('[Supabase Profiles] Erro ao excluir no banco:', dbErr.message);
      }
    }

    return res.status(200).json({ status: 'success', message: 'Perfil excluído com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir perfil', details: error.message });
  }
});

// 11. Fetch Profiles Unified (Supabase + Cloudflare R2 + Audit Logs Reconstructed)
app.get('/api/profiles', async (req: Request, res: Response) => {
  try {
    const unifiedList = await getAllUnifiedProfiles();
    return res.status(200).json({ profiles: unifiedList, source: 'unified' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao listar perfis', details: error.message });
  }
});

// Helper for UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(id: any): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// ==============================================================================
// 12. SYSTEM STATUS (Supabase + Cloudflare R2 Diagnostic)
// ==============================================================================
app.get('/api/system/status', async (req: Request, res: Response) => {
  const supabase = getSupabaseServerClient();
  const { client: r2Client, bucketName, isConfigured: r2Configured } = getR2Client();

  let supabaseStatus = {
    connected: false,
    url: process.env.SUPABASE_URL || 'Não configurado',
    filesCount: 0,
    foldersCount: 0,
    profilesCount: 0,
    auditLogsCount: 0,
    error: null as string | null,
  };

  if (supabase) {
    try {
      const [filesRes, foldersRes, profilesRes, auditRes] = await Promise.all([
        supabase.from('files').select('id', { count: 'exact', head: true }),
        supabase.from('folders').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      ]);
      supabaseStatus.connected = !filesRes.error && !foldersRes.error;
      supabaseStatus.filesCount = filesRes.count || 0;
      supabaseStatus.foldersCount = foldersRes.count || 0;
      supabaseStatus.profilesCount = profilesRes.count || 0;
      supabaseStatus.auditLogsCount = auditRes.count || 0;
      if (filesRes.error) supabaseStatus.error = filesRes.error.message;
    } catch (e: any) {
      supabaseStatus.error = e.message;
    }
  }

  let r2Status = {
    connected: false,
    bucket: bucketName,
    configured: r2Configured,
    objectsCount: 0,
    totalBytes: 0,
    error: null as string | null,
  };

  if (r2Configured && r2Client) {
    try {
      const r2Res = await r2Client.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1000 }));
      r2Status.connected = true;
      r2Status.objectsCount = r2Res.KeyCount || r2Res.Contents?.length || 0;
      r2Status.totalBytes = (r2Res.Contents || []).reduce((acc, obj) => acc + (obj.Size || 0), 0);
    } catch (e: any) {
      r2Status.error = e.message;
    }
  }

  res.json({
    supabase: supabaseStatus,
    r2: r2Status,
    timestamp: new Date().toISOString(),
  });
});

// ==============================================================================
// 12.5 FOLDERS & FILES PERSISTENCE (Supabase + Local Disk + Cloudflare R2)
// ==============================================================================
const FOLDERS_FILE = path.join(process.cwd(), 'storage', 'folders.json');
const FILES_FILE = path.join(process.cwd(), 'storage', 'files.json');
const DELETED_FILES_FILE = path.join(process.cwd(), 'storage', 'deleted_files.json');
const R2_FOLDERS_KEY = 'system/folders.json';
const R2_FILES_KEY = 'system/files.json';
const R2_DELETED_FILES_KEY = 'system/deleted_files.json';

interface StoredFolder {
  id: string;
  parent_id: string | null;
  name: string;
  sector: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface StoredFile {
  id: string;
  folder_id: string;
  name: string;
  storage_key: string;
  mime_type: string;
  original_size: number;
  optimized_size: number;
  compression_ratio: number;
  pages_count?: number;
  tags: string[];
  uploaded_by: string;
  uploader_name?: string;
  sector: string;
  checksum_sha256?: string;
  due_date?: string;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
  preview_url?: string;
}

let persistedFolders: StoredFolder[] = [];
let foldersLoaded = false;
let persistedFiles: StoredFile[] = [];
let filesLoaded = false;
let persistedDeletedFileIds: Set<string> = new Set();
let deletedFilesLoaded = false;

function loadDeletedFiles() {
  if (deletedFilesLoaded) return;
  try {
    if (fs.existsSync(DELETED_FILES_FILE)) {
      const raw = fs.readFileSync(DELETED_FILES_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        persistedDeletedFileIds = new Set(data);
        deletedFilesLoaded = true;
        return;
      }
    }
    deletedFilesLoaded = true;
  } catch (e) {
    console.warn('[DeletedFiles] Aviso ao ler do disco:', e);
  }
}

function saveDeletedFiles() {
  try {
    const dir = path.dirname(DELETED_FILES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DELETED_FILES_FILE, JSON.stringify(Array.from(persistedDeletedFileIds), null, 2), 'utf-8');
    saveR2DeletedFiles().catch(() => {});
  } catch (e) {
    console.error('[DeletedFiles] Erro ao persistir em disco:', e);
  }
}

async function fetchR2DeletedFiles(): Promise<string[]> {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return [];
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: R2_DELETED_FILES_KEY,
    }));
    if (res.Body) {
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

async function saveR2DeletedFiles() {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: R2_DELETED_FILES_KEY,
      Body: Buffer.from(JSON.stringify(Array.from(persistedDeletedFileIds)), 'utf-8'),
      ContentType: 'application/json',
    }));
  } catch (err: any) {}
}

function toDeterministicUuid(id: string): string {
  if (isValidUuid(id)) return id;
  const hash = crypto.createHash('md5').update(String(id)).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

function loadPersistedFolders() {
  if (foldersLoaded) return;
  try {
    if (fs.existsSync(FOLDERS_FILE)) {
      const raw = fs.readFileSync(FOLDERS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        persistedFolders = data;
        foldersLoaded = true;
        console.log(`[Folders] ${persistedFolders.length} pastas carregadas do disco com sucesso`);
        return;
      }
    }
    foldersLoaded = true; // Mesmo se não existir, marcamos como carregado (vazio)
  } catch (e) {
    console.warn('[Folders] Aviso ao ler pastas do disco:', e);
  }
}

function savePersistedFolders() {
  try {
    const dir = path.dirname(FOLDERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FOLDERS_FILE, JSON.stringify(persistedFolders, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Folders] Erro ao persistir pastas em disco:', e);
  }
}

function loadPersistedFiles() {
  if (filesLoaded) return;
  try {
    if (fs.existsSync(FILES_FILE)) {
      const raw = fs.readFileSync(FILES_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        persistedFiles = data;
        filesLoaded = true;
        console.log(`[Files] ${persistedFiles.length} arquivos carregados do disco com sucesso`);
        return;
      }
    }
    filesLoaded = true;
  } catch (e) {
    console.warn('[Files] Aviso ao ler arquivos do disco:', e);
  }
}

function savePersistedFiles() {
  try {
    const dir = path.dirname(FILES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FILES_FILE, JSON.stringify(persistedFiles, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Files] Erro ao persistir arquivos em disco:', e);
  }
}

loadPersistedFolders();
loadPersistedFiles();

async function fetchR2Folders(): Promise<StoredFolder[]> {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return [];
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: R2_FOLDERS_KEY,
    }));
    if (res.Body) {
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {}
  return [];
}

async function saveR2Folders(foldersList: StoredFolder[]) {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: R2_FOLDERS_KEY,
      Body: Buffer.from(JSON.stringify(foldersList, null, 2), 'utf-8'),
      ContentType: 'application/json',
      Metadata: {
        'system-sync': 'folders',
        'updated-at': new Date().toISOString(),
      },
    }));
  } catch (err: any) {
    console.warn('[R2 Folders Save Aviso]', err.message);
  }
}

async function fetchR2Files(): Promise<StoredFile[]> {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return [];
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: R2_FILES_KEY,
    }));
    if (res.Body) {
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {}
  return [];
}

async function saveR2Files(filesList: StoredFile[]) {
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: R2_FILES_KEY,
      Body: Buffer.from(JSON.stringify(filesList, null, 2), 'utf-8'),
      ContentType: 'application/json',
      Metadata: {
        'system-sync': 'files',
        'updated-at': new Date().toISOString(),
      },
    }));
  } catch (err: any) {
    console.warn('[R2 Files Save Aviso]', err.message);
  }
}

async function getAllUnifiedFolders(): Promise<StoredFolder[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data: dbFolders, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(dbFolders)) {
        console.log(`[FOLDERS SYNC] Supabase retornou ${dbFolders.length} pastas.`);
        const mapped: StoredFolder[] = dbFolders.map((df: any) => ({
          id: df.id,
          parent_id: df.parent_id || null,
          name: df.name,
          sector: df.sector || 'Geral',
          created_by: df.created_by || null,
          created_at: df.created_at,
          updated_at: df.updated_at || df.created_at,
        }));
        persistedFolders = mapped;
        savePersistedFolders();
        saveR2Folders(mapped).catch(() => {});
        return mapped;
      } else if (error) {
        console.error('[FOLDERS SYNC] Erro ao buscar pastas no Supabase:', error.message);
      }
    } catch (sbErr: any) {
      console.error('[PASTAS] Exceção Sync Supabase:', sbErr.message);
    }
  }

  loadPersistedFolders();
  return persistedFolders;
}

async function getAllUnifiedFiles(): Promise<StoredFile[]> {
  const filesMap = new Map<string, StoredFile>();
  
  // 1. Carrega lista de exclusões persistentes (Tombstones)
  loadDeletedFiles();
  if (persistedDeletedFileIds.size === 0) {
    try {
      const r2Deleted = await fetchR2DeletedFiles();
      for (const dId of r2Deleted) {
        if (dId) persistedDeletedFileIds.add(dId);
      }
    } catch (e) {}
  }

  // 2. Carrega do armazenamento persistente em disco
  loadPersistedFiles();
  for (const f of persistedFiles) {
    if (f && f.id && !persistedDeletedFileIds.has(f.id) && !persistedDeletedFileIds.has(f.storage_key) && !persistedDeletedFileIds.has(toDeterministicUuid(f.id))) {
      filesMap.set(f.id, f);
    }
  }

  // 3. Se local estiver vazio, restaura a partir do Cloudflare R2
  if (filesMap.size === 0) {
    try {
      const r2Files = await fetchR2Files();
      for (const rf of r2Files) {
        if (rf && rf.id && !persistedDeletedFileIds.has(rf.id) && !persistedDeletedFileIds.has(rf.storage_key) && !persistedDeletedFileIds.has(toDeterministicUuid(rf.id))) {
          filesMap.set(rf.id, rf);
        }
      }
    } catch (e) {}
  }

  // 4. Sincroniza e consolida com Supabase de forma segura (respeitando exclusões reais!)
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data: dbFiles, error } = await supabase
        .from('files')
        .select('*, folders(name, sector), profiles:uploaded_by(full_name, email)')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(dbFiles)) {
        // Atualiza ou insere dados autoritativos vindos do Supabase
        for (const f of dbFiles) {
          const isDeleted = persistedDeletedFileIds.has(f.id) || 
                            (f.storage_key && persistedDeletedFileIds.has(f.storage_key)) ||
                            persistedDeletedFileIds.has(toDeterministicUuid(f.id));

          if (isDeleted) {
            // Se foi excluído, remove também do Supabase caso ainda esteja lá
            try {
              await supabase.from('files').delete().eq('id', f.id);
            } catch {}
            continue;
          }

          const folder = f.folders as any;
          const profile = f.profiles as any;
          const resolvedSector = folder?.sector || persistedFolders.find(pf => pf.id === f.folder_id)?.sector || f.sector || 'Fiscal';
          const resolvedUploaderName = profile?.full_name || f.uploader_name || 'Evandro (Administrador)';

          filesMap.set(f.id, {
            id: f.id,
            folder_id: f.folder_id,
            name: f.name,
            storage_key: f.storage_key,
            mime_type: f.mime_type,
            original_size: Number(f.original_size) || 0,
            optimized_size: Number(f.optimized_size) || 0,
            compression_ratio: Number(f.compression_ratio) || 0,
            pages_count: f.pages_count || 1,
            tags: Array.isArray(f.tags) ? f.tags : [],
            uploaded_by: f.uploaded_by || '57e1d483-669b-4791-b09e-7496570e63ea',
            uploader_name: resolvedUploaderName,
            sector: resolvedSector,
            checksum_sha256: f.checksum_sha256,
            due_date: f.due_date || undefined,
            is_archived: f.is_archived || false,
            created_at: f.created_at,
            updated_at: f.updated_at,
            preview_url: `/api/r2/view?key=${encodeURIComponent(f.storage_key)}&name=${encodeURIComponent(f.name)}`,
          });
        }

        // Para arquivos locais que não estão no Supabase:
        const dbFileIds = new Set(dbFiles.map(df => df.id));
        for (const [id, localFile] of Array.from(filesMap.entries())) {
          if (!dbFileIds.has(id)) {
            const ageMs = Date.now() - new Date(localFile.created_at).getTime();
            // Apenas sincroniza se for upload recente (< 60s) e não excluído
            if (ageMs < 60000 && !persistedDeletedFileIds.has(localFile.id)) {
              try {
                let resFolderId = localFile.folder_id;
                if (!isValidUuid(resFolderId)) {
                  resFolderId = toDeterministicUuid(localFile.folder_id || 'fold-fisc-root');
                }
                
                const { data: fCheck } = await supabase.from('folders').select('id').eq('id', resFolderId).maybeSingle();
                if (!fCheck) {
                  await supabase.from('folders').upsert({
                    id: resFolderId,
                    name: localFile.sector || 'Geral',
                    sector: localFile.sector || 'Fiscal',
                    created_at: new Date().toISOString(),
                  });
                }

                let uploaderUuid: string | null = null;
                if (isValidUuid(localFile.uploaded_by)) {
                  const { data: pCheck } = await supabase.from('profiles').select('id').eq('id', localFile.uploaded_by).maybeSingle();
                  if (pCheck) uploaderUuid = pCheck.id;
                }

                await supabase.from('files').upsert({
                  id: localFile.id,
                  folder_id: resFolderId,
                  name: localFile.name,
                  storage_key: localFile.storage_key,
                  mime_type: localFile.mime_type,
                  original_size: localFile.original_size,
                  optimized_size: localFile.optimized_size,
                  compression_ratio: localFile.compression_ratio,
                  pages_count: localFile.pages_count,
                  tags: localFile.tags,
                  uploaded_by: uploaderUuid,
                  checksum_sha256: localFile.checksum_sha256 || null,
                  due_date: localFile.due_date || null,
                  created_at: localFile.created_at,
                  updated_at: localFile.updated_at,
                });
              } catch (syncSingleErr) {
                console.warn('[Sync Local File to DB Error]', localFile.name, syncSingleErr);
              }
            } else if (ageMs >= 60000) {
              // Se o arquivo era antigo e não está mais no Supabase, significa que foi apagado
              filesMap.delete(id);
              persistedDeletedFileIds.add(id);
              if (localFile.storage_key) persistedDeletedFileIds.add(localFile.storage_key);
            }
          }
        }
      } else if (error) {
        console.error('[FILES SYNC] Erro ao buscar arquivos no Supabase:', error.message);
      }
    } catch (err: any) {
      console.warn('[ARQUIVOS] Aviso Sync Supabase:', err.message);
    }
  }

  const result = Array.from(filesMap.values()).filter(f => 
    !persistedDeletedFileIds.has(f.id) && 
    !persistedDeletedFileIds.has(f.storage_key) && 
    !persistedDeletedFileIds.has(toDeterministicUuid(f.id))
  );
  persistedFiles = result;
  savePersistedFiles();
  saveDeletedFiles();
  saveR2Files(result).catch(() => {});
  return result;
}

// ==============================================================================
// 13. FOLDERS CRUD ENDPOINTS (Unified Persistence: Disk + Memory + R2 + Supabase)
// ==============================================================================
app.get('/api/folders', async (req: Request, res: Response) => {
  try {
    const folders = await getAllUnifiedFolders();
    res.json({ folders, source: 'unified', count: folders.length });
  } catch (err: any) {
    res.json({ folders: persistedFolders, source: 'fallback' });
  }
});

app.post('/api/folders', async (req: Request, res: Response) => {
  try {
    console.log('[API FOLDERS] Payload recebido:', req.body);
    const { name, parent_id, sector, created_by, id: customId } = req.body;
    if (!name || !sector) {
      console.error('[API FOLDERS] Erro: Nome e setor são obrigatórios');
      return res.status(400).json({ error: 'Nome e setor são obrigatórios' });
    }

    const folderId = customId || crypto.randomUUID();
    const cleanName = String(name).trim();

    const validSectors = ['Fiscal', 'Departamento Pessoal', 'Contábil', 'Diretoria', 'Financeiro', 'Geral'];
    const finalSector = validSectors.includes(sector) ? sector : 'Geral';

    const newFolder: StoredFolder = {
      id: folderId,
      parent_id: parent_id || null,
      name: cleanName,
      sector: finalSector,
      created_by: isValidUuid(created_by) ? created_by : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Sync to Supabase if connected
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        let createdByUuid: string | null = null;
        if (isValidUuid(created_by)) {
          // Check if profile exists to prevent foreign key violation on profiles(id)
          const { data: profile } = await supabase.from('profiles').select('id').eq('id', created_by).maybeSingle();
          if (profile) {
            createdByUuid = profile.id;
          }
        }

        const payload: any = {
          id: toDeterministicUuid(folderId),
          name: cleanName,
          sector: finalSector,
          parent_id: newFolder.parent_id ? toDeterministicUuid(newFolder.parent_id) : null,
          created_by: createdByUuid,
          updated_at: newFolder.updated_at,
        };

        const { data, error } = await supabase.from('folders').upsert(payload).select();
        console.log('[API FOLDERS] Resposta Supabase:', { data, error });

        if (error) {
          console.error('[API FOLDERS] Erro ao gravar pasta no Supabase:', error.message);
          return res.status(500).json({ error: error.message });
        }

        console.log('[PASTAS] Ação: CREATE, ID:', folderId, 'Resultado: SUCESSO no Supabase');

        // Audit log in Supabase
        try {
          await supabase.from('audit_logs').insert({
            action: 'FOLDER_CREATE',
            target_type: 'FOLDER',
            target_id: folderId,
            user_name: 'Sistema',
            sector: finalSector,
            details: {
              folder_id: folderId,
              name: cleanName,
              parent_id: newFolder.parent_id,
              sector: finalSector,
            },
          });
        } catch {}
      } catch (sbErr: any) {
        console.error('[API FOLDERS] Exceção Sync Supabase:', sbErr.message);
        return res.status(500).json({ error: sbErr.message });
      }
    }

    // 2. Immediately save to in-memory store and disk
    const existingIdx = persistedFolders.findIndex(f => f.id === folderId);
    if (existingIdx >= 0) {
      persistedFolders[existingIdx] = newFolder;
    } else {
      persistedFolders.push(newFolder);
    }
    savePersistedFolders();

    // 3. Backup to R2
    saveR2Folders(persistedFolders).catch(() => {});

    return res.status(201).json({ status: 'success', folder: newFolder });
  } catch (err: any) {
    console.error('[PASTAS] Ação: CREATE, ID: N/A, Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', async (req: Request, res: Response) => {
  const folderId = req.params.id;
  const supabase = getSupabaseServerClient();
  const { client, bucketName, isConfigured } = getR2Client();

  try {
    loadDeletedFiles();
    const uuidId = toDeterministicUuid(folderId);

    // 1. Identifica e marca todos os arquivos desta pasta como excluídos (Tombstone)
    const filesToDelete = persistedFiles.filter(f => f.folder_id === folderId || toDeterministicUuid(f.folder_id) === uuidId);
    for (const f of filesToDelete) {
      persistedDeletedFileIds.add(f.id);
      if (f.storage_key) persistedDeletedFileIds.add(f.storage_key);
      persistedDeletedFileIds.add(toDeterministicUuid(f.id));
    }
    saveDeletedFiles();

    // 2. Remove from in-memory and disk
    persistedFolders = persistedFolders.filter(f => f.id !== folderId && f.parent_id !== folderId && f.id !== uuidId);
    savePersistedFolders();
    saveR2Folders(persistedFolders).catch(() => {});

    // 3. Also remove associated files in disk store
    persistedFiles = persistedFiles.filter(f => f.folder_id !== folderId && toDeterministicUuid(f.folder_id) !== uuidId);
    savePersistedFiles();
    saveR2Files(persistedFiles).catch(() => {});

    // 4. Remove files from R2 and Supabase
    if (supabase) {
      // Delete files in Supabase first
      await supabase
        .from('files')
        .delete()
        .or(`folder_id.eq.${folderId},folder_id.eq.${uuidId}`);

      // Delete folders in Supabase
      await supabase
        .from('folders')
        .delete()
        .or(`id.eq.${folderId},id.eq.${uuidId},parent_id.eq.${folderId},parent_id.eq.${uuidId}`);
    }

    // Handle R2 files
    if (isConfigured && client) {
      for (const f of filesToDelete) {
        if (f.storage_key) {
          try {
            await client.send(new DeleteObjectCommand({
              Bucket: bucketName,
              Key: f.storage_key,
            }));
            inMemoryFileStore.delete(f.storage_key);
          } catch (delObjErr: any) {}
        }
      }
    }

    res.json({ status: 'success', message: 'Pasta e conteúdos removidos com sucesso' });
  } catch (err: any) {
    console.error('[PASTAS] Ação: DELETE, ID:', folderId, 'Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 14. FILES CRUD ENDPOINTS (Unified Persistence: Disk + Memory + R2 + Supabase)
// ==============================================================================
app.get('/api/files', async (req: Request, res: Response) => {
  try {
    const files = await getAllUnifiedFiles();
    res.json({ files, source: 'unified', count: files.length });
  } catch (err: any) {
    res.json({ files: persistedFiles, source: 'fallback', count: persistedFiles.length });
  }
});

app.post('/api/files', async (req: Request, res: Response) => {
  try {
    const {
      folder_id,
      name,
      storage_key,
      mime_type,
      original_size,
      optimized_size,
      compression_ratio,
      pages_count,
      tags,
      uploaded_by,
      checksum_sha256,
      due_date,
      sector,
    } = req.body;

    if (!name || !storage_key) {
      return res.status(400).json({ error: 'Campos name e storage_key são obrigatórios' });
    }

    const fileId = crypto.randomUUID();
    const resolvedUploaderName = req.body.uploader_name || 'Evandro (Administrador)';
    const newFile: StoredFile = {
      id: fileId,
      folder_id: folder_id || 'fold-fisc-root',
      name: name.trim(),
      storage_key,
      mime_type: mime_type || 'application/pdf',
      original_size: Number(original_size) || 0,
      optimized_size: Number(optimized_size) || 0,
      compression_ratio: Number(compression_ratio) || 0,
      pages_count: Number(pages_count) || 1,
      tags: Array.isArray(tags) ? tags : [],
      uploaded_by: uploaded_by || '57e1d483-669b-4791-b09e-7496570e63ea',
      uploader_name: resolvedUploaderName,
      sector: sector || 'Fiscal',
      checksum_sha256: checksum_sha256 || undefined,
      due_date: due_date || undefined,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      preview_url: `/api/r2/view?key=${encodeURIComponent(storage_key)}&name=${encodeURIComponent(name)}`,
    };

    // 1. Immediately save to disk, memory and Cloudflare R2 backup
    persistedFiles.unshift(newFile);
    savePersistedFiles();
    saveR2Files(persistedFiles).catch(() => {});

    // 2. Sync to Supabase if connected
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        let resolvedFolderId = folder_id;
        if (!isValidUuid(resolvedFolderId)) {
          resolvedFolderId = toDeterministicUuid(folder_id || 'fold-fisc-root');
        }

        // Garante que a pasta existe no Supabase para não quebrar chave estrangeira
        const { data: fCheck } = await supabase.from('folders').select('id').eq('id', resolvedFolderId).maybeSingle();
        if (!fCheck) {
          const localFolder = persistedFolders.find(pf => pf.id === folder_id || toDeterministicUuid(pf.id) === resolvedFolderId);
          await supabase.from('folders').upsert({
            id: resolvedFolderId,
            name: localFolder?.name || sector || 'Pasta Geral',
            sector: localFolder?.sector || sector || 'Fiscal',
            created_at: new Date().toISOString(),
          });
        }

        let resolvedUploaderId = isValidUuid(uploaded_by) ? uploaded_by : null;
        if (resolvedUploaderId) {
          const { data: profCheck } = await supabase.from('profiles').select('id').eq('id', resolvedUploaderId).maybeSingle();
          if (!profCheck) resolvedUploaderId = null;
        }
        if (!resolvedUploaderId) {
          const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1);
          if (adminProfiles && adminProfiles[0]) {
            resolvedUploaderId = adminProfiles[0].id;
          }
        }

        const payload: any = {
          id: fileId,
          folder_id: resolvedFolderId,
          name: name.trim(),
          storage_key,
          mime_type: mime_type || 'application/pdf',
          original_size: Number(original_size) || 0,
          optimized_size: Number(optimized_size) || 0,
          compression_ratio: Number(compression_ratio) || 0,
          pages_count: Number(pages_count) || 1,
          tags: Array.isArray(tags) ? tags : [],
          uploaded_by: resolvedUploaderId,
          checksum_sha256: checksum_sha256 || null,
          updated_at: new Date().toISOString(),
        };

        if (due_date) payload.due_date = due_date;

        const { error: sbFileErr } = await supabase.from('files').upsert(payload);
        if (sbFileErr) {
          console.error('[Supabase File Sync Error]', sbFileErr.message);
        }

        await supabase.from('audit_logs').insert({
          action: 'FILE_UPLOAD',
          target_type: 'FILE',
          target_id: fileId,
          profile_id: resolvedUploaderId,
          user_name: resolvedUploaderName,
          sector: sector || 'Fiscal',
          details: {
            name: newFile.name,
            storage_key: newFile.storage_key,
            original_size: newFile.original_size,
            optimized_size: newFile.optimized_size,
            compression_ratio: `${newFile.compression_ratio}%`,
            due_date: due_date || newFile.due_date,
          },
        });
      } catch (sbErr: any) {
        console.warn('[Supabase File Sync Error]', sbErr.message);
      }
    }

    res.status(201).json({ status: 'success', file: newFile });
  } catch (err: any) {
    console.error('[POST /api/files] Erro:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:id', async (req: Request, res: Response) => {
  const fileId = req.params.id;
  try {
    loadDeletedFiles();
    const targetFile = persistedFiles.find(f => f.id === fileId || toDeterministicUuid(f.id) === fileId);
    const resolvedId = targetFile?.id || fileId;
    const uuidId = toDeterministicUuid(resolvedId);

    // 1. Registra no Tombstone de exclusão persistente
    persistedDeletedFileIds.add(fileId);
    persistedDeletedFileIds.add(resolvedId);
    persistedDeletedFileIds.add(uuidId);
    if (targetFile?.storage_key) {
      persistedDeletedFileIds.add(targetFile.storage_key);
    }
    saveDeletedFiles();

    // 2. Remove da memória e do disco local
    persistedFiles = persistedFiles.filter(f => 
      f.id !== fileId && 
      f.id !== resolvedId && 
      toDeterministicUuid(f.id) !== uuidId
    );
    savePersistedFiles();
    saveR2Files(persistedFiles).catch(() => {});

    // 3. Remove do R2
    if (targetFile?.storage_key) {
      const { client, bucketName, isConfigured } = getR2Client();
      if (isConfigured && client) {
        try {
          await client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: targetFile.storage_key,
          }));
          inMemoryFileStore.delete(targetFile.storage_key);
        } catch (r2Err) {}
      }
    }

    // 4. Remove do Supabase com todos os IDs possíveis
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase
          .from('files')
          .delete()
          .or(`id.eq.${fileId},id.eq.${resolvedId},id.eq.${uuidId}`);

        await supabase.from('audit_logs').insert({
          action: 'FILE_DELETE',
          target_type: 'FILE',
          target_id: fileId,
          user_name: 'Evandro (Administrador)',
          details: { name: targetFile?.name, storage_key: targetFile?.storage_key },
        });
      } catch (sbErr) {}
    }

    res.json({ status: 'success', message: 'Arquivo excluído permanentemente com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 15. AUDIT LOGS ENDPOINTS (Supabase Integrated)
// ==============================================================================
app.get('/api/audit-logs', async (req: Request, res: Response) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return res.json({ logs: [], source: 'empty' });

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.status(400).json({ error: error.message });

    const formattedLogs = (data || []).map(l => ({
      id: l.id,
      timestamp: l.created_at,
      user_id: l.profile_id || 'usr-admin-evandro',
      user_name: l.user_name || 'Evandro (Administrador)',
      sector: l.sector || 'Diretoria',
      action: l.action,
      target_type: l.target_type,
      target_id: l.target_id,
      ip_address: l.ip_address || '127.0.0.1',
      details: l.details || {},
    }));

    res.json({ logs: formattedLogs, source: 'supabase' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', async (req: Request, res: Response) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return res.json({ status: 'ignored' });

  try {
    const { action, target_type, target_id, details, profile_id, user_name, sector, ip_address } = req.body;
    const { data, error } = await supabase.from('audit_logs').insert({
      action,
      target_type,
      target_id,
      details: details || {},
      profile_id: isValidUuid(profile_id) ? profile_id : null,
      user_name: user_name || 'Evandro (Administrador)',
      sector: sector || 'Diretoria',
      ip_address: ip_address || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    }).select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ status: 'success', log: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 16. FOLDER PERMISSIONS ENDPOINTS
// ==============================================================================
app.get('/api/folder-permissions', async (req: Request, res: Response) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return res.json({ permissions: [], source: 'empty' });

  try {
    const { data, error } = await supabase.from('folder_permissions').select('*');
    if (error) return res.status(400).json({ error: error.message });
    res.json({ permissions: data || [], source: 'supabase' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folder-permissions', async (req: Request, res: Response) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return res.status(503).json({ error: 'Supabase não conectado' });

  try {
    const { folder_id, profile_id, permission_level } = req.body;
    if (!isValidUuid(folder_id) || !isValidUuid(profile_id)) {
      return res.status(400).json({ error: 'folder_id e profile_id devem ser UUIDs válidos' });
    }

    const { data, error } = await supabase
      .from('folder_permissions')
      .upsert({
        folder_id,
        profile_id,
        permission_level,
      }, { onConflict: 'folder_id,profile_id' })
      .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ status: 'success', permission: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 17. Real-Time Storage Metrics Endpoint (Used and Free Capacity)
// ==============================================================================
app.get('/api/storage/metrics', async (req: Request, res: Response) => {
  try {
    const { isConfigured, bucketName } = getR2Client();
    const totalCapacityBytes = process.env.R2_QUOTA_BYTES ? parseInt(process.env.R2_QUOTA_BYTES, 10) : 10 * 1024 * 1024 * 1024;

    let dbUsedBytes = 0;
    let dbFilesCount = 0;
    let dbOriginalBytes = 0;
    let sectorBreakdown: Record<string, { usedBytes: number; filesCount: number }> = {};

    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data: dbDocs, error: docError } = await supabase
        .from('files')
        .select('optimized_size, original_size, folders(sector)');
      
      if (!docError && dbDocs) {
        dbFilesCount = dbDocs.length;
        for (const doc of dbDocs) {
          const opt = Number(doc.optimized_size) || 0;
          const orig = Number(doc.original_size) || opt;
          dbUsedBytes += opt;
          dbOriginalBytes += orig;
          const s = (doc.folders as any)?.sector || 'Fiscal';
          if (!sectorBreakdown[s]) sectorBreakdown[s] = { usedBytes: 0, filesCount: 0 };
          sectorBreakdown[s].usedBytes += opt;
          sectorBreakdown[s].filesCount += 1;
        }
      }
    } else {
      // Fallback to in-memory only if no Supabase
      dbFilesCount = inMemoryFileStore.size;
      for (const item of inMemoryFileStore.values()) {
        dbUsedBytes += item.buffer.length;
      }
    }

    const effectiveUsedBytes = dbUsedBytes;
    const effectiveFilesCount = dbFilesCount;
    const freeBytes = Math.max(0, totalCapacityBytes - effectiveUsedBytes);
    const usedPercent = Math.min(100, Number(((effectiveUsedBytes / totalCapacityBytes) * 100).toFixed(2)));
    const freePercent = Math.max(0, Number((100 - usedPercent).toFixed(2)));

    const maxFilesCapacity = process.env.R2_MAX_FILES ? parseInt(process.env.R2_MAX_FILES, 10) : 10000;
    const remainingFilesCapacity = Math.max(0, maxFilesCapacity - effectiveFilesCount);

    return res.status(200).json({
      totalCapacityBytes,
      usedBytes: effectiveUsedBytes,
      freeBytes,
      usedPercent,
      freePercent,
      filesCount: effectiveFilesCount,
      maxFilesCapacity,
      remainingFilesCapacity,
      originalBytes: dbOriginalBytes,
      savedBytes: Math.max(0, dbOriginalBytes - effectiveUsedBytes),
      savingsPercent: dbOriginalBytes > 0 ? Math.round(((dbOriginalBytes - effectiveUsedBytes) / dbOriginalBytes) * 100) : 0,
      quotaTier: 'Plano Corporativo 10 GB (Cloudflare R2)',
      isConfigured,
      bucketName,
      bySector: sectorBreakdown,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro ao calcular métricas de armazenamento:', error);
    res.status(500).json({ error: 'Erro ao calcular métricas de armazenamento', details: error.message });
  }
});

// ==============================================================================
// 13. SITE BACKGROUND CUSTOMIZATION ENDPOINTS (Admin Only Control)
// ==============================================================================

interface ServerSiteBackgroundConfig {
  enabled: boolean;
  imageUrl: string;
  presetId?: string;
  opacity: number;
  blur: number;
  overlayType: 'light' | 'dark' | 'none';
  overlayOpacity: number;
  position: 'cover' | 'contain' | 'repeat' | 'center';
  updatedAt?: string;
  updatedBy?: string;
}

const SETTINGS_FILE = path.join(process.cwd(), 'storage', 'system_settings.json');
const ASSETS_DIR = path.join(process.cwd(), 'storage', 'assets');
const R2_SETTINGS_KEY = 'system/settings.json';

let siteBackgroundConfig: ServerSiteBackgroundConfig = {
  enabled: false,
  imageUrl: '',
  presetId: 'none',
  opacity: 25,
  blur: 0,
  overlayType: 'light',
  overlayOpacity: 40,
  position: 'cover',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema MVRJCONTÁBIL',
};

function loadPersistedSettings() {
  try {
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }
    const defaultLogoPath = path.join(ASSETS_DIR, 'company-logo.img');
    const defaultLogoMeta = path.join(ASSETS_DIR, 'company-logo.meta.json');
    if (!fs.existsSync(defaultLogoPath)) {
      const defaultLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b315e"/>
      <stop offset="100%" stop-color="#0d1b33"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d4af37"/>
      <stop offset="50%" stop-color="#f3e5ab"/>
      <stop offset="100%" stop-color="#aa7c11"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <g transform="translate(100, 70)">
    <path d="M50 200 L50 100 L120 60 L120 200 Z" fill="#ffffff" opacity="0.9"/>
    <path d="M135 200 L135 40 L205 20 L205 200 Z" fill="#ffffff"/>
    <path d="M220 200 L220 80 L290 100 L290 200 Z" fill="#ffffff" opacity="0.85"/>
    <path d="M 20 200 C 20 240, 320 240, 320 200 Z" fill="#e2e8f0" opacity="0.95"/>
    <path d="M 15 190 Q 160 20, 325 15" fill="none" stroke="url(#gold)" stroke-width="9" stroke-linecap="round"/>
    <polygon points="310,5 335,14 315,33" fill="url(#gold)"/>
  </g>
  <text x="250" y="340" font-family="Georgia, serif" font-size="32" font-weight="bold" fill="url(#gold)" text-anchor="middle" letter-spacing="3">MVRJ CONTÁBIL</text>
  <text x="250" y="380" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#cbd5e1" text-anchor="middle" letter-spacing="1">GESTÃO ELETRÔNICA DE DOCUMENTOS</text>
  <text x="250" y="415" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">E-MAIL: MVRJCONTABIL@GMAIL.COM</text>
  <text x="250" y="440" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">TEL: 21 97075-4216 / 99243-9469</text>
</svg>`;
      fs.writeFileSync(defaultLogoPath, defaultLogoSvg, 'utf-8');
      fs.writeFileSync(defaultLogoMeta, JSON.stringify({ mimeType: 'image/svg+xml' }), 'utf-8');
      if (authHeaderConfig.logoType === 'icon' || !authHeaderConfig.logoImageUrl) {
        authHeaderConfig.logoType = 'image';
        authHeaderConfig.logoImageUrl = '/api/r2/logo-image';
      }
    }

    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.siteBackgroundConfig) siteBackgroundConfig = { ...siteBackgroundConfig, ...data.siteBackgroundConfig };
      if (data.authHeaderConfig) authHeaderConfig = { ...authHeaderConfig, ...data.authHeaderConfig };
      console.log('[Settings] Configurações persistidas carregadas com sucesso do disco');
    }
  } catch (e) {
    console.warn('[Settings] Aviso ao ler configurações do disco:', e);
  }
}

function savePersistedSettings() {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ siteBackgroundConfig, authHeaderConfig }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Settings] Aviso ao salvar configurações no disco:', e);
  }
}

async function saveR2Settings() {
  savePersistedSettings();
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: R2_SETTINGS_KEY,
      Body: Buffer.from(JSON.stringify({ siteBackgroundConfig, authHeaderConfig }, null, 2), 'utf-8'),
      ContentType: 'application/json',
      Metadata: {
        'system-sync': 'settings',
        'updated-at': new Date().toISOString(),
      },
    }));
  } catch (err: any) {
    console.warn('[R2 Settings Save Aviso]', err.message);
  }
}

async function syncPersistedSettingsWithR2() {
  loadPersistedSettings();
  const { client, bucketName, isConfigured } = getR2Client();
  if (!isConfigured || !client) return;
  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: R2_SETTINGS_KEY,
    }));
    if (res.Body) {
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      if (parsed.siteBackgroundConfig) {
        siteBackgroundConfig = { ...siteBackgroundConfig, ...parsed.siteBackgroundConfig };
      }
      if (parsed.authHeaderConfig) {
        authHeaderConfig = { ...authHeaderConfig, ...parsed.authHeaderConfig };
      }
      savePersistedSettings();
      console.log('[Settings] Configurações sincronizadas do Cloudflare R2 com sucesso');
    }
  } catch (err) {
    // Arquivo não existe no R2 ou erro temporário
  }
}

// 13.1 Get current background config
app.get('/api/settings/background', async (req: Request, res: Response) => {
  await syncPersistedSettingsWithR2().catch(() => {});
  res.json(siteBackgroundConfig);
});

// 13.2 Update background configuration
app.post('/api/settings/background', async (req: Request, res: Response) => {
  try {
    const { enabled, imageUrl, presetId, opacity, blur, overlayType, overlayOpacity, position, updatedBy } = req.body;
    siteBackgroundConfig = {
      ...siteBackgroundConfig,
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(imageUrl !== undefined ? { imageUrl: String(imageUrl) } : {}),
      ...(presetId !== undefined ? { presetId: String(presetId) } : {}),
      ...(opacity !== undefined ? { opacity: Math.min(100, Math.max(5, Number(opacity))) } : {}),
      ...(blur !== undefined ? { blur: Math.min(30, Math.max(0, Number(blur))) } : {}),
      ...(overlayType !== undefined ? { overlayType } : {}),
      ...(overlayOpacity !== undefined ? { overlayOpacity: Math.min(100, Math.max(0, Number(overlayOpacity))) } : {}),
      ...(position !== undefined ? { position } : {}),
      updatedAt: new Date().toISOString(),
      ...(updatedBy ? { updatedBy: String(updatedBy) } : {}),
    };
    await saveR2Settings();
    return res.json({ status: 'success', config: siteBackgroundConfig });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao atualizar configurações de fundo', details: err.message });
  }
});

// 13.3 Upload custom background image directly to Cloudflare R2 / Server Cache / Disk
app.post('/api/r2/background-image', express.raw({ type: '*/*', limit: '25mb' }), async (req: Request, res: Response) => {
  try {
    const mimeType = (req.headers['content-type'] as string) || 'image/jpeg';
    const updatedBy = (req.headers['x-admin-user'] as string) || 'Administrador MVRJCONTÁBIL';

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      if (req.body.startsWith('data:image/')) {
        const base64Data = req.body.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(req.body);
      }
    } else if (req.body && typeof req.body === 'object') {
      if (req.body.dataUrl && typeof req.body.dataUrl === 'string') {
        const base64Data = req.body.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(JSON.stringify(req.body));
      }
    } else {
      buffer = Buffer.alloc(0);
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Nenhuma imagem recebida' });
    }

    const storageKey = 'system/site-background.img';
    const cleanMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    // 1. Armazenar em cache em memória
    inMemoryFileStore.set(storageKey, {
      buffer,
      mimeType: cleanMime,
      name: 'site-background.img',
    });

    // 2. Armazenar em cache em disco local permanente
    try {
      if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
      fs.writeFileSync(path.join(ASSETS_DIR, 'site-background.img'), buffer);
      fs.writeFileSync(path.join(ASSETS_DIR, 'site-background.meta.json'), JSON.stringify({ mimeType: cleanMime }));
    } catch (e: any) {
      console.warn('[Background Disk Cache Aviso]', e.message);
    }

    // 3. Upload para Cloudflare R2
    const { client, bucketName, isConfigured } = getR2Client();
    let uploadedToR2 = false;

    if (isConfigured && client) {
      try {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          Body: buffer,
          ContentType: cleanMime,
          Metadata: {
            'system-asset': 'site-background',
            'updated-by': updatedBy,
            'updated-at': new Date().toISOString(),
          },
        });
        await client.send(command);
        uploadedToR2 = true;
        console.log(`[R2 Background Image] Salvo com sucesso no bucket ${bucketName}`);
      } catch (r2Err: any) {
        console.warn('[R2 Background Image Aviso]', r2Err.message);
      }
    }

    const timestamp = Date.now();
    const publicUrl = `/api/r2/background-image?t=${timestamp}`;

    siteBackgroundConfig = {
      ...siteBackgroundConfig,
      enabled: true,
      imageUrl: publicUrl,
      presetId: 'custom_upload',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await saveR2Settings();

    return res.status(200).json({
      status: 'success',
      imageUrl: publicUrl,
      uploadedToR2,
      config: siteBackgroundConfig,
      message: 'Imagem de fundo salva com sucesso para todo o site',
    });
  } catch (error: any) {
    console.error('Erro ao enviar imagem de fundo:', error);
    res.status(500).json({ error: 'Erro ao processar imagem de fundo', details: error.message });
  }
});

// 13.4 Serve background image (Memory -> Disk -> R2)
app.get('/api/r2/background-image', async (req: Request, res: Response) => {
  try {
    const storageKey = 'system/site-background.img';

    // 1. Cache em memória
    const cached = inMemoryFileStore.get(storageKey);
    if (cached) {
      res.setHeader('Content-Type', cached.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', cached.buffer.length);
      return res.send(cached.buffer);
    }

    // 2. Cache em disco
    const diskPath = path.join(ASSETS_DIR, 'site-background.img');
    const metaPath = path.join(ASSETS_DIR, 'site-background.meta.json');
    if (fs.existsSync(diskPath)) {
      try {
        const diskBuf = fs.readFileSync(diskPath);
        let diskMime = 'image/jpeg';
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          if (meta.mimeType) diskMime = meta.mimeType;
        }
        inMemoryFileStore.set(storageKey, {
          buffer: diskBuf,
          mimeType: diskMime,
          name: 'site-background.img',
        });
        res.setHeader('Content-Type', diskMime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', diskBuf.length);
        return res.send(diskBuf);
      } catch (e) {}
    }

    // 3. Cloudflare R2
    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        });
        const r2Response = await client.send(command);
        if (r2Response.Body) {
          const chunks: Buffer[] = [];
          for await (const chunk of r2Response.Body as any) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);
          const mimeType = r2Response.ContentType || 'image/jpeg';
          inMemoryFileStore.set(storageKey, {
            buffer,
            mimeType,
            name: 'site-background.img',
          });
          try {
            if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
            fs.writeFileSync(diskPath, buffer);
            fs.writeFileSync(metaPath, JSON.stringify({ mimeType }));
          } catch (e) {}

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      } catch (r2Err: any) {
        // Objeto não encontrado no R2
      }
    }

    return res.status(404).json({ error: 'Nenhuma imagem de fundo encontrada' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao carregar imagem de fundo', details: error.message });
  }
});

// 13.5 Reset background to default
app.delete('/api/settings/background', async (req: Request, res: Response) => {
  try {
    const updatedBy = (req.headers['x-admin-user'] || req.query.admin) as string || 'Administrador MVRJCONTÁBIL';
    const storageKey = 'system/site-background.img';
    inMemoryFileStore.delete(storageKey);
    try {
      const diskPath = path.join(ASSETS_DIR, 'site-background.img');
      const metaPath = path.join(ASSETS_DIR, 'site-background.meta.json');
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch (e) {}

    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        await client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        }));
      } catch (e) {
        // Silêncio se não existir no bucket
      }
    }

    siteBackgroundConfig = {
      enabled: false,
      imageUrl: '',
      presetId: 'none',
      opacity: 25,
      blur: 0,
      overlayType: 'light',
      overlayOpacity: 40,
      position: 'cover',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await saveR2Settings();

    return res.json({
      status: 'success',
      config: siteBackgroundConfig,
      message: 'Fundo do site restaurado para o padrão corporativo neutro',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao redefinir fundo', details: err.message });
  }
});

// ==============================================================================
// 14. AUTH / LOGIN HEADER CUSTOMIZATION SETTINGS & R2 STORAGE
// ==============================================================================

interface ServerAuthHeaderConfig {
  title: string;
  subtitle: string;
  badgeText: string;
  showBadge: boolean;
  bgType: 'gradient' | 'image';
  gradientPreset: string;
  bgImageUrl?: string;
  bgOpacity: number;
  bgBlur: number;
  bgOverlayType: 'dark' | 'light' | 'none';
  bgOverlayOpacity: number;
  logoType: 'icon' | 'image';
  logoImageUrl?: string;
  iconName: 'FolderLock' | 'ShieldCheck' | 'Building2' | 'Landmark' | 'FileText' | 'Lock';
  updatedAt?: string;
  updatedBy?: string;
}

let authHeaderConfig: ServerAuthHeaderConfig = {
  title: 'MVRJ CONTÁBIL',
  subtitle: 'Gestão Eletrônica de Documentos Segura',
  badgeText: 'Supabase RLS & Cloudflare R2',
  showBadge: true,
  bgType: 'gradient',
  gradientPreset: 'slate-indigo-blue',
  bgImageUrl: '',
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

// Carregar configurações do disco logo na inicialização
loadPersistedSettings();

// 14.1 Get current auth header config
app.get('/api/settings/auth-header', async (req: Request, res: Response) => {
  await syncPersistedSettingsWithR2().catch(() => {});
  res.json(authHeaderConfig);
});

// 14.2 Update auth header configuration
app.post('/api/settings/auth-header', async (req: Request, res: Response) => {
  try {
    const {
      title,
      subtitle,
      badgeText,
      showBadge,
      showTitle,
      showSubtitle,
      showIcon,
      bgType,
      gradientPreset,
      bgImageUrl,
      bgSize,
      bgPosition,
      headerHeight,
      bgColor,
      bgOpacity,
      bgBlur,
      bgOverlayType,
      bgOverlayOpacity,
      logoType,
      logoImageUrl,
      iconName,
      updatedBy,
    } = req.body;

    authHeaderConfig = {
      ...authHeaderConfig,
      ...(title !== undefined ? { title: String(title).slice(0, 100) } : {}),
      ...(subtitle !== undefined ? { subtitle: String(subtitle).slice(0, 200) } : {}),
      ...(badgeText !== undefined ? { badgeText: String(badgeText).slice(0, 80) } : {}),
      ...(showBadge !== undefined ? { showBadge: Boolean(showBadge) } : {}),
      ...(showTitle !== undefined ? { showTitle: Boolean(showTitle) } : {}),
      ...(showSubtitle !== undefined ? { showSubtitle: Boolean(showSubtitle) } : {}),
      ...(showIcon !== undefined ? { showIcon: Boolean(showIcon) } : {}),
      ...(bgType !== undefined ? { bgType } : {}),
      ...(gradientPreset !== undefined ? { gradientPreset: String(gradientPreset) } : {}),
      ...(bgImageUrl !== undefined ? { bgImageUrl: String(bgImageUrl) } : {}),
      ...(bgSize !== undefined ? { bgSize } : {}),
      ...(bgPosition !== undefined ? { bgPosition } : {}),
      ...(headerHeight !== undefined ? { headerHeight } : {}),
      ...(bgColor !== undefined ? { bgColor: String(bgColor) } : {}),
      ...(bgOpacity !== undefined ? { bgOpacity: Math.min(100, Math.max(10, Number(bgOpacity))) } : {}),
      ...(bgBlur !== undefined ? { bgBlur: Math.min(20, Math.max(0, Number(bgBlur))) } : {}),
      ...(bgOverlayType !== undefined ? { bgOverlayType } : {}),
      ...(bgOverlayOpacity !== undefined ? { bgOverlayOpacity: Math.min(95, Math.max(0, Number(bgOverlayOpacity))) } : {}),
      ...(logoType !== undefined ? { logoType } : {}),
      ...(logoImageUrl !== undefined ? { logoImageUrl: String(logoImageUrl) } : {}),
      ...(iconName !== undefined ? { iconName } : {}),
      updatedAt: new Date().toISOString(),
      ...(updatedBy ? { updatedBy: String(updatedBy) } : {}),
    };

    await saveR2Settings();
    return res.json({ status: 'success', config: authHeaderConfig });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao atualizar cabeçalho de login', details: err.message });
  }
});

// 14.3 Upload custom header background image to R2 / memory cache
app.post('/api/r2/auth-header-image', express.raw({ type: '*/*', limit: '25mb' }), async (req: Request, res: Response) => {
  try {
    const mimeType = (req.headers['content-type'] as string) || 'image/jpeg';
    const updatedBy = (req.headers['x-admin-user'] as string) || 'Administrador MVRJCONTÁBIL';

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      if (req.body.startsWith('data:image/')) {
        const base64Data = req.body.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(req.body);
      }
    } else {
      buffer = Buffer.alloc(0);
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Nenhuma imagem recebida para o cabeçalho' });
    }

    const storageKey = 'system/auth-header.img';
    const cleanMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    inMemoryFileStore.set(storageKey, {
      buffer,
      mimeType: cleanMime,
      name: 'auth-header.img',
    });

    try {
      if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
      fs.writeFileSync(path.join(ASSETS_DIR, 'auth-header.img'), buffer);
      fs.writeFileSync(path.join(ASSETS_DIR, 'auth-header.meta.json'), JSON.stringify({ mimeType: cleanMime }));
    } catch (e: any) {
      console.warn('[Auth Header Disk Cache Aviso]', e.message);
    }

    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          Body: buffer,
          ContentType: cleanMime,
          Metadata: {
            'system-asset': 'auth-header',
            'uploaded-by': encodeURIComponent(updatedBy),
          },
        }));
      } catch (r2Err) {
        console.warn('R2 PutObject warning (fallback to inMemory):', r2Err);
      }
    }

    const dataUrl = `data:${cleanMime};base64,${buffer.toString('base64')}`;

    authHeaderConfig = {
      ...authHeaderConfig,
      bgType: 'image',
      bgImageUrl: dataUrl,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await saveR2Settings();

    return res.json({
      status: 'success',
      imageUrl: dataUrl,
      config: authHeaderConfig,
      message: 'Imagem do cabeçalho de login enviada com sucesso',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro no upload da imagem do cabeçalho', details: err.message });
  }
});

// 14.4 Serve auth header image (Memory -> Disk -> R2)
app.get('/api/r2/auth-header-image', async (req: Request, res: Response) => {
  try {
    const storageKey = 'system/auth-header.img';
    const cached = inMemoryFileStore.get(storageKey);
    if (cached) {
      res.setHeader('Content-Type', cached.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }

    const diskPath = path.join(ASSETS_DIR, 'auth-header.img');
    const metaPath = path.join(ASSETS_DIR, 'auth-header.meta.json');
    if (fs.existsSync(diskPath)) {
      try {
        const diskBuf = fs.readFileSync(diskPath);
        let diskMime = 'image/jpeg';
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          if (meta.mimeType) diskMime = meta.mimeType;
        }
        inMemoryFileStore.set(storageKey, {
          buffer: diskBuf,
          mimeType: diskMime,
          name: 'auth-header.img',
        });
        res.setHeader('Content-Type', diskMime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(diskBuf);
      } catch (e) {}
    }

    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        });
        const r2Res = await client.send(getCmd);
        if (r2Res.Body) {
          const streamToBuffer = async (stream: any): Promise<Buffer> => {
            const chunks: any[] = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
          };
          const buf = await streamToBuffer(r2Res.Body);
          const mimeType = r2Res.ContentType || 'image/jpeg';
          inMemoryFileStore.set(storageKey, {
            buffer: buf,
            mimeType,
            name: 'auth-header.img',
          });
          try {
            if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
            fs.writeFileSync(diskPath, buf);
            fs.writeFileSync(metaPath, JSON.stringify({ mimeType }));
          } catch (e) {}

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buf);
        }
      } catch (err) {
        // Not found
      }
    }

    return res.status(404).send('Header background image not found');
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao obter imagem do cabeçalho', details: err.message });
  }
});

// 14.5 Upload custom company logo to R2 / memory cache
app.post('/api/r2/logo-image', express.raw({ type: '*/*', limit: '10mb' }), async (req: Request, res: Response) => {
  try {
    const mimeType = (req.headers['content-type'] as string) || 'image/png';
    const updatedBy = (req.headers['x-admin-user'] as string) || 'Administrador MVRJCONTÁBIL';

    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      if (req.body.startsWith('data:image/')) {
        const base64Data = req.body.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(req.body);
      }
    } else {
      buffer = Buffer.alloc(0);
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo de logotipo recebido' });
    }

    const storageKey = 'system/company-logo.img';
    const cleanMime = mimeType.startsWith('image/') ? mimeType : 'image/png';

    inMemoryFileStore.set(storageKey, {
      buffer,
      mimeType: cleanMime,
      name: 'company-logo.img',
    });

    try {
      if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
      fs.writeFileSync(path.join(ASSETS_DIR, 'company-logo.img'), buffer);
      fs.writeFileSync(path.join(ASSETS_DIR, 'company-logo.meta.json'), JSON.stringify({ mimeType: cleanMime }));
    } catch (e: any) {
      console.warn('[Logo Disk Cache Aviso]', e.message);
    }

    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
          Body: buffer,
          ContentType: cleanMime,
          Metadata: {
            'system-asset': 'company-logo',
            'uploaded-by': encodeURIComponent(updatedBy),
          },
        }));
      } catch (r2Err) {
        console.warn('R2 PutObject warning logo:', r2Err);
      }
    }

    const logoDataUrl = `data:${cleanMime};base64,${buffer.toString('base64')}`;

    authHeaderConfig = {
      ...authHeaderConfig,
      logoType: 'image',
      logoImageUrl: logoDataUrl,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await saveR2Settings();

    return res.json({
      status: 'success',
      imageUrl: logoDataUrl,
      config: authHeaderConfig,
      message: 'Logotipo atualizado com sucesso',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro no upload do logotipo', details: err.message });
  }
});

// 14.6 Serve company logo (Memory -> Disk -> R2)
app.get('/api/r2/logo-image', async (req: Request, res: Response) => {
  try {
    const storageKey = 'system/company-logo.img';
    const cached = inMemoryFileStore.get(storageKey);
    if (cached) {
      res.setHeader('Content-Type', cached.mimeType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }

    const diskPath = path.join(ASSETS_DIR, 'company-logo.img');
    const metaPath = path.join(ASSETS_DIR, 'company-logo.meta.json');
    if (fs.existsSync(diskPath)) {
      try {
        const diskBuf = fs.readFileSync(diskPath);
        let diskMime = 'image/png';
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          if (meta.mimeType) diskMime = meta.mimeType;
        }
        inMemoryFileStore.set(storageKey, {
          buffer: diskBuf,
          mimeType: diskMime,
          name: 'company-logo.img',
        });
        res.setHeader('Content-Type', diskMime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(diskBuf);
      } catch (e) {}
    }

    const { client, bucketName, isConfigured } = getR2Client();
    if (isConfigured && client) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        });
        const r2Res = await client.send(getCmd);
        if (r2Res.Body) {
          const streamToBuffer = async (stream: any): Promise<Buffer> => {
            const chunks: any[] = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
          };
          const buf = await streamToBuffer(r2Res.Body);
          const mimeType = r2Res.ContentType || 'image/png';
          inMemoryFileStore.set(storageKey, {
            buffer: buf,
            mimeType,
            name: 'company-logo.img',
          });
          try {
            if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
            fs.writeFileSync(diskPath, buf);
            fs.writeFileSync(metaPath, JSON.stringify({ mimeType }));
          } catch (e) {}

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buf);
        }
      } catch (err) {
        // Not found
      }
    }

    return res.status(404).send('Logo not found');
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao obter logotipo', details: err.message });
  }
});

// 14.7 Reset auth header to default
app.delete('/api/settings/auth-header', async (req: Request, res: Response) => {
  try {
    const updatedBy = (req.headers['x-admin-user'] || req.query.admin) as string || 'Administrador MVRJCONTÁBIL';
    inMemoryFileStore.delete('system/auth-header.img');
    inMemoryFileStore.delete('system/company-logo.img');

    try {
      const authImg = path.join(ASSETS_DIR, 'auth-header.img');
      const authMeta = path.join(ASSETS_DIR, 'auth-header.meta.json');
      const logoImg = path.join(ASSETS_DIR, 'company-logo.img');
      const logoMeta = path.join(ASSETS_DIR, 'company-logo.meta.json');
      if (fs.existsSync(authImg)) fs.unlinkSync(authImg);
      if (fs.existsSync(authMeta)) fs.unlinkSync(authMeta);
      if (fs.existsSync(logoImg)) fs.unlinkSync(logoImg);
      if (fs.existsSync(logoMeta)) fs.unlinkSync(logoMeta);
    } catch (e) {}

    authHeaderConfig = {
      title: 'MVRJ CONTÁBIL',
      subtitle: 'Gestão Eletrônica de Documentos Segura',
      badgeText: 'Supabase RLS & Cloudflare R2',
      showBadge: true,
      bgType: 'gradient',
      gradientPreset: 'slate-indigo-blue',
      bgImageUrl: '',
      bgOpacity: 100,
      bgBlur: 0,
      bgOverlayType: 'dark',
      bgOverlayOpacity: 40,
      logoType: 'icon',
      logoImageUrl: '',
      iconName: 'FolderLock',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await saveR2Settings();
    return res.json({
      status: 'success',
      config: authHeaderConfig,
      message: 'Cabeçalho de login restaurado para o padrão',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao restaurar cabeçalho', details: err.message });
  }
});

// ==============================================================================
// VITE DEV / PRODUCTION MIDDLEWARE
// ==============================================================================

async function startServer() {
  // Sincroniza configurações e assets do Cloudflare R2 na inicialização
  try {
    await syncPersistedSettingsWithR2();
  } catch (syncErr: any) {
    console.warn('[Startup Sync Aviso]', syncErr.message);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MVRJCONTÁBIL GED] Server online on http://0.0.0.0:${PORT}`);
  });
}

startServer();
