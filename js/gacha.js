// ============================
// ガチャシステム
// ============================
const Gacha = (() => {
  const COST = 200;
  const STOCK_EXPAND_COST = 500;

  function roll() {
    const stock = Storage.getStock();
    const limit = Storage.getStockLimit();

    if (stock.length >= limit) {
      showResult('ノミモノたちが既にいっぱいです！\nストックに空きを作ってからガチャを回してね。', null);
      return;
    }

    if (!Storage.useSugar(COST)) {
      showResult(`角砂糖が足りません！\n必要: ${COST}個 / 所持: ${Storage.getUserSugar()}個`, null);
      return;
    }

    const result = draw();
    if (!result) {
      Storage.addSugar(COST); // 失敗時は返金
      showResult('排出できるキャラがいません', null);
      return;
    }

    stock.push(result.id);
    Storage.setStock(stock);
    Storage.addEncAlly(result.id);

    document.getElementById('gacha-sugar').textContent = Storage.getUserSugar();
    App.updateMenuSugar();
    showResult(null, result);
  }

  function draw() {
    // 排出率の合計を計算
    const total = ALLY_DATA.reduce((s, a) => s + a.rarity, 0);
    if (total <= 0) return null;

    let rand = Math.random() * total;
    for (const ally of ALLY_DATA) {
      rand -= ally.rarity;
      if (rand <= 0) return ally;
    }
    return ALLY_DATA[ALLY_DATA.length - 1];
  }

  // ストック拡張: 角砂糖500個消費でストック上限を+1する（永続）
  function expandStock() {
    if (!Storage.useSugar(STOCK_EXPAND_COST)) {
      showMessage(`角砂糖が足りません！\n必要: ${STOCK_EXPAND_COST}個 / 所持: ${Storage.getUserSugar()}個`, 'error');
      return;
    }

    Storage.addStockExpansion(1);

    document.getElementById('gacha-sugar').textContent = Storage.getUserSugar();
    App.updateMenuSugar();
    updateStockDisplay();
    showMessage(`ノミモノたちのストックが1つ増えました！\n現在の上限: ${Storage.getStockLimit()}体`, 'info');
  }

  function showMessage(msg, type) {
    const el = document.getElementById('gacha-result');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="gacha-${type}">${msg}</div>`;
  }

  function updateStockDisplay() {
    document.getElementById('gacha-stock-count').textContent = Storage.getStock().length;
    document.getElementById('gacha-stock-limit').textContent = Storage.getStockLimit();
  }

  function showResult(errorMsg, ally) {
    const el = document.getElementById('gacha-result');
    el.classList.remove('hidden');

    if (errorMsg) {
      el.innerHTML = `<div class="gacha-error">${errorMsg}</div>`;
      return;
    }

    const isNew = !Storage.getEncAllies().includes(ally.id);
    el.innerHTML = `
      <div class="gacha-card ${isNew ? 'gacha-new' : ''}">
        <div class="gacha-badge">${isNew ? '✨ NEW！' : '💫 ゲット！'}</div>
        <img src="${ally.images.normal}" alt="${ally.name}" class="gacha-img"
          onerror="this.style.visibility='hidden'">
        <p class="gacha-name">${ally.name}</p>
        <p class="gacha-stats">攻撃力: ${ally.attack} / Lv.${ally.level}</p>
        <p class="gacha-rarity">排出率: ${ally.rarity}%</p>
      </div>
    `;
    // 白背景透過
    const gImg = el.querySelector('.gacha-img');
    if (gImg) processStaticImg(gImg);
  }

  function renderGachaScreen() {
    document.getElementById('gacha-sugar').textContent = Storage.getUserSugar();
    document.getElementById('gacha-result').classList.add('hidden');
    document.getElementById('gacha-result').innerHTML = '';
    updateStockDisplay();
  }

  return { roll, expandStock, renderGachaScreen };
})();
