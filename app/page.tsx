'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileJson,
  GripVertical,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud
} from 'lucide-react';
import type { CollectionDraft, CollectionItem, Game, ModFile, ModSummary, PublishResult, UserCollection } from '@/lib/types';

type ApiState<T> = {
  loading: boolean;
  error: string;
  data?: T;
};

type View = 'login' | 'dashboard' | 'my-collections' | 'game' | 'builder' | 'publish' | 'success';

const DEFAULT_GAME = 'skyrimspecialedition';
const SAVED_COLLECTIONS_KEY = 'ncb_saved_collections';

function HydrationSafeIcon({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <span className="icon-slot" suppressHydrationWarning>{mounted ? children : null}</span>;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function groupFiles(files: ModFile[]) {
  const groups: Record<string, ModFile[]> = {
    MAIN: [],
    OPTIONAL: [],
    OLD_VERSION: [],
    MISCELLANEOUS: []
  };

  for (const file of files) {
    const key = String(file.category || 'MISCELLANEOUS').toUpperCase();
    if (key.includes('MAIN')) groups.MAIN.push(file);
    else if (key.includes('OPTIONAL')) groups.OPTIONAL.push(file);
    else if (key.includes('OLD')) groups.OLD_VERSION.push(file);
    else groups.MISCELLANEOUS.push(file);
  }

  return groups;
}

function groupTitle(group: string) {
  if (group === 'MAIN') return 'Arquivos principais';
  if (group === 'OPTIONAL') return 'Arquivos opcionais';
  if (group === 'OLD_VERSION') return 'Arquivos antigos';
  return 'Outros arquivos';
}

function createCollectionItem(mod: ModSummary, file: ModFile, installOrder = 1): CollectionItem {
  return {
    localId: `${mod.game}-${mod.modId}-${file.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    game: mod.game,
    modId: mod.modId,
    modName: mod.name,
    author: mod.author,
    thumbnail: mod.thumbnail,
    fileId: file.id,
    fileName: file.name,
    fileVersion: file.version || mod.version,
    fileCategory: file.category,
    fileSizeBytes: file.sizeBytes,
    required: true,
    installOrder,
    status: mod.available ? 'ok' : 'unavailable'
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed: ${response.status}`);
  }
  return payload as T;
}

function parseModId(value: string) {
  const urlMatch = value.match(/nexusmods\.com\/([^/]+)\/mods\/(\d+)/i);
  if (urlMatch) return { game: urlMatch[1].toLowerCase(), modId: Number(urlMatch[2]), isUrl: true };
  const idMatch = value.trim().match(/^\d+$/);
  if (idMatch) return { game: '', modId: Number(idMatch[0]), isUrl: false };
  return null;
}

function parseCollectionUrl(value: string) {
  const match = value.match(/next\.nexusmods\.com\/([^/]+)\/collections\/([^/?#]+)/i);
  if (!match) return null;
  return { game: match[1].toLowerCase(), slug: decodeURIComponent(match[2]) };
}

export default function Home() {
  const [view, setView] = useState<View>('login');
  const [apiKey, setApiKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [auth, setAuth] = useState<ApiState<any>>({ loading: false, error: '' });
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState(DEFAULT_GAME);
  const [editingCollection, setEditingCollection] = useState<UserCollection | null>(null);
  const [savedCollections, setSavedCollections] = useState<UserCollection[]>([]);
  const [myCollections, setMyCollections] = useState<ApiState<{ collections: UserCollection[]; source: string; message?: string }>>({ loading: false, error: '' });
  const [collectionLinkInput, setCollectionLinkInput] = useState('');
  const [collectionIdInput, setCollectionIdInput] = useState('');
  const [collectionLinkError, setCollectionLinkError] = useState('');
  const [modInput, setModInput] = useState('');
  const [modState, setModState] = useState<ApiState<{ mod: ModSummary }>>({ loading: false, error: '' });
  const [filesState, setFilesState] = useState<ApiState<{ files: ModFile[] }>>({ loading: false, error: '' });
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [collectionTextFilter, setCollectionTextFilter] = useState('');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draftMeta, setDraftMeta] = useState({
    title: 'Minha Collection',
    description: '',
    preserveDescription: false,
    category: 'Gameplay',
    visibility: 'public' as 'public' | 'private'
  });
  const [publishState, setPublishState] = useState<ApiState<PublishResult>>({ loading: false, error: '' });

  useEffect(() => {
    api<{ games: Game[] }>('/api/games').then((res) => setGames(res.games)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('ncb_collection');
    if (!saved) return;
    try {
      setCollection(JSON.parse(saved) as CollectionItem[]);
    } catch {
      localStorage.removeItem('ncb_collection');
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_COLLECTIONS_KEY);
    if (!saved) return;
    try {
      setSavedCollections(JSON.parse(saved) as UserCollection[]);
    } catch {
      localStorage.removeItem(SAVED_COLLECTIONS_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ncb_collection', JSON.stringify(collection));
  }, [collection]);

  const currentGame = useMemo(() => games.find((game) => game.domainName === selectedGame), [games, selectedGame]);
  const selectedMod = modState.data?.mod || null;
  const groupedFiles = groupFiles(filesState.data?.files || []);
  const collectionOk = collection.length > 0 && collection.every((item) => item.status === 'ok' && item.fileId);
  const filteredCollection = collection.filter((item) => {
    const needle = collectionTextFilter.trim().toLowerCase();
    if (!needle) return true;
    return `${item.modName} ${item.fileName} ${item.author || ''} ${item.fileCategory || ''}`.toLowerCase().includes(needle);
  });

  const draft: CollectionDraft = useMemo(() => ({
    id: editingCollection?.editable === false ? undefined : editingCollection?.id,
    slug: editingCollection?.slug,
    title: draftMeta.title,
    description: draftMeta.description,
    preserveDescription: editingCollection ? draftMeta.preserveDescription : false,
    category: draftMeta.category,
    visibility: draftMeta.visibility,
    game: selectedGame,
    coverImage: collection[0]?.thumbnail,
    items: collection.map((item, index) => ({ ...item, installOrder: index + 1 }))
  }), [draftMeta, selectedGame, collection, editingCollection]);

  async function validateKey() {
    setAuth({ loading: true, error: '' });
    try {
      const result = await api<any>('/api/auth/validate-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey })
      });
      setAuthed(true);
      setAuth({ loading: false, error: '', data: result.user });
      setView('dashboard');
    } catch (error: any) {
      setAuth({ loading: false, error: error.message || 'API key invalida.' });
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAuthed(false);
    setApiKey('');
    setView('login');
  }

  function startCreate() {
    setEditingCollection(null);
    setCollection([]);
    setModInput('');
    setModState({ loading: false, error: '' });
    setFilesState({ loading: false, error: '' });
    setSelectedFileIds([]);
    setDraftMeta({
      title: 'Minha Collection',
      description: '',
      preserveDescription: false,
      category: 'Gameplay',
      visibility: 'public'
    });
    setView('game');
  }

  function saveKnownCollection(next: UserCollection) {
    const normalized: UserCollection = {
      ...next,
      editable: next.editable ?? !String(next.id).startsWith('link:')
    };
    setSavedCollections((items) => {
      const key = normalized.id || normalized.slug || normalized.url || normalized.title;
      const merged = [
        normalized,
        ...items.filter((item) => (item.id || item.slug || item.url || item.title) !== key)
      ];
      localStorage.setItem(SAVED_COLLECTIONS_KEY, JSON.stringify(merged));
      return merged;
    });
  }

  function addCollectionLink() {
    const parsed = parseCollectionUrl(collectionLinkInput);
    if (!parsed) {
      setCollectionLinkError('Informe um link da collection no formato next.nexusmods.com/{jogo}/collections/{slug}.');
      return;
    }

    const id = collectionIdInput.trim();
    saveKnownCollection({
      id: id || `link:${parsed.game}:${parsed.slug}`,
      slug: parsed.slug,
      title: parsed.slug.replace(/[-_]+/g, ' '),
      description: '',
      game: parsed.game,
      url: collectionLinkInput.trim(),
      editable: Boolean(id)
    });
    setCollectionLinkInput('');
    setCollectionIdInput('');
    setCollectionLinkError('');
  }

  async function loadMyCollections() {
    setView('my-collections');
    setMyCollections({ loading: true, error: '' });
    try {
      const result = await api<{ collections: UserCollection[]; source: string; message?: string }>('/api/collections/list');
      setMyCollections({ loading: false, error: '', data: result });
    } catch (error: any) {
      setMyCollections({ loading: false, error: error.message || 'Nao foi possivel carregar suas collections.' });
    }
  }

  function editExisting(collectionInfo: UserCollection) {
    setEditingCollection(collectionInfo);
    setSelectedGame(collectionInfo.game || DEFAULT_GAME);
    setDraftMeta({
      title: collectionInfo.title || 'Minha Collection',
      description: collectionInfo.description || '',
      preserveDescription: true,
      category: 'Gameplay',
      visibility: 'public'
    });
    setCollection(collectionInfo.items || []);
    setModInput('');
    setModState({ loading: false, error: '' });
    setFilesState({ loading: false, error: '' });
    setSelectedFileIds([]);
    setView('builder');
  }

  async function openModDetails() {
    const parsed = parseModId(modInput);
    if (!parsed) {
      setModState({ loading: false, error: 'Informe um ID numerico ou uma URL da Nexus Mods.' });
      return;
    }

    const game = parsed.game || selectedGame;
    setSelectedGame(game);
    setModState({ loading: true, error: '' });
    setFilesState({ loading: true, error: '' });
    setSelectedFileIds([]);

    try {
      const modResult = await api<{ mod: ModSummary }>(`/api/mods/${encodeURIComponent(game)}/${parsed.modId}`);
      setModState({ loading: false, error: '', data: modResult });
      const fileResult = await api<{ files: ModFile[] }>(`/api/mods/${encodeURIComponent(game)}/${parsed.modId}/files`);
      setFilesState({ loading: false, error: '', data: fileResult });
      const mainFiles = fileResult.files.filter((file) => String(file.category).toUpperCase().includes('MAIN'));
      setSelectedFileIds((mainFiles.length ? mainFiles : fileResult.files.slice(0, 1)).map((file) => file.id));
    } catch (error: any) {
      const message = error.message || 'Nao foi possivel abrir os detalhes do mod.';
      setModState((state) => ({ ...state, loading: false, error: message }));
      setFilesState({ loading: false, error: message });
    }
  }

  function toggleFile(fileId: number) {
    setSelectedFileIds((ids) => ids.includes(fileId) ? ids.filter((id) => id !== fileId) : [...ids, fileId]);
  }

  function addSelectedFiles() {
    if (!selectedMod || !filesState.data?.files.length) return;
    const selectedFiles = filesState.data.files.filter((file) => selectedFileIds.includes(file.id));
    if (!selectedFiles.length) return;
    setCollection((items) => [
      ...items,
      ...selectedFiles.map((file, index) => createCollectionItem(selectedMod, file, items.length + index + 1))
    ]);
    setSelectedFileIds([]);
    setModInput('');
    setModState({ loading: false, error: '' });
    setFilesState({ loading: false, error: '' });
  }

  function removeItem(localId: string) {
    setCollection((items) => items.filter((item) => item.localId !== localId));
  }

  function moveItem(localId: string, direction: -1 | 1) {
    setCollection((items) => {
      const index = items.findIndex((item) => item.localId === localId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
      const copy = [...items];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function moveItemToPosition(localId: string, position: number) {
    setCollection((items) => {
      const index = items.findIndex((item) => item.localId === localId);
      if (index < 0) return items;
      const targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(position) - 1));
      const copy = [...items];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  }

  function dropItemOn(targetLocalId: string) {
    if (!draggedItemId || draggedItemId === targetLocalId) return;
    setCollection((items) => {
      const fromIndex = items.findIndex((item) => item.localId === draggedItemId);
      const toIndex = items.findIndex((item) => item.localId === targetLocalId);
      if (fromIndex < 0 || toIndex < 0) return items;
      const copy = [...items];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
    setDraggedItemId(null);
  }

  async function publishCollection() {
    setPublishState({ loading: true, error: '' });
    try {
      const result = await api<PublishResult>('/api/collections/publish', {
        method: 'POST',
        body: JSON.stringify(draft)
      });
      setPublishState({ loading: false, error: '', data: result });
      if (result.ok) {
        const collectionId = result.collectionId || editingCollection?.id;
        const slug = result.slug || editingCollection?.slug;
        if (collectionId) {
          saveKnownCollection({
            id: collectionId,
            slug,
            title: draft.title,
            description: draft.preserveDescription ? editingCollection?.description : draft.description,
            game: draft.game,
            revisionId: result.revisionId,
            url: result.collectionUrl || editingCollection?.url,
            items: draft.items,
            editable: true
          });
          setEditingCollection((current) => current ? { ...current, id: collectionId, slug, url: result.collectionUrl || current.url, editable: true } : current);
        }
        setView('success');
      }
    } catch (error: any) {
      setPublishState({ loading: false, error: error.message || 'Falha ao publicar collection.' });
    }
  }

  function renderLogin() {
    return (
      <main className="login-shell">
        <section className="stage-card narrow-stage login-only">
          <div className="welcome-card">
            <div className="orb-icon"><HydrationSafeIcon><KeyRound size={34} /></HydrationSafeIcon></div>
            <h2>Validar API Key</h2>
            <p>Informe sua chave da Nexus Mods para acessar o app.</p>
            <div className="field">
              <label className="label">Nexus API Key</label>
              <input
                className="input"
                type="password"
                placeholder="Cole sua API key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && validateKey()}
              />
            </div>
            <button className="btn btn-primary full" disabled={auth.loading || !apiKey.trim()} onClick={validateKey}>
              {auth.loading ? <Loader2 size={16} className="spin" /> : <HydrationSafeIcon><ShieldCheck size={16} /></HydrationSafeIcon>}
              Confirmar API
            </button>
            {auth.error ? <div className="error">{auth.error}</div> : null}
          </div>
        </section>
      </main>
    );
  }

  function renderTopbar() {
    return (
      <div className="session-bar">
        <div className="session-brand">
          <span>Nexus</span>
          <strong>Collection Builder</strong>
        </div>
        <div className="row">
          <span className="badge">{currentGame?.name || selectedGame}</span>
          <button className="btn btn-ghost" onClick={logout}><LogOut size={16} /> Sair</button>
        </div>
      </div>
    );
  }

  function renderPageHeading(title: ReactNode, subtitle?: ReactNode, actions?: ReactNode, showBack = view !== 'dashboard') {
    return (
      <div className="page-heading">
        {showBack ? (
          <button className="back-link" onClick={goBack}>
            <ArrowLeft size={15} /> Voltar
          </button>
        ) : null}
        <div className="stage-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </div>
      </div>
    );
  }

  function goBack() {
    if (view === 'my-collections') setView('dashboard');
    else if (view === 'game') setView('dashboard');
    else if (view === 'builder') setView(editingCollection ? 'my-collections' : 'game');
    else if (view === 'publish') setView('builder');
    else if (view === 'success') setView('publish');
    else setView('dashboard');
  }

  function renderDashboard() {
    return (
      <section className="stage-card dashboard-stage">
        {renderPageHeading(
          'O que deseja fazer?',
          'Escolha se vai editar uma collection existente ou criar uma nova.',
          undefined,
          false
        )}
        <div className="choice-grid">
          <button className="flow-card" onClick={loadMyCollections}>
            <FileJson size={28} />
            <strong>Acessar minhas collections</strong>
            <span>Lista as collections disponiveis para a API key validada e abre edicao.</span>
            <ChevronRight size={18} />
          </button>
          <button className="flow-card" onClick={startCreate}>
            <Plus size={28} />
            <strong>Criar collection</strong>
            <span>Escolha o jogo e adicione mods por ID ou URL.</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    );
  }

  function renderMyCollections() {
    const apiCollections = myCollections.data?.collections || [];
    const collections = [...savedCollections, ...apiCollections].filter((item, index, list) => {
      const key = item.id || item.slug || item.url;
      return list.findIndex((candidate) => (candidate.id || candidate.slug || candidate.url) === key) === index;
    });
    return (
      <section className="stage-card collection-stage">
        {renderPageHeading(
          'Minhas collections',
          'Collections retornadas para a API key atual.',
          <button className="btn" onClick={loadMyCollections} disabled={myCollections.loading}>
            {myCollections.loading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            Atualizar
          </button>
        )}
        {myCollections.error ? <div className="error">{myCollections.error}</div> : null}
        {myCollections.data?.message ? <div className="notice">{myCollections.data.message}</div> : null}
        <div className="link-collection-panel">
          <div className="field">
            <label className="label">Adicionar collection por link</label>
            <input
              className="input"
              value={collectionLinkInput}
              onChange={(event) => setCollectionLinkInput(event.target.value)}
              placeholder="https://next.nexusmods.com/skyrimspecialedition/collections/slug"
            />
          </div>
          <div className="field">
            <label className="label">ID da collection</label>
            <input
              className="input"
              value={collectionIdInput}
              onChange={(event) => setCollectionIdInput(event.target.value)}
              placeholder="Necessario para criar revisao"
            />
          </div>
          <button className="btn btn-primary" onClick={addCollectionLink} disabled={!collectionLinkInput.trim()}>
            <Plus size={16} /> Salvar link
          </button>
        </div>
        {collectionLinkError ? <div className="error">{collectionLinkError}</div> : null}
        {myCollections.loading ? <div className="empty"><Loader2 size={18} className="spin" /> Carregando collections...</div> : null}
        {!myCollections.loading && collections.length ? (
          <div className="collection-list">
            {collections.map((item) => (
              <article key={item.id} className="saved-collection">
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description || 'Sem descricao disponivel.'}</p>
                  <div className="mod-meta">
                    <span>{item.game}</span>
                    {item.revisionNumber ? <span>Revision {item.revisionNumber}</span> : null}
                    {item.status ? <span>{item.status}</span> : null}
                    {item.editable === false ? <span>link salvo sem id</span> : null}
                  </div>
                </div>
                <button className="btn btn-primary" disabled={item.editable === false} onClick={() => editExisting(item)}><Eye size={16} /> Editar</button>
              </article>
            ))}
          </div>
        ) : null}
        {!myCollections.loading && !collections.length && !myCollections.error ? (
          <div className="empty">Nenhuma collection foi retornada para essa API key.</div>
        ) : null}
      </section>
    );
  }

  function renderGame() {
    return (
      <section className="stage-card">
        {renderPageHeading(
          'Escolha o jogo',
          'Depois disso voce adiciona mods por ID ou URL.',
          <button className="btn btn-primary" onClick={() => setView('builder')} disabled={!selectedGame}>
            Continuar <ChevronRight size={16} />
          </button>
        )}
        <input className="input" value={selectedGame} onChange={(event) => setSelectedGame(event.target.value)} placeholder="Dominio do jogo" />
        <div className="game-grid large">
          {games.map((game) => (
            <button key={game.domainName} className={`game-card ${selectedGame === game.domainName ? 'active' : ''}`} onClick={() => setSelectedGame(game.domainName)}>
              <img src={game.image} alt={game.name} />
              <span>{game.name}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderBuilder() {
    return (
      <section className="stage-card builder-stage">
        {renderPageHeading(
          editingCollection ? `Editando ${editingCollection.title}` : 'Criar collection',
          'Adicione mods por ID ou URL, abra detalhes e selecione um ou mais arquivos.',
          <button className="btn btn-primary" onClick={() => setView('publish')} disabled={!collection.length}>
            Dados da collection <ChevronRight size={16} />
          </button>
        )}

        <div className="builder-layout">
          <div className="form-stack">
            <div className="lookup-panel">
              <div className="field">
                <label className="label">ID ou URL do mod</label>
                <div className="inline-lookup">
                  <input
                    className="input"
                    value={modInput}
                    onChange={(event) => setModInput(event.target.value)}
                    placeholder="https://www.nexusmods.com/skyrimspecialedition/mods/123 ou 123"
                    onKeyDown={(event) => event.key === 'Enter' && openModDetails()}
                  />
                  <button className="btn btn-primary" onClick={openModDetails} disabled={modState.loading || !modInput.trim()}>
                    {modState.loading || filesState.loading ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
                    Abrir detalhes
                  </button>
                </div>
              </div>
              {modState.error ? <div className="error">{modState.error}</div> : null}
            </div>

            {selectedMod ? (
              <article className="mod-detail-panel">
                <img src={selectedMod.thumbnail || '/mod-placeholder.svg'} alt={selectedMod.name} />
                <div className="mod-detail-copy">
                  <div>
                    <h3>{selectedMod.name}</h3>
                    <div className="mod-meta">
                      <span>by {selectedMod.author}</span>
                      <span>{selectedMod.category}</span>
                    </div>
                    <p>{selectedMod.summary || 'Sem descricao resumida disponivel.'}</p>
                  </div>
                  <button className="icon-btn add-file-btn" title="Adicionar arquivos selecionados" onClick={addSelectedFiles} disabled={!selectedFileIds.length || filesState.loading}>
                    <Plus size={18} />
                  </button>
                </div>
              </article>
            ) : null}

            {filesState.loading ? <div className="empty"><Loader2 size={18} className="spin" /> Carregando arquivos...</div> : null}
            {!filesState.loading && filesState.data?.files.length ? (
              <div className="file-groups">
                {Object.entries(groupedFiles).map(([group, files]) => files.length ? (
                  <details className="file-group" key={group} open={group !== 'OLD_VERSION'}>
                    <summary>
                      <span>{groupTitle(group)}</span>
                      <small>{files.length}</small>
                    </summary>
                    {files.map((file) => (
                      <button key={file.id} className={`file-option ${selectedFileIds.includes(file.id) ? 'active' : ''}`} onClick={() => toggleFile(file.id)}>
                        <span className="checkbox-mark">{selectedFileIds.includes(file.id) ? <Check size={13} /> : null}</span>
                        <div>
                          <strong>{file.name}</strong>
                          <div className="helper">Versao {file.version || '-'} - {file.uploadedAt || '-'} - {formatBytes(file.sizeBytes)}</div>
                          {file.description ? <div className="helper">{file.description}</div> : null}
                        </div>
                      </button>
                    ))}
                  </details>
                ) : null)}
              </div>
            ) : null}
          </div>

          <aside className="side-panel">
            <div className="side-head">
              <strong>Mods na collection</strong>
              <span>{collection.length}</span>
            </div>
            <div className="field">
              <label className="label">Filtrar mods</label>
              <input
                className="input compact-input"
                value={collectionTextFilter}
                onChange={(event) => setCollectionTextFilter(event.target.value)}
                placeholder="Nome do mod ou arquivo"
              />
            </div>
            <div className="mini-list">
              {filteredCollection.length ? filteredCollection.map((item) => {
                const order = collection.findIndex((candidate) => candidate.localId === item.localId) + 1;
                return (
                <article
                  key={item.localId}
                  className={`mini-item ${draggedItemId === item.localId ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDraggedItemId(item.localId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropItemOn(item.localId)}
                  onDragEnd={() => setDraggedItemId(null)}
                >
                  <GripVertical className="drag-handle" size={16} />
                  <input
                    key={order}
                    className="order-input"
                    aria-label={`Ordem de ${item.modName}`}
                    defaultValue={order}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      const value = Number((event.currentTarget as HTMLInputElement).value);
                      if (Number.isFinite(value)) moveItemToPosition(item.localId, value);
                      (event.currentTarget as HTMLInputElement).blur();
                    }}
                    onBlur={(event) => {
                      event.currentTarget.value = String(collection.findIndex((candidate) => candidate.localId === item.localId) + 1);
                    }}
                  />
                  <img src={item.thumbnail || '/mod-placeholder.svg'} alt={item.modName} />
                  <div>
                    <strong>{item.modName}</strong>
                    <span>{item.fileName}</span>
                    <small>Versao {item.fileVersion || '-'} - {formatBytes(item.fileSizeBytes)}</small>
                  </div>
                  <div className="mini-actions">
                    <button className="icon-btn" title="Remover" onClick={() => removeItem(item.localId)}><Trash2 size={15} /></button>
                  </div>
                </article>
                );
              }) : <div className="empty compact-empty">{collection.length ? 'Nenhum mod encontrado no filtro.' : 'Nenhum arquivo adicionado.'}</div>}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  function renderPublish() {
    return (
      <section className="stage-card publish-stage">
        {renderPageHeading(
          'Dados da collection',
          'Esses campos vao no manifesto enviado para a Nexus.'
        )}
        <div className="publish-layout">
          <div className="form-stack">
            <div className="field">
              <label className="label">Titulo</label>
              <input className="input" value={draftMeta.title} onChange={(e) => setDraftMeta({ ...draftMeta, title: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Descricao</label>
              <textarea className="textarea" value={draftMeta.description} maxLength={1000} onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })} />
              <span className="helper">{draftMeta.description.length}/1000</span>
            </div>
            {editingCollection ? (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={draftMeta.preserveDescription}
                  onChange={(e) => setDraftMeta({ ...draftMeta, preserveDescription: e.target.checked })}
                />
                <span>Nao alterar descricao atual da collection ao criar revisao</span>
              </label>
            ) : null}
            <div className="field">
              <label className="label">Categoria</label>
              <select className="select" value={draftMeta.category} onChange={(e) => setDraftMeta({ ...draftMeta, category: e.target.value })}>
                <option>Gameplay</option>
                <option>Animation</option>
                <option>Combat</option>
                <option>Visuals</option>
                <option>Utilities</option>
              </select>
            </div>
            <div className="visibility-grid">
              <button className={`choice ${draftMeta.visibility === 'public' ? 'active' : ''}`} onClick={() => setDraftMeta({ ...draftMeta, visibility: 'public' })}>
                <span className="radio" /> Publica <small>Qualquer pessoa pode ver</small>
              </button>
              <button className={`choice ${draftMeta.visibility === 'private' ? 'active' : ''}`} onClick={() => setDraftMeta({ ...draftMeta, visibility: 'private' })}>
                <span className="radio" /> Privada <small>Apenas voce pode ver</small>
              </button>
            </div>
            <div className={collectionOk ? 'success' : 'error'}>
              {collectionOk ? 'A collection esta pronta para publicar.' : 'Adicione ao menos um arquivo valido antes de publicar.'}
            </div>
            <div className="stage-actions">
              <button className="btn btn-primary" onClick={publishCollection} disabled={publishState.loading || !collectionOk}>
                {publishState.loading ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />}
                {editingCollection ? 'Criar revisao' : 'Publicar collection'}
              </button>
            </div>
            {publishState.error ? <div className="error">{publishState.error}</div> : null}
          </div>
          <aside className="publish-summary">
            <div className="side-head">
              <strong>Mods na collection</strong>
              <span>{collection.length}</span>
            </div>
            <div className="publish-mod-list">
              {collection.length ? collection.map((item, index) => (
                <article className="publish-mod-item" key={item.localId}>
                  <span className="order-pill">{index + 1}</span>
                  <img src={item.thumbnail || '/mod-placeholder.svg'} alt={item.modName} />
                  <div>
                    <strong>{item.modName}</strong>
                    <span>{item.fileName}</span>
                    <small>Versao {item.fileVersion || '-'} - {formatBytes(item.fileSizeBytes)}</small>
                  </div>
                </article>
              )) : (
                <div className="empty compact-empty">Nenhum arquivo adicionado.</div>
              )}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  function renderSuccess() {
    const result = publishState.data;
    const url = result?.collectionUrl || (editingCollection?.url ?? 'https://next.nexusmods.com/collections');

    return (
      <section className="stage-card success-stage">
        {renderPageHeading(
          editingCollection ? 'Revisao criada' : 'Collection publicada',
          'Publicacao concluida e pronta para revisao.'
        )}
        <div className="success-content">
          <div className="big-check"><Check size={58} /></div>
          <h2>{editingCollection ? 'Revisao criada com sucesso!' : 'Collection publicada com sucesso!'}</h2>
          <p>Os dados foram enviados com descricao e arquivos selecionados no manifesto.</p>
        <article className="published-card">
          <img src={draft.coverImage || '/mod-placeholder.svg'} alt={draft.title} />
          <div>
            <h3>{draft.title}</h3>
            <p>{draft.description || 'Sem descricao.'}</p>
            <div className="mod-meta">
              <span>{collection.length} arquivos</span>
              {result?.revisionId ? <span>Revision {result.revisionId}</span> : null}
            </div>
          </div>
        </article>
        <div className="copy-url">
          <span>{url}</span>
          <button className="icon-btn" title="Copiar" onClick={() => navigator.clipboard?.writeText(url)}><Copy size={16} /></button>
        </div>
        <div className="stage-actions center">
          <button className="btn" onClick={() => setView('builder')}>Continuar editando</button>
          <button className="btn btn-primary" onClick={startCreate}>Nova collection</button>
        </div>
        </div>
      </section>
    );
  }

  function renderView() {
    if (view === 'dashboard') return renderDashboard();
    if (view === 'my-collections') return renderMyCollections();
    if (view === 'game') return renderGame();
    if (view === 'builder') return renderBuilder();
    if (view === 'publish') return renderPublish();
    if (view === 'success') return renderSuccess();
    return null;
  }

  if (!authed) return renderLogin();

  return (
    <main className="app-shell no-chrome">
      {renderTopbar()}
      {renderView()}
    </main>
  );
}
