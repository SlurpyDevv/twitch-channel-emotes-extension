let elements = {
  extensionToggle: document.querySelector('.extension-toggle'),
  extensionContainer: document.querySelector('.extension-container'),
  emotes: document.querySelector('.emotes'),
  emoteCount: document.querySelector('.emote-count'),
  searchInput: document.querySelector('.search-input'),
  sortSelect: document.querySelector('.sort-select'),
  animToggle: document.querySelector('.anim-toggle'),
};

let activeTab = '7tv';
let all7tvEmotes = [];
let allTwitchEmotes = [];
let allGlobalEmotes = [];
let twitchUnavailable = false;

elements.emotes.innerHTML = Array(12).fill(
  `<div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`
).join('');

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    renderEmotes();
  });
});

function buildEmoteElement(emote) {
  const el = document.createElement('a');
  el.href = emote.link;
  el.classList.add('emote');
  el.target = '_blank';

  const imgContainer = document.createElement('div');
  imgContainer.classList.add('emote-image-container');
  const img = document.createElement('img');
  img.src = emote.imgSrc;
  img.classList.add('emote-image');
  img.loading = 'eager';
  img.alt = emote.name;
  imgContainer.appendChild(img);
  el.appendChild(imgContainer);

  const info = document.createElement('div');
  info.classList.add('emote-info');

  const name = document.createElement('p');
  name.textContent = emote.name;
  name.classList.add('emote-name');
  info.appendChild(name);

  const meta = document.createElement('div');
  meta.classList.add('emote-meta');

  if (emote.creator) {
    const creator = document.createElement('span');
    creator.textContent = `by ${emote.creator}`;
    creator.classList.add('emote-creator');
    meta.appendChild(creator);
  }

  if (emote.badge) {
    const badge = document.createElement('span');
    badge.textContent = emote.badge.label;
    badge.classList.add('emote-badge');
    if (emote.badge.cls) badge.classList.add(emote.badge.cls);
    meta.appendChild(badge);
  }

  info.appendChild(meta);
  el.appendChild(info);
  return el;
}

function renderEmotes() {
  const query = elements.searchInput?.value.toLowerCase().trim() || '';
  const sort = elements.sortSelect?.value || 'default';
  const animOnly = elements.animToggle?.dataset.active === 'true';

  if ((activeTab === 'twitch' || activeTab === 'global') && twitchUnavailable) {
    elements.emotes.innerHTML = '<p class="status-message">Log in to Twitch to see emotes.</p>';
    return;
  }

  const source = activeTab === '7tv' ? all7tvEmotes : activeTab === 'twitch' ? allTwitchEmotes : allGlobalEmotes;

  let filtered = source.filter(e => {
    if (query && !e.name.toLowerCase().includes(query)) return false;
    if (animOnly && !e.animated) return false;
    return true;
  });

  if (sort === 'az') filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'za') filtered.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === 'newest') filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  elements.emotes.innerHTML = '';

  if (filtered.length === 0) {
    const msg = query ? `"${query}"` : animOnly ? 'animated emotes' : 'emotes';
    elements.emotes.innerHTML = `<p class="status-message">No results for ${msg}</p>`;
    return;
  }

  filtered.forEach(emote => elements.emotes.appendChild(buildEmoteElement(emote)));
}

function normalizeTwitchEmote(e) {
  const animated = e.format?.includes('animated');
  const imgBase = `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}`;
  const imgSrc = animated ? `${imgBase}/animated/dark/2.0` : `${imgBase}/default/dark/2.0`;
  return { name: e.name, imgSrc, link: `https://www.twitch.tv/`, animated, creator: null, badge: null, timestamp: 0 };
}

Twitch.ext.onAuthorized(async (auth) => {
  const helixToken = Twitch.ext.viewer?.helixToken;
  twitchUnavailable = !helixToken;

  const tierLabels = { '1000': { label: 'T1', cls: 'tier1' }, '2000': { label: 'T2', cls: 'tier2' }, '3000': { label: 'T3', cls: 'tier3' } };

  function getCount(tab) {
    if (tab === '7tv') return all7tvEmotes.length;
    if (tab === 'twitch') return allTwitchEmotes.length;
    return allGlobalEmotes.length;
  }

  function updateCount() {
    if (elements.emoteCount) elements.emoteCount.textContent = `${getCount(activeTab)} emotes`;
  }

  function stickyFallback() {
    if (all7tvEmotes.length === 0 && activeTab === '7tv') {
      const fallback = allTwitchEmotes.length > 0 ? 'twitch' : 'global';
      activeTab = fallback;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === fallback));
    }
  }

  fetch(`https://7tv.io/v3/users/twitch/${auth.channelId}`)
    .then(r => r.json())
    .then(data => {
      if (data.emote_set?.emotes?.length) {
        all7tvEmotes = data.emote_set.emotes.map(e => {
          const imgFile = e.data.host.files.find(f => f.name === '2x.webp') || e.data.host.files[1] || e.data.host.files[0];
          return {
            name: e.name,
            imgSrc: `https:${e.data.host.url}/${imgFile.name}`,
            link: `https://7tv.app/emotes/${e.data.id}`,
            animated: e.data.animated,
            creator: e.data.owner?.display_name || null,
            badge: e.data.animated ? { label: 'GIF', cls: '' } : null,
            timestamp: e.timestamp,
          };
        });
      }
      stickyFallback();
      updateCount();
      if (activeTab === '7tv') renderEmotes();
    })
    .catch(() => {
      stickyFallback();
      if (activeTab === '7tv') renderEmotes();
    });

  if (helixToken) {
    fetch(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${auth.channelId}`, {
      headers: { 'Authorization': `Extension ${helixToken}`, 'Client-Id': auth.clientId },
    })
      .then(r => r.json())
      .then(data => {
        if (data.data?.length) {
          allTwitchEmotes = data.data.map(e => {
            const emote = normalizeTwitchEmote(e);
            if (e.emote_type === 'subscriptions' && tierLabels[e.tier]) emote.badge = tierLabels[e.tier];
            else if (e.emote_type === 'follower') emote.badge = { label: 'Follow', cls: 'follower' };
            else if (e.emote_type === 'bitstier') emote.badge = { label: 'Bits', cls: 'bits' };
            else if (emote.animated) emote.badge = { label: 'GIF', cls: '' };
            return emote;
          });
        }
        if (activeTab === 'twitch') { updateCount(); renderEmotes(); }
      })
      .catch(() => { if (activeTab === 'twitch') renderEmotes(); });
  }

  let globalFetched = false;
  async function fetchGlobalEmotes() {
    if (globalFetched) return;
    globalFetched = true;
    if (!helixToken) { twitchUnavailable = true; renderEmotes(); return; }
    elements.emotes.innerHTML = Array(12).fill(
      `<div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`
    ).join('');
    try {
      const res = await fetch(`https://api.twitch.tv/helix/chat/emotes/global`, {
        headers: { 'Authorization': `Extension ${helixToken}`, 'Client-Id': auth.clientId },
      }).then(r => r.json());
      if (res.data?.length) {
        allGlobalEmotes = res.data.map(e => {
          const emote = normalizeTwitchEmote(e);
          emote.badge = emote.animated ? { label: 'GIF', cls: '' } : { label: 'Global', cls: 'global' };
          return emote;
        });
      }
    } catch (_) {}
    updateCount();
    renderEmotes();
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      updateCount();
      if (tab.dataset.tab === 'global') fetchGlobalEmotes();
    });
  });

  if (elements.searchInput) elements.searchInput.addEventListener('input', renderEmotes);
  if (elements.sortSelect) elements.sortSelect.addEventListener('change', renderEmotes);
  if (elements.animToggle) {
    elements.animToggle.addEventListener('click', () => {
      const active = elements.animToggle.dataset.active === 'true';
      elements.animToggle.dataset.active = active ? 'false' : 'true';
      renderEmotes();
    });
  }
});
