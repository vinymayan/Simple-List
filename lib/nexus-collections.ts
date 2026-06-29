import { nexusFetch, isMockMode, NexusApiError, getModFiles } from './nexus';
import { buildCollectionManifest, buildNexusCollectionPayload, validateDraftForPublish } from './manifest';
import type { CollectionDraft, PublishResult, UserCollection } from './types';

const V3_BASE = process.env.NEXUS_API_V3_BASE || 'https://api.nexusmods.com/v3';

function dataOf<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((url, [key, value]) => (
    url.replaceAll(`{${key}}`, encodeURIComponent(value))
  ), template);
}

function normalizeCollection(raw: any): UserCollection {
  const manifest = raw.collection_manifest ?? raw.latest_revision?.collection_manifest ?? raw.revision?.collection_manifest;
  const info = manifest?.info ?? raw.info ?? {};
  const id = String(raw.id ?? raw.collection_id ?? raw.uuid ?? raw.slug ?? '');
  const game = String(raw.domain_name ?? info.domain_name ?? raw.game ?? raw.game_domain_name ?? '');
  const slug = raw.slug ? String(raw.slug) : undefined;

  return {
    id,
    slug,
    title: String(raw.name ?? raw.title ?? info.name ?? slug ?? id),
    description: String(raw.description ?? info.description ?? info.summary ?? ''),
    game,
    revisionId: raw.revision_id ? String(raw.revision_id) : raw.latest_revision?.id ? String(raw.latest_revision.id) : undefined,
    revisionNumber: Number(raw.revision_number ?? raw.latest_revision?.revision_number ?? 0) || undefined,
    status: raw.revision_status ?? raw.status,
    url: raw.url ?? raw.collection_url ?? (slug && game ? `https://next.nexusmods.com/${game}/collections/${slug}` : undefined)
  };
}

function normalizeCollectionList(raw: any): UserCollection[] {
  const list: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.collections)
        ? raw.collections
        : Array.isArray(raw?.data?.collections)
          ? raw.data.collections
          : [];

  return list.map(normalizeCollection).filter((collection) => collection.id);
}

function collectionSummary(draft: CollectionDraft) {
  return draft.description.trim().slice(0, 255) || draft.title.trim().slice(0, 255);
}

function collectionCategoryId() {
  const value = Number(process.env.NEXUS_COLLECTION_CATEGORY_ID || '');
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function uploadManifestFile(apiKey: string, filename: string, payload: unknown) {
  const bytes = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const upload = dataOf<{ id: string; presigned_url: string }>(await nexusFetch(`${V3_BASE}/uploads`, {
    apiKey,
    method: 'POST',
    body: {
      filename,
      size_bytes: bytes.byteLength
    }
  }));

  if (!upload.id || !upload.presigned_url) {
    throw new NexusApiError('Nexus upload response did not include upload id or presigned URL.', 502, upload);
  }

  const putResponse = await fetch(upload.presigned_url, {
    method: 'PUT',
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/octet-stream'
    },
    body: bytes
  });

  if (!putResponse.ok) {
    const text = await putResponse.text().catch(() => '');
    throw new NexusApiError(
      `Nexus upload PUT failed with ${putResponse.status}: ${text || putResponse.statusText}`,
      putResponse.status,
      {
        uploadId: upload.id,
        status: putResponse.status,
        statusText: putResponse.statusText,
        response: text,
        signedHeaders: new URL(upload.presigned_url).searchParams.get('X-Amz-SignedHeaders')
      }
    );
  }

  await nexusFetch(`${V3_BASE}/uploads/${encodeURIComponent(upload.id)}/finalise`, {
    apiKey,
    method: 'POST'
  });

  return upload.id;
}

async function updateCollectionDetails(apiKey: string, collectionId: string, draft: CollectionDraft) {
  const body: Record<string, unknown> = {
    name: draft.title.trim().slice(0, 36),
    category_id: collectionCategoryId()
  };

  if (!draft.preserveDescription) {
    body.summary = collectionSummary(draft);
    body.description = draft.description.trim();
  }

  await nexusFetch(`${V3_BASE}/collections/${encodeURIComponent(collectionId)}`, {
    apiKey,
    method: 'PATCH',
    body
  });
}

async function refreshFileMetadata(apiKey: string, draft: CollectionDraft): Promise<CollectionDraft> {
  const cache = new Map<string, Awaited<ReturnType<typeof getModFiles>>>();
  const items = await Promise.all(draft.items.map(async (item) => {
    if (!item.fileId) return item;

    const key = `${item.game}:${item.modId}`;
    if (!cache.has(key)) {
      cache.set(key, await getModFiles(apiKey, item.game, item.modId));
    }

    const files = cache.get(key) || [];
    const file = files.find((candidate) => String(candidate.id) === String(item.fileId))
      || files.find((candidate) => candidate.name === item.fileName && (!item.fileVersion || candidate.version === item.fileVersion));

    return file ? {
      ...item,
      fileId: file.id || item.fileId,
      fileName: file.name || item.fileName,
      fileVersion: file.version || item.fileVersion,
      fileCategory: file.category || item.fileCategory,
      fileSizeBytes: file.sizeBytes || item.fileSizeBytes
    } : item;
  }));

  return { ...draft, items };
}

export async function publishCollection(apiKey: string, draft: CollectionDraft): Promise<PublishResult> {
  const enrichedDraft = await refreshFileMetadata(apiKey, draft);
  const errors = validateDraftForPublish(enrichedDraft);
  if (errors.length) {
    return { ok: false, message: errors.join(' ') };
  }

  const manifest = buildCollectionManifest(enrichedDraft);
  const nexusPayload = buildNexusCollectionPayload(enrichedDraft);

  if (isMockMode()) {
    return {
      ok: true,
      collectionId: enrichedDraft.id || `mock-collection-${Date.now()}`,
      slug: `mock-${Date.now()}`,
      revisionId: `mock-rev-${Date.now()}`,
      uploadId: `mock-upload-${Date.now()}`,
      collectionUrl: `https://next.nexusmods.com/${enrichedDraft.game}/collections/mock-${Date.now()}`,
      manifest
    };
  }

  const filename = `${enrichedDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection'}-manifest.json`;
  const uploadId = await uploadManifestFile(apiKey, filename, nexusPayload.collection_manifest);
  const collectionId = enrichedDraft.id?.trim();
  const endpoint = collectionId
    ? `${V3_BASE}/collections/${encodeURIComponent(collectionId)}/revisions`
    : `${V3_BASE}/collections`;
  const created = dataOf<any>(await nexusFetch<any>(endpoint, {
    apiKey,
    method: 'POST',
    body: {
      upload_id: uploadId,
      collection_data: nexusPayload
    }
  }));

  const slug = created.slug ? String(created.slug) : '';
  const createdCollectionId = String(created.collection_id ?? created.collectionId ?? created.id ?? collectionId ?? '');
  const collectionUrl = slug ? `https://next.nexusmods.com/${enrichedDraft.game}/collections/${slug}` : undefined;
  if (createdCollectionId) {
    await updateCollectionDetails(apiKey, createdCollectionId, enrichedDraft);
  }

  return {
    ok: true,
    collectionId: createdCollectionId,
    slug: slug || enrichedDraft.slug,
    collectionUrl: created.url ?? created.collection_url ?? created.collectionUrl ?? collectionUrl,
    revisionId: String(created.revision_id ?? created.revisionId ?? created.id ?? ''),
    uploadId,
    manifest
  };
}

export async function listUserCollections(apiKey: string): Promise<{ collections: UserCollection[]; source: string; message?: string }> {
  if (isMockMode()) {
    return {
      source: 'mock',
      collections: [
        {
          id: 'mock-collection-1',
          slug: 'mock-combat-pack',
          title: 'Mock Combat Pack',
          description: 'Collection de exemplo para testar o fluxo de edicao.',
          game: 'skyrimspecialedition',
          revisionId: 'mock-rev-1',
          revisionNumber: 1,
          status: 'draft',
          url: 'https://next.nexusmods.com/skyrimspecialedition/collections/mock-combat-pack'
        }
      ]
    };
  }

  const template = process.env.NEXUS_COLLECTIONS_LIST_URL_TEMPLATE;
  if (!template) {
    return {
      source: 'not-configured',
      collections: [],
      message: 'Configure NEXUS_COLLECTIONS_LIST_URL_TEMPLATE para listar collections da conta; o OpenAPI local nao expoe esse endpoint.'
    };
  }

  const url = renderTemplate(template, { base: V3_BASE });
  const raw = await nexusFetch<any>(url, { apiKey });
  return { source: 'api', collections: normalizeCollectionList(raw) };
}
