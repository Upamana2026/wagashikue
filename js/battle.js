// ============================
// バトルシステム
// ============================
const Battle = (() => {
  // ★テスト用フラグ: true の間は Wave 制を使わず、
  //   5秒間隔でランダムな敵が出現し続ける（撃破しても勝利にならない無限モード）。
  //   通常のWave制に戻すには false にする。
  const TEST_RANDOM_SPAWN     = false;
  const TEST_SPAWN_INTERVAL_MS = 5000;

  // バトル状態
  let state = null;

  // ================================================
  // 攻撃SE（効果音）— HTMLAudio + 事前解錠(unlock)方式
  // ・味方の攻撃時: CHIPTUNE発射.mp3
  // ・敵の攻撃時  : enemy_attack.mp3（元ファイル: RPGゲームの攻撃・打撃風SE.mp3）
  //
  // ★方針:
  //   味方SEはクリック直後なので元の new Audio+play で鳴っていたが、
  //   敵SEは setInterval の自動攻撃（ユーザー操作の文脈外）から鳴るため
  //   自動再生ポリシーでブロックされ無音だった。
  //   ・Web Audio(fetch+decode)は file:// 配信や一部環境で fetch が通らず
  //     両方無音になったので不採用。
  //   → HTMLAudio のまま、最初のユーザー操作で各<audio>を「無音再生→停止」して
  //     解錠しておき、以降はその要素を使い回して再生する。
  //     解錠済み要素はタイマー由来でも再生できる。重ね再生用に各SEを複数持つ。
  // ・音量・ミュートは端末(OS/ブラウザ)設定に従う（volumeは触らない）。
  // ================================================
  const ALLY_SE_SRC  = './CHIPTUNE発射.mp3';
  const ENEMY_SE_SRC = './enemy_attack.mp3';

  const SE = (() => {
    const POOL_SIZE = 3;  // 重ね再生用に各SEで保持する要素数

    function makePool(src) {
      const arr = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const a = new Audio(src);
        a.preload = 'auto';
        arr.push(a);
      }
      return { arr, idx: 0 };
    }

    const pools = {
      [ALLY_SE_SRC]:  makePool(ALLY_SE_SRC),
      [ENEMY_SE_SRC]: makePool(ENEMY_SE_SRC),
    };

    let unlocked = false;

    // 最初のユーザー操作で全要素を解錠する。
    // 無音(muted)で一瞬 play→pause することで、以降タイマーからでも鳴らせる状態にする。
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      Object.keys(pools).forEach((src) => {
        pools[src].arr.forEach((a) => {
          a.muted = true;
          const p = a.play();
          const restore = () => { try { a.pause(); a.currentTime = 0; } catch (_) {} a.muted = false; };
          if (p && typeof p.then === 'function') p.then(restore).catch(() => { a.muted = false; });
          else restore();
        });
      });
    }

    function arm() {
      const handler = () => {
        unlock();
        document.removeEventListener('pointerdown', handler);
        document.removeEventListener('keydown', handler);
      };
      document.addEventListener('pointerdown', handler);
      document.addEventListener('keydown', handler);
    }
    arm();

    function play(src) {
      const pool = pools[src];
      if (!pool) return;
      const a = pool.arr[pool.idx];
      pool.idx = (pool.idx + 1) % pool.arr.length;
      try { a.currentTime = 0; } catch (_) {}
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});  // ブロック時は無視
    }

    return { play };
  })();

  function playAllySE()  { SE.play(ALLY_SE_SRC); }
  function playEnemySE() { SE.play(ENEMY_SE_SRC); }

  function startBattle(subjectName, suddenDeath = false) {
    const stock = Storage.getStock();
    if (stock.length === 0) {
      showPopup('味方キャラがいません！ガチャで仲間を増やしましょう！');
      return;
    }
    const sets = Storage.getQuizSets();
    const questions = sets[subjectName];
    if (!questions || questions.length === 0) {
      showPopup('問題がありません！クイズ管理から問題を追加してください。');
      return;
    }

    // 味方キャラ生成（ストック順・最大5体）
    const alliesOnField = stock.slice(0, 5).map(id => {
      const data = ALLY_DATA.find(a => a.id === id);
      if (!data) return null;
      return { ...data, currentHp: getAllyMaxHp(data), maxHp: getAllyMaxHp(data) };
    }).filter(Boolean);

    const remainingStock = stock.slice(5).map(id => {
      const data = ALLY_DATA.find(a => a.id === id);
      if (!data) return null;
      return { ...data, currentHp: getAllyMaxHp(data), maxHp: getAllyMaxHp(data) };
    }).filter(Boolean);

    // 平均レベル算出
    const avgLevel = Math.round(
      [...alliesOnField, ...remainingStock].reduce((s, a) => s + a.level, 0) /
      (alliesOnField.length + remainingStock.length)
    );

    // Waveの敵を選定（通常モードのみ。テストモードでは未使用）
    // 通常は3Wave、サドンデスモードは10Waveまで挑戦できる
    let waves = [];
    if (!TEST_RANDOM_SPAWN) {
      waves = buildWaves(avgLevel, suddenDeath ? 10 : 3);
      if (waves.length === 0) {
        showPopup('出現できる敵がいません！');
        return;
      }
    } else if (ENEMY_DATA.length === 0) {
      showPopup('敵キャラがいません！');
      return;
    }

    state = {
      subject: subjectName,
      suddenDeath,
      alliesOnField,
      remainingStock,
      waves,
      currentWave: 0,
      currentEnemy: null,
      currentEnemyBoost: 1.0,
      answered: false,
      expGained: 0,
      sugarGained: 0,
      leveledTotal: 0,
      spawnCount: 0,
      spawnTimerId: null,
    };

    // サドンデスモードはバトルBGMを専用曲(Kurba.mp3)に差し替える
    if (typeof BGM !== 'undefined' && BGM.setSuddenDeath) {
      try { BGM.setSuddenDeath(suddenDeath); } catch (e) { console.warn('BGM切替エラー:', e); }
    }

    App.goTo('battle');
    renderBattleScreen();

    if (TEST_RANDOM_SPAWN) {
      startTestSpawnMode();
    } else {
      startWave(0);
    }
  }

  // ================================================
  // ★テスト用: 5秒間隔でランダムな敵が出現し続ける無限モード
  // ================================================
  function startTestSpawnMode() {
    spawnRandomEnemy();   // 1体目を即時出現
    nextQuestion();       // クイズ開始
    state.spawnTimerId = setInterval(() => {
      if (!state) return;
      spawnRandomEnemy();
    }, TEST_SPAWN_INTERVAL_MS);
  }

  function spawnRandomEnemy() {
    if (!state) return;
    // 進行中の歩行アニメ・自動攻撃を停止してから入れ替える
    if (state.cancelWalk) state.cancelWalk();
    stopEnemyAttackLoop();

    const pool = ENEMY_DATA;
    if (!pool || pool.length === 0) return;
    const enemy = { ...pool[Math.floor(Math.random() * pool.length)] };
    enemy.currentHp = enemy.hp;
    enemy.maxHp     = enemy.hp;
    state.currentEnemy      = enemy;
    state.currentEnemyBoost = 1.0;
    state.spawnCount        = (state.spawnCount || 0) + 1;

    renderWaveInfo();
    renderEnemyArea();
    renderHpBars();

    // DOMサイズ確定後に歩かせ、到着したら自動攻撃開始
    setTimeout(() => {
      if (!state) return;
      walkEnemy(() => startEnemyAttackLoop());
    }, 50);
  }

  function pickRandom(arr) {
    return { ...arr[Math.floor(Math.random() * arr.length)] };
  }

  // 各敵を自身の spawnRate(出現率) で判定し、最初に当選した敵を返す。
  // 誰も当選しなければ均等抽選でフォールバック（必ず1体は返す）。
  function pickByRate(pool) {
    // 並び順による偏りをなくすためシャッフルしてから順に判定
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (const e of shuffled) {
      const rate = (typeof e.spawnRate === 'number') ? e.spawnRate : 1;
      if (Math.random() < rate) return { ...e };
    }
    return pickRandom(pool);
  }

  // waveCount: 通常モード=3、サドンデスモード=10
  function buildWaves(avgLv, waveCount) {
    // 候補 = Lv10以下・ボス以外。各敵は spawnRate(一律30%) で出現抽選する。
    let pool = ENEMY_DATA.filter(e => !e.isBoss && e.level <= 10);
    // 該当がいない場合は全通常敵 → それも無ければ全敵をフォールバック候補に
    if (pool.length === 0) pool = ENEMY_DATA.filter(e => !e.isBoss);
    if (pool.length === 0) pool = [...ENEMY_DATA];

    const bossPool = getBossEnemies(avgLv);

    const waves = [];
    for (let i = 0; i < waveCount - 1; i++) {
      waves.push(pickByRate(pool));
    }
    // 最終Wave: ボス20%確率 or 通常敵
    if (bossPool.length > 0 && Math.random() < 0.2) {
      waves.push(pickRandom(bossPool));
    } else {
      waves.push(pickByRate(pool));
    }
    return waves;
  }

  function startWave(waveIndex) {
    if (waveIndex >= state.waves.length) {
      battleVictory();
      return;
    }
    state.currentWave    = waveIndex;
    state.currentEnemyBoost = 1.0;
    state.cancelWalk     = null;

    const enemy = { ...state.waves[waveIndex] };
    enemy.currentHp = enemy.hp;
    enemy.maxHp     = enemy.hp;
    state.currentEnemy = enemy;

    renderWaveInfo();
    renderEnemyArea();
    renderAllyArea();
    renderHpBars();

    // 歩行中から問題を出す
    nextQuestion();

    // 50ms後にDOMサイズが確定してから敵を歩かせる
    setTimeout(() => walkEnemy(() => {
      startEnemyAttackLoop();
    }), 50);
  }

  // ================================================
  // 敵が左から歩いてくるアニメーション
  // ノーマル↔ジャンプを繰り返し、味方1体分の距離で停止
  // ================================================
  function walkEnemy(onReady) {
    const sprite = document.getElementById('enemy-sprite');
    if (!sprite) { onReady(); return; }

    // 実際のDOMサイズで停止位置を計算
    const allyEl = document.getElementById('ally-side');
    const spriteRect = sprite.getBoundingClientRect();
    const allyRect   = allyEl ? allyEl.getBoundingClientRect() : null;

    // 「現在の右端 → 味方左端」の距離を求め、1キャラ分（≒72px）手前で止まる
    let stopDist;
    if (allyRect && spriteRect.right < allyRect.left) {
      const gap  = allyRect.left - spriteRect.right;
      stopDist   = Math.max(10, gap - 68); // 68px ≈ キャラ1体分未満
    } else {
      // フォールバック
      const fieldW = (document.querySelector('.battle-field') || {}).offsetWidth || 360;
      stopDist = fieldW * 0.32;
    }

    const SPEED  = 85;  // px/秒
    const CYCLE  = 290; // ms：ノーマル↔ジャンプ切替周期
    const JUMP_Y = -10; // ジャンプ時の上オフセット(px)

    let posX     = 0;
    let lastTime = null;
    let lastCyc  = 0;
    let isJump   = false;
    let cancelled = false;

    state.cancelWalk = () => { cancelled = true; };

    const hasJump = sprite.dataset.jump && sprite.dataset.jump !== sprite.dataset.normal;

    function frame(ts) {
      if (cancelled || !state) return;
      if (!lastTime) { lastTime = ts; lastCyc = ts; }

      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      posX += SPEED * dt;

      // ストライド（ノーマル/ジャンプ切替）
      if (hasJump && ts - lastCyc >= CYCLE) {
        isJump = !isJump;
        sprite.src = isJump ? sprite.dataset.jump : sprite.dataset.normal;
        lastCyc = ts;
      }

      const y = hasJump && isJump ? JUMP_Y : 0;
      sprite.style.transform =
        `translateX(${Math.min(posX, stopDist)}px) translateY(${y}px)`;

      if (posX >= stopDist) {
        // 停止：ノーマルポーズに戻す
        sprite.src = sprite.dataset.normal;
        sprite.style.transform = `translateX(${stopDist}px)`;
        state.cancelWalk = null;
        onReady();
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  // ================================================
  // 敵の自動攻撃ループ（1.5秒ごとに最前列の味方へ攻撃）
  // ================================================
  function startEnemyAttackLoop() {
    stopEnemyAttackLoop();
    state.attackLoopActive = true;
    state.enemyAnimating   = false;

    function doAttack() {
      if (!state || !state.attackLoopActive) return;
      if (state.enemyAnimating) return; // 前のアニメが終わっていなければスキップ

      const enemy = state.currentEnemy;
      if (!enemy || state.alliesOnField.length === 0) return;

      const dmg = Math.ceil(enemy.attack * state.currentEnemyBoost);
      state.alliesOnField[0].currentHp =
        Math.max(0, state.alliesOnField[0].currentHp - dmg);

      state.enemyAnimating = true;
      const sprite = document.getElementById('enemy-sprite');
      const target = document.querySelector('.ally-sprite-front')
                  || document.querySelector('.ally-sprite');

      playSprites(
        sprite ? [sprite] : [],
        () => {
          // インパクト：味方を揺らしてダメージ表示
          playEnemySE();  // 敵の攻撃音
          if (target) {
            target.classList.add('ally-hit');
            setTimeout(() => target && target.classList.remove('ally-hit'), 400);
          }
          showDamageNumber(dmg, 'ally');
        },
        () => {
          // アニメ終了後の後処理
          if (!state) return;
          state.enemyAnimating = false;
          renderHpBars();
          checkAllyDefeated(() => {
            if (!state) return;
            if (state.alliesOnField.length === 0 && state.remainingStock.length === 0) {
              stopEnemyAttackLoop();
              battleDefeat();
            }
          });
        }
      );
    }

    state.attackTimerId = setInterval(doAttack, 1500);
  }

  function stopEnemyAttackLoop() {
    if (!state) return;
    if (state.attackTimerId) {
      clearInterval(state.attackTimerId);
      state.attackTimerId = null;
    }
    state.attackLoopActive = false;
    state.enemyAnimating   = false;
  }

  function nextQuestion() {
    if (!state) return;
    state.answered = false;
    const q = QuizManager.getRandomQuestion(state.subject);
    if (!q) { showPopup('問題がありません'); return; }
    state.currentQuestion = q;
    renderQuestion(q);
  }

  // index から answer を呼ぶ（グローバルonclickを避けるためindexベースに）
  function answerByIndex(index) {
    if (!state || state.answered || !state.currentQuestion) return;
    const choice = state.currentQuestion.choices[index];
    if (choice === undefined) return;
    answer(choice);
  }

  function answer(choice) {
    if (!state || state.answered) return;
    state.answered = true;

    const q = state.currentQuestion;
    const isCorrect = choice === q.answer;

    // 選択肢ボタンを無効化・色付け
    const btns = document.querySelectorAll('.choice-btn');
    btns.forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.choice === q.answer) btn.classList.add('correct');
      else if (btn.dataset.choice === choice && !isCorrect) btn.classList.add('wrong');
    });

    if (isCorrect) {
      handleCorrect();
    } else {
      handleWrong();
    }
  }

  function handleCorrect() {
    const enemy = state.currentEnemy;
    // テストモードで撃破直後など、敵が一時的にいない場合は次の問題へ
    if (!enemy) { setTimeout(nextQuestion, 300); return; }
    const totalAttack = state.alliesOnField.reduce((s, a) => s + a.attack, 0);
    enemy.currentHp = Math.max(0, enemy.currentHp - totalAttack);

    // 攻撃アニメーション
    animateAttack('ally', totalAttack, () => {
      renderHpBars();
      if (enemy.currentHp <= 0) {
        enemyDefeated();
      } else {
        setTimeout(nextQuestion, 150);
      }
    });
  }

  function handleWrong() {
    const enemy = state.currentEnemy;
    if (!enemy) { setTimeout(nextQuestion, 300); return; }
    // 不正解 → 敵の攻撃力が永続的に上昇（自動攻撃の威力が増す）
    state.currentEnemyBoost *= (1 + enemy.wrongBoost / 100);
    const newAtk = Math.ceil(enemy.attack * state.currentEnemyBoost);
    showPopup(`不正解！${enemy.name}の攻撃力が上がった！(${newAtk})`);
    setTimeout(nextQuestion, 900);
  }

  function checkAllyDefeated(cb) {
    while (state.alliesOnField.length > 0 && state.alliesOnField[0].currentHp <= 0) {
      const defeated = state.alliesOnField.shift();
      showPopup(`${defeated.name} は倒れた！`);
      // ストックから補充
      if (state.remainingStock.length > 0) {
        state.alliesOnField.push(state.remainingStock.shift());
      }
      renderAllyArea();
    }
    if (cb) setTimeout(cb, 400);
  }

  // サドンデスモードの1体撃破あたりの角砂糖報酬（敵の経験値に応じて変動）
  function sugarForEnemy(enemy) {
    const base = Math.max(enemy.exp, 5);
    return 3 + Math.floor(Math.random() * base);
  }

  function enemyDefeated() {
    stopEnemyAttackLoop();
    const enemy = state.currentEnemy;
    state.expGained += enemy.exp;
    Storage.addEncEnemy(enemy.id);

    // サドンデスモードは倒した敵の分だけ即座に経験値・角砂糖を確定させる
    // （敗北しても、それまでに倒した分の報酬は失われない）
    if (state.suddenDeath) {
      const sugar = sugarForEnemy(enemy);
      state.sugarGained += sugar;
      Storage.addSugar(sugar);
      state.leveledTotal += Storage.addExp(enemy.exp);
    }

    // テストモード: 勝利判定せず撃破演出のみ。次の敵は5秒タイマーが連れてくる
    if (TEST_RANDOM_SPAWN) {
      state.currentEnemy = null;
      showEnemyDefeatedAnim(enemy.name, () => {
        if (state) nextQuestion();
      });
      return;
    }

    showEnemyDefeatedAnim(enemy.name, () => {
      const nextWave = state.currentWave + 1;
      if (nextWave >= state.waves.length) {
        battleVictory();
      } else {
        showWaveTransition(nextWave + 1, () => startWave(nextWave));
      }
    });
  }

  function battleVictory() {
    stopEnemyAttackLoop();
    if (state && state.spawnTimerId) { clearInterval(state.spawnTimerId); state.spawnTimerId = null; }

    // サドンデスモードは撃破のたびに報酬を確定済み。通常モードはここで一括付与。
    let leveled;
    if (state.suddenDeath) {
      leveled = state.leveledTotal;
    } else {
      const sugar = 5 + Math.floor(Math.random() * 96); // 5〜100
      state.sugarGained = sugar;
      Storage.addSugar(sugar);
      leveled = Storage.addExp(state.expGained);
    }

    document.getElementById('battle-result-title').textContent =
      state.suddenDeath ? '🔥 サドンデス 完全制覇！' : '⭐ 勝利！';
    document.getElementById('battle-result-msg').innerHTML = `
      ${state.suddenDeath ? `<p>Wave ${state.waves.length} まで勝ち抜いた！</p>` : ''}
      <p>経験値 +${state.expGained}</p>
      <p>🍬 角砂糖 +${state.sugarGained}</p>
      ${leveled > 0 ? `<p class="levelup-msg">🎉 Lv UP！ → Lv.${Storage.getUserLevel()}</p>` : ''}
    `;
    showOverlay();
  }

  function battleDefeat() {
    stopEnemyAttackLoop();
    if (state && state.spawnTimerId) { clearInterval(state.spawnTimerId); state.spawnTimerId = null; }
    document.getElementById('battle-result-title').textContent = '💧 敗北...';

    // サドンデスモードは敗北しても、それまでに倒した敵の分の報酬は確定済みで残る
    if (state.suddenDeath) {
      document.getElementById('battle-result-msg').innerHTML = `
        <p>Wave ${state.currentWave + 1} で戦えるキャラがいなくなってしまった...</p>
        <p>経験値 +${state.expGained}</p>
        <p>🍬 角砂糖 +${state.sugarGained}</p>
      `;
    } else {
      document.getElementById('battle-result-msg').innerHTML = `
        <p>戦えるキャラがいなくなってしまった...</p>
        <p>ガチャで仲間を増やそう！</p>
      `;
    }
    showOverlay();
  }

  function endBattle() {
    if (state && state.cancelWalk) state.cancelWalk();
    if (state && state.spawnTimerId) clearInterval(state.spawnTimerId);
    state = null;
    App.goTo('menu');
  }

  // ==== アニメーション ====

  // スプライトシーケンス再生: ジャンプ→アタック→ノーマルの順
  // onImpact はアタックポーズに切り替わった瞬間に呼ぶ
  function playSprites(els, onImpact, onFinish) {
    if (els.length === 0) { onImpact(); setTimeout(onFinish, 300); return; }
    const ref = els[0];
    const hasJump   = ref.dataset.jump   && ref.dataset.jump   !== ref.dataset.normal;
    const hasAttack = ref.dataset.attack && ref.dataset.attack !== ref.dataset.normal;

    let t = 0;

    // ① ジャンプポーズ
    if (hasJump) {
      els.forEach(el => { el.src = el.dataset.jump; });
      t += 250;
    }

    // ② アタックポーズ → インパクト
    setTimeout(() => {
      if (hasAttack) {
        els.forEach(el => { el.src = el.dataset.attack; });
      }
      onImpact();
    }, t);
    t += (hasAttack ? 320 : 150);

    // ③ ノーマルに戻す
    setTimeout(() => {
      els.forEach(el => { el.src = el.dataset.normal; });
      onFinish();
    }, t);
  }

  function animateAttack(attacker, damage, cb) {
    const isAlly = attacker === 'ally';

    if (isAlly) {
      const sprites = Array.from(document.querySelectorAll('.ally-sprite'));
      const target  = document.getElementById('enemy-sprite');
      playSprites(sprites,
        () => {
          playAllySE();  // 味方の攻撃音
          if (target) { target.classList.add('hit-shake'); setTimeout(() => target.classList.remove('hit-shake'), 400); }
          showDamageNumber(damage, 'enemy');
        },
        cb
      );
    } else {
      const sprite = document.getElementById('enemy-sprite');
      const target = document.querySelector('.ally-sprite-front') || document.querySelector('.ally-sprite');
      playSprites(sprite ? [sprite] : [],
        () => {
          playEnemySE();  // 敵の攻撃音
          if (target) {
            target.classList.add('ally-hit');
            setTimeout(() => target.classList.remove('ally-hit'), 400);
          }
          showDamageNumber(damage, 'ally');
        },
        cb
      );
    }
  }

  function showDamageNumber(damage, side) {
    const el = document.getElementById('damage-popup');
    if (!el) return;
    el.textContent = `-${damage}`;
    el.className = `damage-popup ${side}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 800);
  }

  function showEnemyDefeatedAnim(name, cb) {
    const el = document.getElementById('enemy-sprite');
    if (el) {
      el.style.transition = 'opacity 0.25s';
      el.style.opacity = '0';
    }
    showPopup(`${name} を倒した！`);
    setTimeout(() => {
      if (el) { el.style.opacity = '1'; el.style.transition = ''; }
      if (cb) cb();
    }, 350);
  }

  function showWaveTransition(waveNum, cb) {
    const el = document.getElementById('wave-transition');
    if (el) {
      el.textContent = `Wave ${waveNum}`;
      el.classList.remove('hidden');
      setTimeout(() => { el.classList.add('hidden'); if (cb) cb(); }, 500);
    } else { if (cb) cb(); }
  }

  function showOverlay() {
    document.getElementById('battle-overlay').classList.remove('hidden');
  }

  // ==== 描画 ====

  function renderBattleScreen() {
    document.getElementById('battle-overlay').classList.add('hidden');
    renderAllyArea();
  }

  function renderWaveInfo() {
    const el = document.getElementById('wave-text');
    if (!el) return;
    if (TEST_RANDOM_SPAWN) {
      el.textContent = `テストモード｜出現数 ${state.spawnCount}`;
      return;
    }
    const prefix = state.suddenDeath ? '🔥 ' : '';
    el.textContent = `${prefix}Wave ${state.currentWave + 1} / ${state.waves.length}`;
  }

  function renderEnemyArea() {
    const enemy = state.currentEnemy;
    const el = document.getElementById('enemy-side');
    const norm   = enemy.images.normal;
    const jump   = enemy.images.jump   || norm;
    const attack = enemy.images.attack || norm;
    el.innerHTML = `
      <div class="enemy-container">
        <p class="char-name">${enemy.name}</p>
        <img id="enemy-sprite"
          class="char-sprite enemy-sprite"
          src="${norm}"
          data-normal="${norm}"
          data-jump="${jump}"
          data-attack="${attack}"
          alt="${enemy.name}"
          onerror="this.style.visibility='hidden'">
      </div>
    `;
    // 初期位置リセット → 白背景透過処理
    const sprite = document.getElementById('enemy-sprite');
    if (sprite) {
      sprite.style.transform = 'translateX(0) translateY(0)';
      processCharSprite(sprite);
    }
    document.getElementById('enemy-name-label').textContent = enemy.name;
  }

  function renderAllyArea() {
    const el = document.getElementById('ally-side');
    el.innerHTML = state.alliesOnField.map((ally, i) => {
      const norm   = ally.images.normal;
      const jump   = ally.images.jump   || norm;
      const attack = ally.images.attack || norm;
      return `
        <div class="ally-container">
          <img class="ally-sprite char-sprite${i === 0 ? ' ally-sprite-front' : ''}"
            src="${norm}"
            data-normal="${norm}"
            data-jump="${jump}"
            data-attack="${attack}"
            alt="${ally.name}"
            onerror="this.style.visibility='hidden'">
          <p class="char-name">${ally.name}</p>
        </div>
      `;
    }).join('');
    // 白背景透過処理
    document.querySelectorAll('.ally-sprite').forEach(img => processCharSprite(img));
  }

  function renderHpBars() {
    if (!state) return;
    const enemy = state.currentEnemy;
    const enemyPct = Math.max(0, (enemy.currentHp / enemy.maxHp) * 100);
    document.getElementById('enemy-hp-bar').style.width = `${enemyPct}%`;
    document.getElementById('enemy-hp-text').textContent = `${enemy.currentHp}/${enemy.maxHp}`;

    const allyBarsEl = document.getElementById('ally-hp-bars');
    allyBarsEl.innerHTML = state.alliesOnField.map(a => {
      const pct = Math.max(0, (a.currentHp / a.maxHp) * 100);
      return `
        <div class="ally-hp-row">
          <span class="ally-hp-name">${a.name}</span>
          <div class="hp-bar-container small">
            <div class="hp-bar ally-bar ${pct < 30 ? 'danger' : ''}" style="width:${pct}%"></div>
          </div>
          <span class="hp-num">${a.currentHp}/${a.maxHp}</span>
        </div>
      `;
    }).join('');
  }

  function renderQuestion(q) {
    document.getElementById('quiz-question').textContent = q.question;
    const choicesEl = document.getElementById('quiz-choices');
    choicesEl.innerHTML = q.choices.map((c, i) => `
      <button class="choice-btn" data-index="${i}" data-choice="">
        ${c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
      </button>
    `).join('');
    // イベントリスナーで安全に参照
    choicesEl.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.dataset.choice = q.choices[i];
      btn.addEventListener('click', () => Battle.answerByIndex(i));
    });
  }

  function showPopup(msg) {
    const el = document.getElementById('message-popup');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 2000);
  }

  return { startBattle, answer, answerByIndex, endBattle };
})();
