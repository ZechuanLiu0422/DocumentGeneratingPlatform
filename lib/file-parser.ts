import mammoth from 'mammoth';
import { AppError } from '@/lib/api';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_PAGES = 50;
export const MAX_REFERENCE_TEXT_LENGTH = 30000;

const allowedExtensions = new Set(['docx', 'pdf', 'txt']);

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function validateReferenceFile(fileName: string, size: number) {
  const extension = getExtension(fileName);

  if (!allowedExtensions.has(extension)) {
    throw new AppError(400, '不支持的文件格式，仅支持 .docx、.pdf、.txt', 'INVALID_FILE_TYPE');
  }

  if (size > MAX_UPLOAD_BYTES) {
    throw new AppError(400, '文件过大，请上传 5MB 以内的文件', 'FILE_TOO_LARGE');
  }

  return extension;
}

export async function parseReferenceFile(fileName: string, buffer: Buffer) {
  const extension = validateReferenceFile(fileName, buffer.length);
  let content = '';
  let pageCount: number | undefined;

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    content = result.value;
  } else if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdfDocument = await loadingTask.promise;
    pageCount = pdfDocument.numPages;
    if (pageCount > MAX_UPLOAD_PAGES) {
      throw new AppError(400, `PDF 页数过多，请控制在 ${MAX_UPLOAD_PAGES} 页以内`, 'PDF_TOO_LARGE');
    }

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();

      if (pageText) {
        pages.push(pageText);
      }
    }

    content = pages.join('\n');
  } else {
    content = buffer.toString('utf-8');
  }

  const normalized = normalizeExtractedText(content);

  if (!normalized) {
    throw new AppError(400, '文件中没有可提取的正文内容', 'EMPTY_REFERENCE_FILE');
  }

  if (normalized.length > MAX_REFERENCE_TEXT_LENGTH) {
    throw new AppError(400, '参考内容过长，请精简后再上传', 'REFERENCE_TOO_LONG');
  }

  return {
    content: normalized,
    wordCount: normalized.length,
    pageCount,
  };
}
