(() => {
  const scoresApi = window.BeaconRunScores;
  const domApi = window.BeaconRunDom;
  const list = document.getElementById('scorecardList');
  const empty = document.getElementById('scorecardEmpty');
  const meta = document.getElementById('boardMeta');
  const resetBtn = document.getElementById('resetScoresBtn');
  let lastSnapshot = '';

  function buildScoreRow(className, rankText, nameText, scoreText){
    return domApi.el('li', {
      className,
      children: [
        domApi.el('span', { className: 'rank', text: rankText }),
        domApi.el('span', { className: 'name', text: nameText }),
        domApi.el('span', { className: 'value', text: scoreText })
      ]
    });
  }

  function getSnapshot(scores){
    return JSON.stringify(scores);
  }

  function render(){
    if(!scoresApi || !list) return;

    const scores = scoresApi.load();
    const snapshot = getSnapshot(scores);
    if(snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;

    if(!scores.length){
      domApi.replace(list);
      if(empty) empty.hidden = false;
      if(meta) meta.textContent = 'No runs saved yet';
      if(resetBtn) resetBtn.disabled = true;
      return;
    }

    if(empty) empty.hidden = true;
    if(meta) meta.textContent = 'Top ' + scores.length + ' saved on this machine';
    if(resetBtn) resetBtn.disabled = false;

    const fragment = document.createDocumentFragment();
    scores.forEach((entry, index) => {
      const rowClass = index < 3 ? 'score-row top-three' : 'score-row';
      fragment.appendChild(buildScoreRow(
        rowClass,
        '#' + String(index + 1).padStart(2, '0'),
        scoresApi.formatName(entry.name),
        String(entry.score)
      ));
    });
    domApi.replace(list, [fragment]);
  }

  render();
  window.addEventListener('storage', (event) => {
    if(event.key === scoresApi.STORAGE_KEY) render();
  });
  window.setInterval(render, 5000);

  if(resetBtn){
    resetBtn.addEventListener('click', () => {
      const confirmed = window.confirm('Reset the leaderboard? This will remove all saved scores on this browser.');
      if(!confirmed) return;
      scoresApi.clear();
      lastSnapshot = '';
      render();
    });
  }
})();
