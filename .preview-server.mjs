import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const target = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) {
    res.writeHead(404); res.end(); return;
  }
  let body = fs.readFileSync(target);
  const extension = path.extname(target);
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[extension] ?? 'text/plain');
  if (extension === '.js' && body.includes('new Phaser.Game(gameConfig);')) {
    body = body.toString().replace('new Phaser.Game(gameConfig);', 'const previewGame = new Phaser.Game(gameConfig);');
    body += `
      setTimeout(() => {
        GameState.leader = { level: 30, tacticsPoints: 5, unlockedAbilities: leaderAbilities.map(a => a.id), battleLoadout: ['focusFire', 'coordinatedAssault', 'encouragement', 'brace', 'arise'] };
        GameState.currentDelve = { ...delves[3] };
        GameState.activeParty = GameState.roster.filter(a => ['sturm', 'riverwind', 'tanis', 'raistlin', 'goldmoon'].includes(a.id));
        GameState.run.startedAt = Date.now();
        const mode = new URLSearchParams(location.search).get('mode');
        previewGame.scene.stop('TitleScene');
        if (mode === 'dev') {
          previewGame.scene.start('TitleScene');
          setTimeout(() => previewGame.scene.getScene('TitleScene').showDevelopmentTools(), 100);
        } else if (mode === 'tactics') {
          previewGame.scene.start('RaidLeaderScene');
        } else {
          previewGame.scene.start('BattleScene');
          setTimeout(() => {
            const battle = previewGame.scene.getScene('BattleScene');
            battle.enemies.forEach(e => e.container.destroy());
            battle.startWave(5);
            battle.combatPaused = true;
          }, 100);
        }
      }, 1200);
    `;
  }
  res.end(body);
}).listen(4173, '127.0.0.1');
