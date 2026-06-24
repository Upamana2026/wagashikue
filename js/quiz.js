// ============================
// クイズ管理システム
// ============================
const QuizManager = (() => {

  // ランダム選択肢を生成（同科目の正解から補完）
  function buildChoices(q, allQuestions) {
    const wrong = [...q.wrong].filter(w => w && w.trim() !== '');
    const answers = allQuestions.map(x => x.answer).filter(a => a !== q.answer);

    while (wrong.length < 3) {
      if (answers.length === 0) { wrong.push('？'); continue; }
      const pick = answers.splice(Math.floor(Math.random() * answers.length), 1)[0];
      if (!wrong.includes(pick)) wrong.push(pick);
    }

    const choices = [q.answer, wrong[0], wrong[1], wrong[2]];
    // シャッフル
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }

  // 指定科目からランダム問題を1問取得（choices付き）
  function getRandomQuestion(subjectName) {
    const sets = Storage.getQuizSets();
    const qs = sets[subjectName];
    if (!qs || qs.length === 0) return null;
    const q = qs[Math.floor(Math.random() * qs.length)];
    return { ...q, choices: buildChoices(q, qs) };
  }

  // 科目一覧取得
  function getSubjectNames() {
    return Object.keys(Storage.getQuizSets());
  }

  // 科目を追加
  function addSubject() {
    const input = document.getElementById('new-subject-name');
    const name = input.value.trim();
    if (!name) return;
    const sets = Storage.getQuizSets();
    if (sets[name]) { showMsg('その科目名は既に存在します'); return; }
    sets[name] = [];
    Storage.setQuizSets(sets);
    input.value = '';
    renderSubjectManageList();
    renderImportSubjectSelect();
    renderViewSubjectSelect();
  }

  // 科目を削除
  function deleteSubject(name) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const sets = Storage.getQuizSets();
    delete sets[name];
    Storage.setQuizSets(sets);
    renderSubjectManageList();
    renderImportSubjectSelect();
    renderViewSubjectSelect();
    document.getElementById('question-list').innerHTML = '';
  }

  // CSVまたはExcelファイルをインポート
  function importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const subject = document.getElementById('import-target-subject').value;
    if (!subject) { showMsg('インポート先の科目を選んでください'); return; }

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = e => parseCSV(e.target.result, subject);
      reader.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
      if (typeof XLSX === 'undefined') {
        showMsg('Excelの読み込みには SheetJS ライブラリが必要です（オンライン環境でお試しください）');
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        importRows(rows, subject);
      };
      reader.readAsArrayBuffer(file);
    } else {
      showMsg('CSVまたはExcelファイルを選択してください');
    }
    event.target.value = '';
  }

  function parseCSV(text, subject) {
    const rows = text.split(/\r?\n/).map(line => {
      // CSV: カンマ区切り (ダブルクォート対応)
      const cols = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
        else { cur += c; }
      }
      cols.push(cur);
      return cols;
    });
    importRows(rows, subject);
  }

  function importRows(rows, subject) {
    const sets = Storage.getQuizSets();
    if (!sets[subject]) sets[subject] = [];
    let added = 0;
    rows.slice(1).forEach(row => { // 1行目は見出し除外
      const q = (row[0] || '').toString().trim();
      const a = (row[1] || '').toString().trim();
      if (!q || !a) return;
      sets[subject].push({
        question: q,
        answer: a,
        wrong: [
          (row[2] || '').toString().trim(),
          (row[3] || '').toString().trim(),
          (row[4] || '').toString().trim(),
        ]
      });
      added++;
    });
    Storage.setQuizSets(sets);
    showMsg(`${added}件の問題を「${subject}」に追加しました`);
    renderViewSubjectSelect();
    document.getElementById('view-subject-select').value = subject;
    viewSubject();
  }

  // ==== UI描画 ====

  // 科目名を安全に参照するための一時マップ
  let _subjectIndexMap = [];

  function renderSubjectManageList() {
    const el = document.getElementById('subject-manage-list');
    if (!el) return;
    const names = getSubjectNames();
    _subjectIndexMap = names;
    el.innerHTML = (names.length === 0 ? '<p class="empty-msg">科目がありません</p>' :
      names.map((name, i) => `
        <div class="subject-item">
          <span>${name}</span>
          <span class="question-count">${(Storage.getQuizSets()[name] || []).length}問</span>
          ${name !== DEFAULT_QUIZ_SUBJECT
            ? `<button class="btn-small btn-danger" data-sidx="${i}">削除</button>`
            : ''}
        </div>
      `).join('')
    );
    // イベントリスナーで安全に削除
    el.querySelectorAll('[data-sidx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = _subjectIndexMap[parseInt(btn.dataset.sidx)];
        if (name) deleteSubject(name);
      });
    });
  }

  function renderImportSubjectSelect() {
    const el = document.getElementById('import-target-subject');
    if (!el) return;
    const names = getSubjectNames();
    el.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  }

  function renderViewSubjectSelect() {
    const el = document.getElementById('view-subject-select');
    if (!el) return;
    const names = getSubjectNames();
    el.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function viewSubject() {
    const sel = document.getElementById('view-subject-select');
    if (!sel) return;
    const name = sel.value;
    const sets = Storage.getQuizSets();
    const qs = sets[name] || [];
    const el = document.getElementById('question-list');
    if (qs.length === 0) { el.innerHTML = '<p class="empty-msg">問題がありません</p>'; return; }
    el.innerHTML = qs.map((q, i) => `
      <div class="question-item">
        <div class="q-text">${i + 1}. ${escHtml(q.question)}</div>
        <div class="q-answer">正解: <strong>${escHtml(q.answer)}</strong>
          ${q.wrong.filter(w=>w).map(w => `<span class="q-wrong">${escHtml(w)}</span>`).join('')}
        </div>
        <button class="btn-small btn-danger" data-qidx="${i}">削除</button>
      </div>
    `).join('');
    // イベントリスナーで安全に削除
    el.querySelectorAll('[data-qidx]').forEach(btn => {
      btn.addEventListener('click', () => deleteQuestion(name, parseInt(btn.dataset.qidx)));
    });
  }

  function deleteQuestion(subject, index) {
    const sets = Storage.getQuizSets();
    if (!sets[subject]) return;
    sets[subject].splice(index, 1);
    Storage.setQuizSets(sets);
    viewSubject();
    renderSubjectManageList();
  }

  function renderSubjectSelect() {
    const el = document.getElementById('subject-list');
    if (!el) return;
    const names = getSubjectNames();
    if (names.length === 0) {
      el.innerHTML = '<p class="empty-msg">科目がありません。クイズ管理から追加してください。</p>';
      return;
    }
    el.innerHTML = names.map((name, i) => {
      const count = (Storage.getQuizSets()[name] || []).length;
      return `<button class="btn-subject" data-bidx="${i}">${escHtml(name)}<small>${count}問</small></button>`;
    }).join('');
    const subjectList = names;
    el.querySelectorAll('[data-bidx]').forEach(btn => {
      btn.addEventListener('click', () => Battle.startBattle(subjectList[parseInt(btn.dataset.bidx)]));
    });
  }

  function initQuizManageScreen() {
    renderSubjectManageList();
    renderImportSubjectSelect();
    renderViewSubjectSelect();
  }

  function showMsg(msg) {
    const el = document.getElementById('message-popup');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  return {
    getRandomQuestion, getSubjectNames,
    addSubject, deleteSubject, deleteQuestion,
    importFile, viewSubject,
    renderSubjectSelect, initQuizManageScreen,
  };
})();
