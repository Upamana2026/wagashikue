// ============================
// LocalStorage ラッパー
// ============================
const Storage = (() => {
  const KEYS = {
    USER_LEVEL:  'wq_userLevel',
    USER_EXP:    'wq_userExp',
    USER_SUGAR:  'wq_userSugar',
    STOCK:       'wq_stock',
    QUIZ_SETS:   'wq_quizSets',
    ENC_ALLIES:  'wq_encAllies',
    ENC_ENEMIES: 'wq_encEnemies',
    INIT_GRANTED:'wq_initialGranted',
  };

  function _get(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : JSON.parse(v);
    } catch { return def; }
  }

  function _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ユーザーデータ
  function getUserLevel()  { return _get(KEYS.USER_LEVEL, 1); }
  function getUserExp()    { return _get(KEYS.USER_EXP, 0); }
  function getUserSugar()  { return _get(KEYS.USER_SUGAR, 0); }
  function setUserLevel(v) { _set(KEYS.USER_LEVEL, v); }
  function setUserExp(v)   { _set(KEYS.USER_EXP, v); }
  function setUserSugar(v) { _set(KEYS.USER_SUGAR, v); }

  // ストック (ally id の配列)
  function getStock()      { return _get(KEYS.STOCK, []); }
  function setStock(arr)   { _set(KEYS.STOCK, arr); }

  // クイズセット
  function getQuizSets()   { return _get(KEYS.QUIZ_SETS, {}); }
  function setQuizSets(obj){ _set(KEYS.QUIZ_SETS, obj); }

  // 図鑑
  function getEncAllies()    { return _get(KEYS.ENC_ALLIES, []); }
  function getEncEnemies()   { return _get(KEYS.ENC_ENEMIES, []); }
  function addEncAlly(id)    {
    const arr = getEncAllies();
    if (!arr.includes(id)) { arr.push(id); _set(KEYS.ENC_ALLIES, arr); }
  }
  function addEncEnemy(id)   {
    const arr = getEncEnemies();
    if (!arr.includes(id)) { arr.push(id); _set(KEYS.ENC_ENEMIES, arr); }
  }

  // ストック上限計算
  function getStockLimit() {
    const lv = getUserLevel();
    if (lv < 10) return 2;
    // Lv10で3体、以降10レベルごとに+1（Lv10→3, Lv20→4, Lv30→5 ...）
    return Math.floor(lv / 10) + 2;
  }

  // 次レベルまでの必要経験値
  function expToNextLevel(lv) { return lv * 102; }

  // 経験値加算・レベルアップ処理 → レベルアップ回数を返す
  function addExp(amount) {
    let lv  = getUserLevel();
    let exp = getUserExp() + amount;
    let leveled = 0;
    while (exp >= expToNextLevel(lv)) {
      exp -= expToNextLevel(lv);
      lv++;
      leveled++;
    }
    setUserLevel(lv);
    setUserExp(exp);
    return leveled;
  }

  // 角砂糖加算
  function addSugar(amount) { setUserSugar(getUserSugar() + amount); }
  function useSugar(amount) {
    const cur = getUserSugar();
    if (cur < amount) return false;
    setUserSugar(cur - amount);
    return true;
  }

  // ★テスト用: true の間は、既存セーブがあっても起動のたびに
  //   ストックを「初期キャラ（isInitial:true）」へ強制リセットする。
  //   通常運用に戻すときは false にする。
  const TEST_FORCE_INITIAL_STOCK = false;

  // 初期化（初回起動）
  function initIfNew() {
    const fresh = _get(KEYS.USER_LEVEL, null) === null;

    if (fresh) {
      setUserLevel(1);
      setUserExp(0);
      setUserSugar(0);

      // デフォルト科目を追加
      const qs = getQuizSets();
      if (!qs[DEFAULT_QUIZ_SUBJECT]) {
        qs[DEFAULT_QUIZ_SUBJECT] = DEFAULT_QUIZ_DATA[DEFAULT_QUIZ_SUBJECT];
        setQuizSets(qs);
      }
    }

    // 初回 or テスト強制時は、初期味方キャラをストックへ設定
    if (fresh || TEST_FORCE_INITIAL_STOCK) {
      const initialAllies = ALLY_DATA.filter(a => a.isInitial).map(a => a.id);
      setStock(initialAllies);
      initialAllies.forEach(id => addEncAlly(id));
    }

    // 初期キャラ（紅茶など isInitial:true）の付与がまだなら、
    // 既存セーブに対しても一度だけ補充する。
    // ※ これ以降にユーザーが任意で解放した場合は再付与しない（フラグで制御）。
    if (_get(KEYS.INIT_GRANTED, false) !== true) {
      const stock = getStock();
      ALLY_DATA.filter(a => a.isInitial).forEach(a => {
        if (!stock.includes(a.id)) stock.push(a.id);
        addEncAlly(a.id);
      });
      setStock(stock);
      _set(KEYS.INIT_GRANTED, true);
    }
  }

  return {
    getUserLevel, getUserExp, getUserSugar,
    setUserLevel, setUserExp, setUserSugar,
    getStock, setStock,
    getQuizSets, setQuizSets,
    getEncAllies, getEncEnemies, addEncAlly, addEncEnemy,
    getStockLimit, expToNextLevel, addExp, addSugar, useSugar,
    initIfNew
  };
})();
