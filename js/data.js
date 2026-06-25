// ============================
// キャラクターデータ & デフォルトクイズ
// ============================

// 敵キャラクターデータ
// フォルダ名形式: キャラクター名_攻撃力_HP_不正解時攻撃力上昇%
// ※ level と exp はここで個別設定
// ※ spawnRate: 出現抽選で各敵が選ばれる確率(0〜1)。未設定なら 1(=必ず候補)扱い。
//    Lv10以下・ボス以外は一律 0.30(30%) に設定。
const ENEMY_DATA = [
  {
    id: 'mitarashi-dango',
    name: 'みたらし団子',
    level: 2,   // ※フォルダ名にLv指定なし。最弱ステータス(攻5/HP15)に合わせ、HP≒Lv×10 の既存対応に倣い仮設定
    attack: 5,
    hp: 15,
    exp: 15,
    wrongBoost: 20,
    spawnRate: 0.30,
    isBoss: false,
    images: {
      normal: '敵キャラ/みたらし団子_5_15_15_20％/normal.png',
      jump:   '敵キャラ/みたらし団子_5_15_15_20％/jump.png',
      attack: '敵キャラ/みたらし団子_5_15_15_20％/attack.png',
    },
    description: '香ばしい醤油だれをまとったみたらし団子。\n素朴ながら、串でちくちく突いてくる。'
  },
  {
    id: 'ichigo-daifuku',
    name: '苺大福',
    level: 5,   // 出現範囲: 味方平均Lv±範囲に合わせて設定
    attack: 20,
    hp: 50,
    exp: 50,    // フォルダ名 苺大福_20_50_50_12% の経験値欄に合わせて 5→50 に更新
    wrongBoost: 12,
    spawnRate: 0.30,
    isBoss: false,
    images: {
      normal: '敵キャラ/苺大福_20_50_50_12％/ノーマル.png',
      jump:   '敵キャラ/苺大福_20_50_50_12％/ジャンプ.png',
      attack: '敵キャラ/苺大福_20_50_50_12％/アタック.png',
    },
    description: 'やわらかくて甘い苺大福。\nシンプルに見えて意外と手強い。'
  },
  {
    id: 'mizu-yokan',
    name: '水ようかん',
    level: 6,   // ※フォルダ名にLv指定がないため、ステータス(攻30/HP65)に合わせて仮設定
    attack: 30,
    hp: 65,
    exp: 20,
    wrongBoost: 20,
    spawnRate: 0.30,
    isBoss: false,
    images: {
      normal: '敵キャラ/水ようかん_30_65_20_20％/nomal.png',
      jump:   '敵キャラ/水ようかん_30_65_20_20％/jump.png',
      attack: '敵キャラ/水ようかん_30_65_20_20％/attack.png',
    },
    description: 'つるんと涼やかな水ようかん。\n見た目に反してしぶとく、なかなか崩れない。'
  }
  // ↑ 新キャラはここに追加
];

// 味方キャラクターデータ
// フォルダ名形式: キャラクター名_攻撃力_ガチャ排出率%_Lv
// HP = 50 + level * 20 で自動計算
const ALLY_DATA = [
  {
    id: 'kocha',
    name: '紅茶',
    attack: 30,
    rarity: 30,
    level: 5,
    isInitial: true,   // 初期1体目（通常運用）
    images: {
      normal: '味方キャラ/紅茶_30_30％_Lv5/ノーマル.png',
      jump:   null,  // ジャンプ.png があればパスを入れる
      attack: null,  // アタック.png があればパスを入れる
    },
    description: '香り高い紅茶の妖精。\n上品で力強い攻撃を繰り出す。'
  },
  {
    id: 'nama-beer',
    name: '生ビール',
    attack: 40,
    rarity: 12,
    level: 6,
    isInitial: false,   // 初期キャラ対象外（通常運用）
    images: {
      normal: '味方キャラ/生ビール_40_12％_lv6/nomal.png',
      jump:   null,  // ジャンプ.png なし
      attack: '味方キャラ/生ビール_40_12％_lv6/attack.png',
    },
    description: 'よく冷えた生ビール。\n泡立つ一撃で敵を豪快に押し流す。'
  }
  // ↑ 新キャラはここに追加
];

// ============================
// 九九クイズ (デフォルト科目)
// ============================
function _generateKuku() {
  const qs = [];
  for (let i = 2; i <= 9; i++) {
    for (let j = 1; j <= 9; j++) {
      qs.push({
        question: `${i} × ${j} = ?`,
        answer: String(i * j),
        wrong: []
      });
    }
  }
  return qs;
}

const DEFAULT_QUIZ_SUBJECT = '九九';
const DEFAULT_QUIZ_DATA = { [DEFAULT_QUIZ_SUBJECT]: _generateKuku() };

// ============================
// ユーティリティ
// ============================
function getAllyMaxHp(allyData) {
  return 50 + allyData.level * 20;
}

function getEnemyByLevel(minLv, maxLv, excludeBoss = true) {
  return ENEMY_DATA.filter(e => {
    if (excludeBoss && e.isBoss) return false;
    return e.level >= minLv && e.level <= maxLv;
  });
}

function getBossEnemies(minLevel) {
  return ENEMY_DATA.filter(e => e.isBoss && e.level <= minLevel);
}
