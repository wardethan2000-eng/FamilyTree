import type { ArchiveExportManifest } from "./types.js";

export function buildOfflineViewerHtml(
  manifest: ArchiveExportManifest,
): string {
  const encoded = JSON.stringify(manifest).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const treeName = escapeHtml(manifest.tree.name);
  const collectionName = escapeHtml(manifest.collection.name);
  const exportDate = new Date(manifest.exportedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const peopleJson = buildPeopleJson(manifest);
  const memoriesJson = buildMemoriesJson(manifest);
  const relationshipsJson = buildRelationshipsJson(manifest);
  const mediaJson = buildMediaJson(manifest);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${collectionName} — Tessera Archive</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --paper: #F6F1E7;
      --paper-deep: #EDE6D6;
      --ink: #1C1915;
      --ink-soft: #403A2E;
      --ink-faded: #847A66;
      --rule: #D9D0BC;
      --moss: #4E5D42;
      --moss-light: #6B7C5E;
    }
    body { margin: 0; padding: 0; font-family: 'Georgia', serif; background: var(--paper); color: var(--ink); }
    header {
      background: var(--paper-deep); border-bottom: 1px solid var(--rule);
      padding: 16px 24px; display: flex; align-items: baseline; gap: 16px;
      position: sticky; top: 0; z-index: 100;
    }
    header h1 { margin: 0; font-size: 20px; font-weight: 400; }
    header p { margin: 0; font-size: 11px; color: var(--ink-faded); font-family: sans-serif; }
    .layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 53px); }
    .sidebar {
      border-right: 1px solid var(--rule); overflow-y: auto;
      position: sticky; top: 53px; height: calc(100vh - 53px);
    }
    .sidebar-heading {
      font-family: sans-serif; font-size: 10px; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--ink-faded); padding: 16px 16px 8px;
    }
    .person-btn {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 16px; background: none; border: none; border-bottom: 1px solid var(--rule);
      cursor: pointer; text-align: left; color: var(--ink);
    }
    .person-btn:hover { background: var(--paper-deep); }
    .person-btn.active { background: var(--paper-deep); }
    .person-btn .initial {
      width: 32px; height: 32px; border-radius: 50%; background: var(--paper-deep);
      border: 1px solid var(--rule); display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: var(--ink-faded); flex-shrink: 0; overflow: hidden;
    }
    .person-btn .initial img { width: 100%; height: 100%; object-fit: cover; }
    .person-btn .info .name { font-size: 13px; }
    .person-btn .info .dates { font-size: 11px; color: var(--ink-faded); font-family: sans-serif; margin-top: 2px; }
    .content { padding: 32px 40px; max-width: 800px; }
    .person-header { margin-bottom: 28px; }
    .person-header h2 { font-size: 32px; font-weight: 400; margin: 0 0 4px; }
    .person-header .dates { font-size: 14px; color: var(--ink-faded); font-family: sans-serif; }
    .person-header .essence { font-size: 15px; color: var(--ink-soft); margin-top: 8px; font-style: italic; }
    .person-portrait {
      width: 100px; height: 100px; border-radius: 50%; object-fit: cover;
      border: 2px solid var(--rule); margin-bottom: 16px; display: block;
    }
    .section-heading {
      font-family: sans-serif; font-size: 10px; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--ink-faded); margin: 28px 0 12px;
      padding-bottom: 8px; border-bottom: 1px solid var(--rule);
    }
    .memory-card {
      background: var(--paper-deep); border: 1px solid var(--rule);
      border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; cursor: pointer;
      transition: border-color 0.15s;
    }
    .memory-card:hover { border-color: var(--moss-light); }
    .memory-card img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; }
    .memory-card .m-title { font-size: 15px; margin: 0 0 4px; }
    .memory-card .m-date { font-size: 11px; color: var(--ink-faded); font-family: sans-serif; }
    .memory-card .m-body { font-size: 13px; color: var(--ink-soft); margin-top: 8px; line-height: 1.6; }
    .memory-card .m-kind {
      font-family: sans-serif; font-size: 10px; letter-spacing: 0.05em;
      text-transform: uppercase; color: var(--moss); margin-bottom: 6px;
    }
    .memory-card .m-transcript {
      font-size: 12px; color: var(--ink-faded); font-style: italic;
      margin-top: 8px; padding: 8px; background: var(--paper); border-radius: 4px;
    }
    .relation-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px; border: 1px solid var(--rule); border-radius: 20px;
      font-family: sans-serif; font-size: 12px; color: var(--ink-soft);
      margin: 4px 4px 4px 0; cursor: pointer; transition: background 0.15s;
    }
    .relation-chip:hover { background: var(--paper-deep); }
    .tag-chip {
      display: inline-block; padding: 2px 8px; background: var(--moss);
      color: white; border-radius: 10px; font-family: sans-serif; font-size: 11px;
      margin: 2px;
    }
    .empty { color: var(--ink-faded); font-family: sans-serif; font-size: 13px; font-style: italic; }

    #memory-detail { display: none; }
    #memory-detail.active { display: block; }
    .detail-back {
      font-family: sans-serif; font-size: 13px; color: var(--moss);
      cursor: pointer; margin-bottom: 16px; display: inline-block;
    }
    .detail-back:hover { text-decoration: underline; }
    .detail-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: 16px; }
    .detail-media-grid img { width: 100%; border-radius: 4px; cursor: pointer; }
    .detail-media-grid video, .detail-media-grid audio { width: 100%; }

    .search-input {
      width: 100%; padding: 8px 12px; border: 1px solid var(--rule);
      border-radius: 4px; font-size: 13px; font-family: sans-serif;
      margin-bottom: 8px; background: var(--paper);
    }
    .search-input:focus { outline: none; border-color: var(--moss); }

    footer {
      border-top: 1px solid var(--rule); padding: 16px 24px;
      font-family: sans-serif; font-size: 11px; color: var(--ink-faded);
    }

    #welcome { padding: 48px 40px; max-width: 500px; }
    #welcome h2 { font-size: 28px; font-weight: 400; margin: 0 0 12px; }
    #welcome p { font-size: 15px; color: var(--ink-soft); line-height: 1.7; }

    .noscript-fallback {
      font-family: Georgia, serif; max-width: 600px; margin: 2em auto; padding: 2em;
    }
    .noscript-fallback h1 { font-size: 24px; }
    .noscript-fallback h2 { font-size: 18px; margin-top: 1em; }
  </style>
</head>
<body>
  <header>
    <h1>${collectionName}</h1>
    <p>Offline archive &middot; exported ${exportDate}</p>
  </header>
  <div class="layout">
    <nav class="sidebar">
      <input type="text" class="search-input" placeholder="Search people and memories..." id="search" />
      <div class="sidebar-heading">People</div>
      <div id="person-list"></div>
    </nav>
    <main id="main">
      <div id="welcome">
        <h2>${collectionName}</h2>
        <p>Select a person from the sidebar to explore their memories and connections.</p>
      </div>
    </main>
  </div>
  <footer>Tessera &middot; private family archive &middot; ${collectionName} &middot; exported ${escapeHtml(exportDate)}</footer>

  <noscript>
    <div class="noscript-fallback">
      <h1>${collectionName}</h1>
      <p>This local archive requires JavaScript to function fully.</p>
      ${manifest.people.map((p) => `<h2>${escapeHtml(p.displayName)}</h2><p>${escapeHtml(p.birthDateText ?? '')}${p.deathDateText ? ' &ndash; ' + escapeHtml(p.deathDateText) : ''}</p>${p.essenceLine ? '<p><em>' + escapeHtml(p.essenceLine) + '</em></p>' : ''}`).join('')}
    </div>
  </noscript>

  <script>
    const MANIFEST = ${encoded};

    const PEOPLE = ${peopleJson};
    const MEMORIES = ${memoriesJson};
    const RELATIONSHIPS = ${relationshipsJson};
    const MEDIA_MAP = ${mediaJson};

    const peopleMap = {};
    PEOPLE.forEach(p => { peopleMap[p.id] = p; });
    const memoriesByPerson = {};
    MEMORIES.forEach(m => {
      if (!memoriesByPerson[m.primaryPersonId]) memoriesByPerson[m.primaryPersonId] = [];
      memoriesByPerson[m.primaryPersonId].push(m);
      if (m.taggedPersonIds) {
        m.taggedPersonIds.forEach(pid => {
          if (!memoriesByPerson[pid]) memoriesByPerson[pid] = [];
          if (!memoriesByPerson[pid].find(x => x.id === m.id)) {
            memoriesByPerson[pid].push(m);
          }
        });
      }
    });
    const relsByPerson = {};
    RELATIONSHIPS.forEach(r => {
      if (!relsByPerson[r.fromPersonId]) relsByPerson[r.fromPersonId] = [];
      if (!relsByPerson[r.toPersonId]) relsByPerson[r.toPersonId] = [];
      relsByPerson[r.fromPersonId].push({ ...r, otherId: r.toPersonId });
      relsByPerson[r.toPersonId].push({ ...r, otherId: r.fromPersonId });
    });

    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function relLabel(type, fromId, toId, currentId) {
      if (type === 'parent_child') return currentId === toId ? 'Parent' : 'Child';
      if (type === 'spouse') return 'Spouse';
      if (type === 'sibling') return 'Sibling';
      return type;
    }
    function mediaSrc(mediaId) {
      const m = MEDIA_MAP[mediaId];
      return m ? m.localPath : null;
    }
    function kindLabel(kind) {
      const labels = { story: 'Story', photo: 'Photo', voice: 'Voice', document: 'Document', other: 'Memory' };
      return labels[kind] || 'Memory';
    }

    // Search
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('.person-btn').forEach(btn => {
        const name = btn.dataset.name || '';
        btn.style.display = (!q || name.toLowerCase().includes(q)) ? '' : 'none';
      });
    });

    // Render sidebar
    const list = document.getElementById('person-list');
    const sorted = [...PEOPLE].sort((a,b) => a.displayName.localeCompare(b.displayName));
    sorted.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'person-btn';
      btn.dataset.id = p.id;
      btn.dataset.name = p.displayName;
      const imgSrc = p.portraitMediaId ? mediaSrc(p.portraitMediaId) : null;
      const dateStr = [p.birthDateText, p.deathDateText ? '– '+p.deathDateText : (p.birthDateText ? '–' : '')].filter(Boolean).join(' ');
      btn.innerHTML = (
        '<span class="initial">' + (imgSrc ? '<img src="'+esc(imgSrc)+'" alt="" onerror="this.parentNode.textContent=\\''+esc(p.displayName.charAt(0))+'\\'"/>' : esc(p.displayName.charAt(0))) + '</span>' +
        '<span class="info"><div class="name">' + esc(p.displayName) + '</div>' +
        (dateStr ? '<div class="dates">' + esc(dateStr) + '</div>' : '') +
        '</span>'
      );
      btn.onclick = () => showPerson(p.id);
      list.appendChild(btn);
    });

    function showPerson(id) {
      const p = peopleMap[id];
      if (!p) return;
      document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('[data-id="'+id+'"]');
      if (btn) btn.classList.add('active');

      const mems = (memoriesByPerson[id] || []).sort((a,b) => (a.dateOfEventText||'').localeCompare(b.dateOfEventText||''));
      const rels = relsByPerson[id] || [];
      const imgSrc = p.portraitMediaId ? mediaSrc(p.portraitMediaId) : null;
      const dateStr = [p.birthDateText, p.deathDateText ? '– '+p.deathDateText : (p.birthDateText ? '–' : '')].filter(Boolean).join(' ');

      let html = '<div class="content"><div class="person-header">';
      if (imgSrc) html += '<img class="person-portrait" src="'+esc(imgSrc)+'" alt="'+esc(p.displayName)+'" onerror="this.style.display=\\'none\\'"/>';
      html += '<h2>'+esc(p.displayName)+'</h2>';
      if (dateStr) html += '<div class="dates">'+esc(dateStr)+'</div>';
      if (p.essenceLine) html += '<div class="essence">'+esc(p.essenceLine)+'</div>';
      html += '</div>';

      if (rels.length > 0) {
        html += '<div class="section-heading">Connections</div><div>';
        rels.forEach(r => {
          const other = peopleMap[r.otherId];
          if (!other) return;
          html += '<span class="relation-chip" onclick="showPerson(\\''+esc(r.otherId)+'\\')">'+esc(relLabel(r.type, r.fromPersonId, r.toPersonId, id))+' &middot; '+esc(other.displayName)+'</span>';
        });
        html += '</div>';
      }

      html += '<div class="section-heading">Memories ('+mems.length+')</div>';
      if (mems.length === 0) {
        html += '<p class="empty">No memories recorded yet.</p>';
      } else {
        mems.forEach(m => {
          const mImg = m.primaryMediaId ? mediaSrc(m.primaryMediaId) : null;
          html += '<div class="memory-card" onclick="showMemory(\\''+esc(m.id)+'\\')">';
          html += '<div class="m-kind">'+esc(kindLabel(m.kind))+'</div>';
          if (mImg) html += '<img src="'+esc(mImg)+'" alt="" onerror="this.style.display=\\'none\\'"/>';
          html += '<div class="m-title">'+esc(m.title)+'</div>';
          if (m.dateOfEventText) html += '<div class="m-date">'+esc(m.dateOfEventText)+'</div>';
          if (m.body) html += '<div class="m-body">'+esc(m.body).substring(0, 200)+'</div>';
          html += '</div>';
        });
      }

      html += '</div>';
      document.getElementById('main').innerHTML = html;
      window.scrollTo({ top: 0 });
    }

    function showMemory(id) {
      const m = MEMORIES.find(x => x.id === id);
      if (!m) return;
      const p = peopleMap[m.primaryPersonId];
      const img = m.primaryMediaId ? mediaSrc(m.primaryMediaId) : null;

      let html = '<div class="content"><span class="detail-back" onclick="showPerson(\\''+esc(m.primaryPersonId)+'\\')">&larr; Back to '+esc(p?.displayName || 'person')+'</span>';
      html += '<div class="person-header" style="margin-top:16px">';
      if (img) html += '<img class="person-portrait" src="'+esc(img)+'" alt="" onerror="this.style.display=\\'none\\'"/>';
      html += '<h2>'+esc(m.title)+'</h2>';
      if (m.dateOfEventText) html += '<div class="dates">'+esc(m.dateOfEventText)+'</div>';
      if (m.placeLabel) html += '<div class="dates">'+esc(m.placeLabel)+'</div>';
      html += '</div>';

      // All media
      if (m.mediaIds.length > 1 || (m.mediaIds.length === 1 && img)) {
        html += '<div class="section-heading">Media</div><div class="detail-media-grid">';
        m.mediaIds.forEach(mid => {
          const msrc = mediaSrc(mid);
          if (!msrc) return;
          if (msrc.endsWith('.mp4') || msrc.endsWith('.mov') || msrc.endsWith('.webm')) {
            html += '<video controls src="'+esc(msrc)+'" style="width:100%;border-radius:4px"></video>';
          } else if (msrc.endsWith('.mp3') || msrc.endsWith('.m4a') || msrc.endsWith('.wav') || msrc.endsWith('.ogg') || msrc.endsWith('.flac') || msrc.endsWith('.webm')) {
            html += '<audio controls src="'+esc(msrc)+'" style="width:100%"></audio>';
          } else {
            html += '<img src="'+esc(msrc)+'" alt="" onerror="this.style.display=\\'none\\'"/>';
          }
        });
        html += '</div>';
      }

      if (m.body) html += '<div style="font-size:15px;line-height:1.7;margin-top:16px;white-space:pre-wrap">'+esc(m.body)+'</div>';
      if (m.transcriptText) html += '<div class="section-heading">Transcript</div><div class="m-transcript">'+esc(m.transcriptText)+'</div>';

      // Tagged people
      if (m.taggedPersonIds && m.taggedPersonIds.length > 0) {
        html += '<div class="section-heading">People</div><div>';
        m.taggedPersonIds.forEach(pid => {
          const tp = peopleMap[pid];
          if (tp) html += '<span class="tag-chip" onclick="showPerson(\\''+esc(pid)+'\\')">'+esc(tp.displayName)+'</span>';
        });
        html += '</div>';
      }

      // Perspectives
      if (m.perspectiveIds && m.perspectiveIds.length > 0) {
        html += '<div class="section-heading">Perspectives</div>';
        m.perspectiveIds.forEach(persp => {
          html += '<div style="margin-bottom:12px;padding:12px;background:var(--paper-deep);border-radius:4px">';
          if (persp.contributorName) html += '<div style="font-family:sans-serif;font-size:12px;color:var(--ink-faded);margin-bottom:4px">'+esc(persp.contributorName)+'</div>';
          if (persp.body) html += '<div style="font-size:14px;line-height:1.6;white-space:pre-wrap">'+esc(persp.body)+'</div>';
          html += '</div>';
        });
      }

      html += '</div>';
      document.getElementById('main').innerHTML = html;
      window.scrollTo({ top: 0 });
    }

    // Show first person by default
    if (sorted.length > 0) showPerson(sorted[0].id);
  </script>
</body>
</html>`;
}

function buildPeopleJson(manifest: ArchiveExportManifest): string {
  const people = manifest.people.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    birthDateText: p.birthDateText,
    deathDateText: p.deathDateText,
    essenceLine: p.essenceLine,
    portraitMediaId: p.portraitMediaId,
    relationshipIds: p.relationshipIds,
    memoryIds: p.memoryIds,
  }));
  return JSON.stringify(people).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function buildMemoriesJson(manifest: ArchiveExportManifest): string {
  const memories = manifest.memories.map((m) => ({
    id: m.id,
    primaryPersonId: m.primaryPersonId,
    title: m.title,
    kind: m.kind,
    body: m.body,
    dateOfEventText: m.dateOfEventText,
    placeLabel: m.placeLabel,
    transcriptText: m.transcriptText,
    mediaIds: m.mediaIds,
    primaryMediaId: m.primaryMediaId,
    taggedPersonIds: m.taggedPersonIds,
    perspectiveIds: m.perspectiveIds,
    contributorName: m.contributorName,
  }));
  return JSON.stringify(memories).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function buildRelationshipsJson(manifest: ArchiveExportManifest): string {
  return JSON.stringify(manifest.relationships).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function buildMediaJson(manifest: ArchiveExportManifest): string {
  const map: Record<string, { localPath: string; mimeType: string }> = {};
  for (const m of manifest.media) {
    map[m.id] = { localPath: m.localPath, mimeType: m.mimeType };
  }
  return JSON.stringify(map).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}