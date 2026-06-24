// ============================
// 図鑑システム
// ============================
const Encyclopedia = (() => {
  let currentTab = 'ally';

  function showTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    render();
  }

  function render() {
    const el = document.getElementById('encyclopedia-content');
    if (!el) return;

    if (currentTab === 'ally') {
      renderAllies(el);
    } else {
      renderEnemies(el);
    }
  }

  function renderAllies(el) {
    const collected = Storage.getEncAllies();
    el.innerHTML = ALLY_DATA.map(ally => {
      const isOwned = collected.includes(ally.id);
      return `
        <div class="enc-card ${isOwned ? 'owned' : 'locked'}">
          <div class="enc-img-wrap">
            ${isOwned
              ? `<img src="${ally.images.normal}" alt="${ally.name}" class="enc-img" onerror="this.style.visibility='hidden'">`
              : `<div class="enc-silhouette">？</div>`
            }
          </div>
          <div class="enc-info">
            <p class="enc-name">${isOwned ? ally.name : '???'}</p>
            ${isOwned ? `
              <p class="enc-stats">攻撃力: ${ally.attack} / Lv.${ally.level}</p>
              <p class="enc-desc">${ally.description}</p>
            ` : '<p class="enc-hint">入手で解放</p>'}
          </div>
        </div>
      `;
    }).join('');
    // 白背景透過
    el.querySelectorAll('.enc-img').forEach(img => processStaticImg(img));
  }

  function renderEnemies(el) {
    const collected = Storage.getEncEnemies();
    el.innerHTML = ENEMY_DATA.map(enemy => {
      const isSeen = collected.includes(enemy.id);
      return `
        <div class="enc-card ${isSeen ? 'owned' : 'locked'}">
          <div class="enc-img-wrap">
            ${isSeen
              ? `<img src="${enemy.images.normal}" alt="${enemy.name}" class="enc-img" onerror="this.style.visibility='hidden'">`
              : `<div class="enc-silhouette">？</div>`
            }
          </div>
          <div class="enc-info">
            <p class="enc-name">${isSeen ? enemy.name : '???'}</p>
            ${isSeen ? `
              <p class="enc-stats">攻撃力: ${enemy.attack} / HP: ${enemy.hp}</p>
              <p class="enc-desc">${enemy.description}</p>
            ` : '<p class="enc-hint">倒すと解放</p>'}
          </div>
        </div>
      `;
    }).join('');
    // 白背景透過
    el.querySelectorAll('.enc-img').forEach(img => processStaticImg(img));
  }

  function init() {
    currentTab = 'ally';
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    render();
  }

  return { showTab, init };
})();
