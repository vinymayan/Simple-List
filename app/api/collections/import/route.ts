import { NextResponse } from 'next/server';
import { inflateRawSync } from 'node:zlib';
import type { CollectionItem, UserCollection } from '@/lib/types';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 128;
const MAX_COLLECTION_ITEMS = 2_000;
const MAX_COMPRESSION_RATIO = 100;

function assertRange(buffer: Buffer, offset: number, length: number, label: string) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`Invalid zip ${label}.`);
  }
}

function readUInt16(buffer: Buffer, offset: number) {
  assertRange(buffer, offset, 2, 'field');
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  assertRange(buffer, offset, 4, 'field');
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  if (buffer.length < 22) return -1;
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) return offset;
  }
  return -1;
}

function extractCollectionJsonFromZip(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error('Could not read the zip central directory.');

  const diskNumber = readUInt16(buffer, eocdOffset + 4);
  const centralDisk = readUInt16(buffer, eocdOffset + 6);
  const entryCount = readUInt16(buffer, eocdOffset + 10);
  const centralSize = readUInt32(buffer, eocdOffset + 12);
  const centralOffset = readUInt32(buffer, eocdOffset + 16);
  if (diskNumber !== 0 || centralDisk !== 0) throw new Error('Multi-volume zip files are not supported.');
  if (entryCount < 1 || entryCount > MAX_ARCHIVE_ENTRIES) throw new Error(`Zip files may contain at most ${MAX_ARCHIVE_ENTRIES} entries.`);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('ZIP64 archives are not supported.');
  assertRange(buffer, centralOffset, centralSize, 'central directory');
  if (centralOffset + centralSize > eocdOffset) throw new Error('Invalid zip central directory position.');

  let offset = centralOffset;
  let result: string | null = null;
  for (let index = 0; index < entryCount; index += 1) {
    assertRange(buffer, offset, 46, 'central header');
    if (readUInt32(buffer, offset) !== 0x02014b50) throw new Error('Invalid zip central header.');

    const flags = readUInt16(buffer, offset + 8);
    const method = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const filenameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const recordLength = 46 + filenameLength + extraLength + commentLength;
    assertRange(buffer, offset, recordLength, 'central record');
    const filename = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString('utf8').replaceAll('\\', '/');

    if (filename.split('/').pop()?.toLowerCase() === 'collection.json') {
      if (result !== null) throw new Error('The zip contains more than one collection.json file.');
      if ((flags & 0x1) !== 0) throw new Error('Encrypted zip entries are not supported.');
      if (method !== 0 && method !== 8) throw new Error(`Unsupported zip compression method: ${method}.`);
      if (uncompressedSize > MAX_MANIFEST_BYTES) throw new Error('collection.json is too large.');
      if (compressedSize === 0 && uncompressedSize > 0) throw new Error('Invalid zip entry size.');
      if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) throw new Error('Zip compression ratio exceeds the safety limit.');

      assertRange(buffer, localHeaderOffset, 30, 'local header');
      if (readUInt32(buffer, localHeaderOffset) !== 0x04034b50) throw new Error('Invalid local zip header.');
      const localFilenameLength = readUInt16(buffer, localHeaderOffset + 26);
      const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFilenameLength + localExtraLength;
      assertRange(buffer, dataOffset, compressedSize, 'entry data');
      if (localHeaderOffset >= centralOffset || dataOffset + compressedSize > centralOffset) throw new Error('Invalid zip entry position.');
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      const extracted = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: MAX_MANIFEST_BYTES });
      if (extracted.length !== uncompressedSize || extracted.length > MAX_MANIFEST_BYTES) throw new Error('Invalid collection.json size.');
      result = extracted.toString('utf8');
    }

    offset += recordLength;
  }

  if (result === null) throw new Error('collection.json was not found inside the zip.');
  return result;
}

function cleanText(value: unknown, maxLength = 1_000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function itemFromManifestMod(raw: any, index: number, fallbackGame: string): CollectionItem | null {
  const source = raw?.source || {};
  const modId = Number(source.modId ?? source.mod_id);
  const fileId = Number(source.fileId ?? source.file_id);
  if (!Number.isSafeInteger(modId) || modId <= 0 || !Number.isSafeInteger(fileId) || fileId <= 0) return null;

  const game = cleanText(raw.domainName ?? raw.domain_name, 100) || fallbackGame;
  const fileSizeBytes = Number(source.fileSize ?? source.file_size);

  return {
    localId: `import-${game}-${modId}-${fileId}-${index}-${Date.now()}`,
    game,
    modId,
    modName: cleanText(raw.name, 300) || `Mod ${modId}`,
    author: cleanText(raw.author, 200),
    thumbnail: '/mod-placeholder.svg',
    fileId,
    fileName: cleanText(source.logicalFilename ?? source.logical_filename, 500) || cleanText(raw.name, 300) || `File ${fileId}`,
    fileVersion: cleanText(raw.version, 100),
    fileCategory: cleanText(raw.details?.category, 100),
    fileSizeBytes: Number.isSafeInteger(fileSizeBytes) && fileSizeBytes > 0 ? fileSizeBytes : undefined,
    fileMd5: cleanText(source.md5, 128),
    required: raw.optional !== true,
    installOrder: index + 1,
    status: 'ok'
  };
}

function collectionFromManifest(manifest: any, sourceName: string): UserCollection {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid collection manifest.');
  const info = manifest.info || {};
  const game = cleanText(info.domainName ?? info.domain_name, 100) || 'skyrimspecialedition';
  const title = cleanText(info.name, 300) || cleanText(sourceName.replace(/\.(zip|json)$/i, ''), 300) || 'Imported collection';
  const description = cleanText(info.description, 5_000);
  const summary = cleanText(info.summary, 1_000);
  if (!Array.isArray(manifest.mods)) throw new Error('The manifest does not contain a mods array.');
  if (manifest.mods.length > MAX_COLLECTION_ITEMS) throw new Error(`Collections may contain at most ${MAX_COLLECTION_ITEMS} items.`);
  const items = manifest.mods
    .map((mod: any, index: number) => itemFromManifestMod(mod, index, game))
    .filter(Boolean) as CollectionItem[];

  return {
    id: `import:${Date.now()}:${crypto.randomUUID()}`,
    title,
    description: summary || description,
    game,
    items,
    editable: true
  };
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get('content-length');
    if (!contentLength) return NextResponse.json({ message: 'Content-Length is required.' }, { status: 411 });
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 1) return NextResponse.json({ message: 'Invalid Content-Length.' }, { status: 400 });
    if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ message: 'Upload is too large.' }, { status: 413 });

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ message: 'Upload a collection .json or .zip file.' }, { status: 400 });
    if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: 'Files must be between 1 byte and 8 MB.' }, { status: 413 });

    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.json') && !filename.endsWith('.zip')) {
      return NextResponse.json({ message: 'Only .json and .zip collection files are accepted.' }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (filename.endsWith('.json') && bytes.length > MAX_MANIFEST_BYTES) return NextResponse.json({ message: 'JSON manifest is too large.' }, { status: 413 });
    const raw = filename.endsWith('.zip') ? extractCollectionJsonFromZip(bytes) : bytes.toString('utf8');
    const collection = collectionFromManifest(JSON.parse(raw), file.name);
    return NextResponse.json({ collection }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Could not import collection.' }, { status: 400 });
  }
}
