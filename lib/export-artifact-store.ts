import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/api';

const EXPORT_ARTIFACT_SELECT =
  'id, operation_id, user_id, draft_id, file_name, mime_type, byte_size, storage_path, created_at';

export const EXPORT_ARTIFACT_BUCKET = 'exports';
export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type ExportArtifactRecord = {
  id: string;
  operationId: string;
  userId: string;
  draftId: string | null;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storagePath: string;
  createdAt: string;
};

function normalizeExportArtifactRecord(row: any): ExportArtifactRecord {
  return {
    id: row.id,
    operationId: row.operation_id,
    userId: row.user_id,
    draftId: row.draft_id || null,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size || 0),
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export function normalizeExportArtifactStoragePath(userId: string, operationId: string) {
  return `${EXPORT_ARTIFACT_BUCKET}/${userId}/${operationId}.docx`;
}

function toObjectPath(storagePath: string) {
  return storagePath.startsWith(`${EXPORT_ARTIFACT_BUCKET}/`)
    ? storagePath.slice(EXPORT_ARTIFACT_BUCKET.length + 1)
    : storagePath;
}

export async function uploadExportArtifact(
  supabase: SupabaseClient,
  payload: {
    operationId: string;
    userId: string;
    draftId: string | null;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  }
) {
  const storagePath = normalizeExportArtifactStoragePath(payload.userId, payload.operationId);
  const objectPath = toObjectPath(storagePath);

  const { error: uploadError } = await supabase.storage.from(EXPORT_ARTIFACT_BUCKET).upload(objectPath, payload.bytes, {
    upsert: true,
    contentType: payload.mimeType,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from('export_artifacts')
    .upsert(
      {
        operation_id: payload.operationId,
        user_id: payload.userId,
        draft_id: payload.draftId,
        file_name: payload.fileName,
        mime_type: payload.mimeType,
        byte_size: payload.bytes.byteLength,
        storage_path: storagePath,
      },
      { onConflict: 'operation_id' }
    )
    .select(EXPORT_ARTIFACT_SELECT)
    .single();

  if (error || !data) {
    throw error || new AppError(500, '导出产物记录失败', 'EXPORT_ARTIFACT_WRITE_FAILED');
  }

  return normalizeExportArtifactRecord(data);
}

export async function getExportArtifactByOperationId(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    operationId: string;
  }
) {
  const { data, error } = await supabase
    .from('export_artifacts')
    .select(EXPORT_ARTIFACT_SELECT)
    .eq('operation_id', payload.operationId)
    .eq('user_id', payload.userId)
    .single();

  if (error || !data) {
    throw new AppError(404, '导出文件不存在或无权访问', 'EXPORT_ARTIFACT_NOT_FOUND');
  }

  return normalizeExportArtifactRecord(data);
}

export async function downloadExportArtifactBytes(supabase: SupabaseClient, storagePath: string) {
  const objectPath = toObjectPath(storagePath);
  const { data, error } = await supabase.storage.from(EXPORT_ARTIFACT_BUCKET).download(objectPath);

  if (error || !data) {
    throw error || new AppError(404, '导出文件内容不存在', 'EXPORT_ARTIFACT_MISSING');
  }

  return Buffer.from(await data.arrayBuffer());
}
