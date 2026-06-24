// ============================
// メインアプリコントローラー
// ============================
const App = (() => {
  const screens = {
    menu:          'screen-menu',
    'subject-select': 'screen-subject-select',
    battle:        'screen-battle',
    stock:         'screen-stock',
    gacha:         'screen-gacha',
    encyclopedia:  'screen-encyclopedia',
    'quiz-manage': 'screen-quiz-manage',
  };

  let currentScreen = 'menu';

  function goTo(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const id = screens[name];
    if (!id) return;
    document.getElementById(id).classList.add('active');
    currentScreen = name;
    onEnterScreen(name);
  }

  function onEnterScreen(name) {
    switch (name) {
      case 'menu':
        updateMenuInfo();
        break;
      case 'subject-select':
        QuizManager.renderSubjectSelect();
        break;
      case 'stock':
        renderStockScreen();
        break;
      case 'gacha':
        Gacha.renderGachaScreen();
        break;
      case 'encyclopedia':
        Encyclopedia.init();
        break;
      case 'quiz-manage':
        QuizManager.initQuizManageScreen();
        break;
    }
  }

  function updateMenuInfo() {
    const lv  = Storage.getUserLevel();
    const exp = Storage.getUserExp();
    const need = Storage.expToNextLevel(lv);
    const sugar = Storage.getUserSugar();
    document.getElementById('menu-level').textContent = `Lv.${lv}`;
    document.getElementById('menu-exp').textContent = `EXP ${exp}/${need}`;
    document.getElementById('menu-sugar').textContent = `🍬 ${sugar}`;
  }

  function updateMenuSugar() {
    document.getElementById('menu-sugar').textContent = `🍬 ${Storage.getUserSugar()}`;
  }

  // ==== ストック画面 ====

  function renderStockScreen() {
    const stock = Storage.getStock();
    const limit = Storage.getStockLimit();
    document.getElementById('stock-limit-text').textContent = `${limit}体`;
    document.getElementById('stock-count-text').textContent = `${stock.length}体`;

    const el = document.getElementById('stock-list');
    if (stock.length === 0) {
      el.innerHTML = '<p class="empty-msg">ストックが空です。ガチャで仲間を増やしましょう！</p>';
      return;
    }

    el.innerHTML = stock.map((id, i) => {
      const ally = ALLY_DATA.find(a => a.id === id);
      if (!ally) return '';
      return `
        <div class="stock-item" id="stock-item-${i}" draggable="true"
          ondragstart="App.dragStart(${i})" ondragover="App.dragOver(event,${i})"
          ondrop="App.drop(${i})" ondragend="App.dragEnd()">
          <span class="stock-order">${i + 1}</span>
          <img src="${ally.images.normal}" alt="${ally.name}" class="stock-img"
            onerror="this.style.visibility='hidden'">
          <div class="stock-info">
            <span class="stock-name">${ally.name}</span>
            <span class="stock-stats">ATK:${ally.attack} Lv.${ally.level}</span>
          </div>
          <div class="stock-actions">
            ${i > 0 ? `<button class="btn-small" onclick="App.moveStock(${i},-1)">▲</button>` : ''}
            ${i < stock.length-1 ? `<button class="btn-small" onclick="App.moveStock(${i},1)">▼</button>` : ''}
            <button class="btn-small btn-danger" onclick="App.removeFromStock(${i})">解放</button>
          </div>
        </div>
      `;
    }).join('');
    // 白背景透過
    el.querySelectorAll('.stock-img').forEach(img => processStaticImg(img));
  }

  let dragSrcIndex = null;

  function dragStart(i) { dragSrcIndex = i; }
  function dragOver(e, i) { e.preventDefault(); }
  function drop(i) {
    if (dragSrcIndex === null || dragSrcIndex === i) return;
    const stock = Storage.getStock();
    const item = stock.splice(dragSrcIndex, 1)[0];
    stock.splice(i, 0, item);
    Storage.setStock(stock);
    renderStockScreen();
  }
  function dragEnd() { dragSrcIndex = null; }

  function moveStock(i, dir) {
    const stock = Storage.getStock();
    const ni = i + dir;
    if (ni < 0 || ni >= stock.length) return;
    [stock[i], stock[ni]] = [stock[ni], stock[i]];
    Storage.setStock(stock);
    renderStockScreen();
  }

  function removeFromStock(i) {
    const stock = Storage.getStock();
    const ally = ALLY_DATA.find(a => a.id === stock[i]);
    if (!confirm(`「${ally ? ally.name : stock[i]}」をストックから外しますか？`)) return;
    stock.splice(i, 1);
    Storage.setStock(stock);
    renderStockScreen();
  }

  // ==== 初期化 ====

  function init() {
    Storage.initIfNew();
    updateMenuInfo();
    goTo('menu');
  }

  return {
    goTo, updateMenuInfo, updateMenuSugar,
    renderStockScreen,
    dragStart, dragOver, drop, dragEnd,
    moveStock, removeFromStock,
    init
  };
})();

// アプリ起動
document.addEventListener('DOMContentLoaded', () => App.init());
