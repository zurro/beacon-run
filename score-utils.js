(() => {
  const STORAGE_KEY = 'beacon_runner_scoreboard';
  const MAX_SCORES = 10;
  const NAME_LENGTH = 6;

  function sanitizeName(name){
    return String(name || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, NAME_LENGTH);
  }

  function formatName(name){
    return sanitizeName(name);
  }

  function normalizeEntry(entry){
    const score = Math.max(0, Math.floor(Number(entry && entry.score) || 0));
    const name = sanitizeName(entry && entry.name);
    return {
      name,
      score,
      createdAt: Number(entry && entry.createdAt) || Date.now()
    };
  }

  function sortScores(scores){
    return scores.sort((a, b) => {
      if(b.score !== a.score) return b.score - a.score;
      return a.createdAt - b.createdAt;
    });
  }

  function load(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if(!Array.isArray(raw)) return [];
      return sortScores(raw.map(normalizeEntry)).slice(0, MAX_SCORES);
    } catch (err) {
      return [];
    }
  }

  function save(scores){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortScores(scores.slice()).slice(0, MAX_SCORES)));
  }

  function qualifies(scores, score){
    const value = Math.max(0, Math.floor(Number(score) || 0));
    if(scores.length < MAX_SCORES) return true;
    const candidate = normalizeEntry({ name: '', score: value, createdAt: Date.now() });
    const preview = withCandidate(scores, candidate);
    return preview.some(entry => entry.createdAt === candidate.createdAt);
  }

  function withCandidate(scores, entry){
    return sortScores(scores.concat(normalizeEntry(entry))).slice(0, MAX_SCORES);
  }

  function insert(entry){
    const scores = load();
    const next = withCandidate(scores, entry);
    save(next);
    return next;
  }

  function clear(){
    localStorage.removeItem(STORAGE_KEY);
  }

  window.BeaconRunScores = {
    STORAGE_KEY,
    MAX_SCORES,
    NAME_LENGTH,
    sanitizeName,
    formatName,
    load,
    save,
    qualifies,
    withCandidate,
    insert,
    clear
  };
})();
