let elements = {
  extensionToggle: document.querySelector('.extension-toggle'),
  extensionContainer: document.querySelector('.extension-container'),
  emotes: document.querySelector('.emotes'),
  emoteCount: document.querySelector('.emote-count'),
  searchInput: document.querySelector('.search-input'),
  sortSelect: document.querySelector('.sort-select'),
  animToggle: document.querySelector('.anim-toggle'),
};

// Skeleton placeholders
elements.emotes.innerHTML = Array(12).fill(
  `<div class="skeleton"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`
).join('');

Twitch.ext.onAuthorized(async (auth) => {
  const data = await (
    await fetch(`https://7tv.io/v3/users/twitch/${auth.channelId}`)
  ).json();

  const allEmotes = data.emote_set?.emotes;

  if (!allEmotes || allEmotes.length === 0) {
    elements.emotes.innerHTML = '<p class="status-message">No 7TV emotes on this channel.</p>';
    return;
  }

  if (elements.emoteCount) {
    elements.emoteCount.textContent = `${allEmotes.length} emotes`;
  }

  function buildEmoteElement(emote) {
    const emoteElement = document.createElement('a');
    emoteElement.href = `https://7tv.app/emotes/${emote.data.id}`;
    emoteElement.classList.add('emote');
    emoteElement.target = '_blank';
    emoteElement.dataset.name = emote.name.toLowerCase();
    emoteElement.dataset.animated = emote.data.animated ? 'true' : 'false';

    const imgContainer = document.createElement('div');
    imgContainer.classList.add('emote-image-container');

    const img = document.createElement('img');
    const imgFile = emote.data.host.files.find(f => f.name === '2x.webp') || emote.data.host.files[1] || emote.data.host.files[0];
    img.src = `https:${emote.data.host.url}/${imgFile.name}`;
    img.classList.add('emote-image');
    img.loading = 'lazy';
    img.alt = emote.name;
    imgContainer.appendChild(img);
    emoteElement.appendChild(imgContainer);

    const info = document.createElement('div');
    info.classList.add('emote-info');

    const name = document.createElement('p');
    name.textContent = emote.name;
    name.classList.add('emote-name');
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.classList.add('emote-meta');

    if (emote.data.owner?.display_name) {
      const creator = document.createElement('span');
      creator.textContent = `by ${emote.data.owner.display_name}`;
      creator.classList.add('emote-creator');
      meta.appendChild(creator);
    }

    if (emote.data.animated) {
      const badge = document.createElement('span');
      badge.textContent = 'GIF';
      badge.classList.add('emote-badge');
      meta.appendChild(badge);
    }

    info.appendChild(meta);
    emoteElement.appendChild(info);

    return emoteElement;
  }

  function renderEmotes() {
    const query = elements.searchInput?.value.toLowerCase().trim() || '';
    const sort = elements.sortSelect?.value || 'default';
    const animOnly = elements.animToggle?.dataset.active === 'true';

    let filtered = allEmotes.filter(e => {
      if (query && !e.name.toLowerCase().includes(query)) return false;
      if (animOnly && !e.data.animated) return false;
      return true;
    });

    if (sort === 'az') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'za') filtered.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === 'newest') filtered.sort((a, b) => b.timestamp - a.timestamp);

    elements.emotes.innerHTML = '';

    if (filtered.length === 0) {
      elements.emotes.innerHTML = `<p class="status-message">No results for "${query || (animOnly ? 'animated' : '')}"</p>`;
      return;
    }

    filtered.forEach(emote => elements.emotes.appendChild(buildEmoteElement(emote)));
  }

  renderEmotes();

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
