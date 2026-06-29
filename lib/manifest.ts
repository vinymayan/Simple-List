import type { CollectionDraft } from './types';

export function buildCollectionManifest(draft: CollectionDraft) {
  const now = new Date().toISOString();

  return {
    manifestVersion: 1,
    generator: {
      name: 'Nexus Collection Builder',
      version: '0.1.0',
      generatedAt: now
    },
    collection: {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      visibility: draft.visibility,
      game: draft.game,
      coverImage: draft.coverImage || null
    },
    mods: draft.items.map((item, index) => ({
      source: 'nexusmods',
      game: item.game,
      modId: item.modId,
      modName: item.modName,
      fileId: item.fileId,
      fileName: item.fileName,
      version: item.fileVersion,
      fileCategory: item.fileCategory,
      fileSizeBytes: item.fileSizeBytes || null,
      required: item.required,
      installOrder: item.installOrder || index + 1,
      notes: item.notes || ''
    }))
  };
}

function fileSizeKb(sizeBytes?: number) {
  return sizeBytes && Number.isFinite(sizeBytes) && sizeBytes > 0
    ? Math.max(1, Math.ceil(sizeBytes / 1024))
    : null;
}

export function buildNexusCollectionPayload(draft: CollectionDraft, author = 'Nexus Collection Builder') {
  const mods = draft.items
    .filter((item) => item.fileId)
    .map((item) => ({
      name: item.modName,
      version: item.fileVersion || '1.0.0',
      optional: !item.required,
      domain_name: item.game,
      author: item.author || null,
      source: {
        type: 'nexus',
        mod_id: String(item.modId),
        file_id: String(item.fileId),
        update_policy: 'exact',
        logical_filename: item.fileName || null,
        file_expression: null,
        md5: null,
        file_size: fileSizeKb(item.fileSizeBytes),
        url: null,
        adult_content: false
      }
    }));

  return {
    adult_content: false,
    collection_schema_id: Number(process.env.NEXUS_COLLECTION_SCHEMA_ID || '1'),
    collection_manifest: {
      info: {
        author,
        author_url: null,
        name: draft.title.trim(),
        description: draft.description.trim() || null,
        summary: draft.description.trim() ? draft.description.trim().slice(0, 255) : null,
        domain_name: draft.game,
        game_versions: null
      },
      mods
    }
  };
}

export function validateDraftForPublish(draft: CollectionDraft): string[] {
  const errors: string[] = [];

  if (!draft.title.trim()) errors.push('Collection title is required.');
  if (!draft.game.trim()) errors.push('Game is required.');
  if (!draft.items.length) errors.push('Add at least one mod.');

  draft.items.forEach((item, index) => {
    if (!item.modId) errors.push(`Item ${index + 1}: mod_id is missing.`);
    if (!item.fileId) errors.push(`${item.modName}: choose a file before publishing.`);
    if (!item.fileSizeBytes || !Number.isFinite(item.fileSizeBytes) || item.fileSizeBytes <= 0) {
      errors.push(`${item.modName} / ${item.fileName || item.fileId}: file size is missing from Nexus API response.`);
    }
    if (item.status === 'unavailable') errors.push(`${item.modName}: mod is unavailable.`);
  });

  return errors;
}
