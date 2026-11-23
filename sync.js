/* PediaQ cloud sync. Keeps the original localStorage history as the offline cache. */
(function () {
  'use strict';
  const C = window.PEDIAQ_SUPABASE_CONFIG || {};
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(C.url || '') &&
    typeof C.anonKey === 'string' && C.anonKey.length > 20 &&
    !!(window.supabase && window.supabase.createClient);
  const api = enabled ? window.supabase.createClient(C.url, C.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  let user = null, bridge = null, busy = false, pending = false, timer = null;
  let status = enabled ? 'ログインしてください / Sign in to sync' :
    'クラウド同期は準備中です / Cloud sync awaits backend setup';
  const OWNER = 'pediaq-cloud-owner-v1';
  const LOCAL = 'pediaq-pwa-progress-v1';
  const dateNow = () => new Date().toISOString();
  const safe = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
  function notify(value) { status = value; renderPanel(); }
  function snapshot() { return JSON.parse(JSON.stringify(bridge.getHistory())); }
  function normalize(local) {
    let changed = false;
    Object.entries(local).forEach(([qid, entry]) => {
      if (!entry || typeof entry !== 'object') { delete local[qid]; changed = true; return; }
      if (!Array.isArray(entry.attempts)) { entry.attempts = []; changed = true; }
      entry.attempts.forEach(a => {
        if (!a.syncId) { a.syncId = crypto.randomUUID(); changed = true; }
        if (!a.ratingUpdatedAt) { a.ratingUpdatedAt = a.time || dateNow(); changed = true; }
      });
      if (entry.excluded !== undefined && !entry.excludedUpdatedAt) {
        entry.excludedUpdatedAt = dateNow(); changed = true;
      }
    });
    if (changed) bridge.setHistory(local);
    return local;
  }
  function mergeHistory(local, cloudAttempts, cloudPrefs) {
    const uploads = [], prefs = [], remoteById = new Map();
    cloudAttempts.forEach(row => remoteById.set(row.event_id, row));
    const localIds = new Set();
    Object.entries(local).forEach(([qid, entry]) => {
      (entry.attempts || []).forEach(a => {
        localIds.add(a.syncId);
        const remote = remoteById.get(a.syncId);
        const localDate = Date.parse(a.ratingUpdatedAt || a.time || 0) || 0;
        const remoteDate = remote ? (Date.parse(remote.rating_updated_at || remote.answered_at) || 0) : 0;
        if (!remote || localDate > remoteDate) {
          uploads.push({
            user_id: user.id, event_id: a.syncId, question_id: qid,
            answer: a.answer || 'E', correct: a.correct === true,
            answered_at: a.time || dateNow(), rating: a.rating || null,
            rating_updated_at: a.ratingUpdatedAt || a.time || dateNow()
          });
        } else if (remoteDate > localDate || (remote && remote.rating !== a.rating)) {
          a.rating = remote.rating;
          a.ratingUpdatedAt = remote.rating_updated_at;
        }
      });
    });
    cloudAttempts.forEach(row => {
      if (localIds.has(row.event_id)) return;
      local[row.question_id] ||= { attempts: [] };
      local[row.question_id].attempts ||= [];
      local[row.question_id].attempts.push({
        syncId: row.event_id, answer: row.answer, correct: row.correct,
        time: row.answered_at, rating: row.rating, ratingUpdatedAt: row.rating_updated_at
      });
    });
    const remotePrefs = new Map(cloudPrefs.map(x => [x.question_id, x]));
    Object.entries(local).forEach(([qid, entry]) => {
      if (entry.excludedUpdatedAt === undefined) return;
      const remote = remotePrefs.get(qid);
      const localDate = Date.parse(entry.excludedUpdatedAt) || 0;
      const remoteDate = remote ? Date.parse(remote.updated_at) || 0 : 0;
      if (!remote || localDate > remoteDate) {
        prefs.push({
          user_id: user.id, question_id: qid, excluded: !!entry.excluded,
          updated_at: entry.excludedUpdatedAt
        });
      } else {
        entry.excluded = !!remote.excluded;
        entry.excludedUpdatedAt = remote.updated_at;
      }
    });
    cloudPrefs.forEach(p => {
      if (local[p.question_id]?.excludedUpdatedAt !== undefined) return;
      local[p.question_id] ||= { attempts: [] };
      local[p.question_id].excluded = p.excluded;
      local[p.question_id].excludedUpdatedAt = p.updated_at;
    });
    for (const entry of Object.values(local)) {
      if (entry.attempts) entry.attempts.sort((a, b) =>
        (Date.parse(a.time) || 0) - (Date.parse(b.time) || 0));
    }
    return { local, uploads, prefs };
  }
  async function fetchRows(table, columns) {
    const rows = [];
    // Supabase PostgREST commonly limits responses to 1,000 rows.
    // Pagination prevents older attempts silently disappearing from the local view.
    for (let start = 0; ; start += 1000) {
      const {data, error} = await api.from(table).select(columns)
        .eq('user_id', user.id)
        .order(table === 'pediaq_attempts' ? 'event_id' : 'question_id', {ascending:true})
        .range(start, start + 999);
      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }
  async function synchronize() {
    if (!api || !user || !bridge) return;
    if (busy) { pending = true; return; }
    busy = true;
    try {
      let local = normalize(snapshot());
      const owner = localStorage.getItem(OWNER);
      if (owner !== user.id) {
        const amount = Object.values(local).reduce((n, x) => n + (x.attempts || []).length, 0);
        if (amount || Object.values(local).some(x => x.excluded)) {
          // No records are uploaded unless this explicit import is approved.
          const approve = owner === null && window.confirm(
            'この端末の既存学習履歴を、現在のGoogleアカウントへ取り込みますか？\n' +
            'Import this device\'s existing learning history into your signed-in account?');
          localStorage.setItem('pediaq-history-backup-' + Date.now(), JSON.stringify(local));
          if (!approve) local = {};
        }
      }
      const [a, p] = await Promise.all([
        fetchRows('pediaq_attempts', 'event_id,question_id,answer,correct,answered_at,rating,rating_updated_at'),
        fetchRows('pediaq_preferences', 'question_id,excluded,updated_at')
      ]);
      const result = mergeHistory(local, a, p);
      // Write before presenting synced state; errors must not silently claim success.
      for (let i = 0; i < result.uploads.length; i += 250) {
        const {error} = await api.from('pediaq_attempts').upsert(
          result.uploads.slice(i, i + 250), {onConflict:'user_id,event_id'});
        if (error) throw error;
      }
      if (result.prefs.length) {
        const {error} = await api.from('pediaq_preferences').upsert(
          result.prefs, {onConflict:'user_id,question_id'});
        if (error) throw error;
      }
      localStorage.setItem(OWNER, user.id);
      bridge.setHistory(result.local);
      notify('同期済み / Synced: ' + new Date().toLocaleTimeString());
    } catch (error) {
      console.error('PediaQ sync failed:', error);
      notify('同期失敗。端末内の履歴は保存されています / Sync failed; local history is safe');
    } finally {
      busy = false;
      if (pending) { pending = false; schedule(); }
    }
  }
  function schedule() {
    if (!user || !bridge) return;
    clearTimeout(timer);
    timer = setTimeout(synchronize, 650);
  }
  function renderPanel() {
    const target = document.getElementById('sync-panel');
    if (!target) return;
    let ui = '<h2>履歴のクラウド同期 / Cloud history sync</h2>';
    if (!api) {
      target.innerHTML = ui + '<p>現在は端末内保存のみです。管理者によるSupabase設定後にログインが有効になります。<br><span class="en">Currently local-only. Sign-in becomes available once Supabase is configured.</span></p>';
      return;
    }
    if (!user) {
      target.innerHTML = ui +
        '<p class="muted">' + safe(status) + '</p>' +
        '<button class="btn" id="cloud-login">Googleでログイン / Sign in with Google</button>';
      target.querySelector('#cloud-login').onclick = async () => {
        const {error} = await api.auth.signInWithOAuth({
          provider:'google', options:{redirectTo:location.origin + location.pathname}
        });
        if (error) notify('ログイン失敗 / Sign-in failed: ' + error.message);
      };
      return;
    }
    target.innerHTML = ui +
      '<p>' + safe(user.email || 'Google user') + '</p>' +
      '<p class="muted" aria-live="polite">' + safe(status) + '</p>' +
      '<div class="actions"><button class="btn" id="cloud-sync">今すぐ同期 / Sync now</button>' +
      '<button class="btn secondary" id="cloud-logout">ログアウト / Sign out</button></div>' +
      '<p class="muted">オンラインで同期します。オフライン中もこの端末で演習できます。<br>' +
      'Synchronization requires internet; local practice remains available offline.</p>';
    target.querySelector('#cloud-sync').onclick = () => synchronize();
    target.querySelector('#cloud-logout').onclick = async () => {
      const {error} = await api.auth.signOut();
      if (error) notify('Sign-out failed: ' + error.message);
    };
  }
  async function handleSession(nextUser) {
    const old = user?.id || null;
    user = nextUser || null;
    if (!user) { notify('未ログイン / Not signed in'); return; }
    notify('同期を確認中 / Checking cloud history');
    if (old !== user.id) await synchronize();
  }
  async function init(b) {
    bridge = b;
    renderPanel();
    if (!api) return;
    const {data, error} = await api.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') {
      notify('認証を確認できません / Could not verify sign-in');
    }
    await handleSession(data?.user);
    api.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && session.user.id !== user?.id) {
        setTimeout(() => handleSession(session.user), 0);
      } else if (event === 'SIGNED_OUT') {
        user = null; notify('ログアウトしました / Signed out');
      }
    });
    setInterval(() => { if (user && document.visibilityState === 'visible') synchronize(); }, 45000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') schedule();
    });
    window.addEventListener('online', schedule);
  }
  window.PediaQSync = {init, schedule, renderPanel};
})();
