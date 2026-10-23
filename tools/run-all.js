/* Completability run. Serves nothing: open the game yourself, or point BASE at a local server.
   node tools/run-all.js            # every level, calm enemies, real terminal waves
   node tools/run-all.js 0 4 12     # just those level indexes
   Needs puppeteer-core and Chrome. CHROME= path to the binary. BASE= defaults to http://127.0.0.1:8765 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const ONLY = process.argv.slice(2).map(Number).filter(n => !Number.isNaN(n));

const BAD = /FELL|timeout|no platform|NO CATCH|LOST|COLD TAP|MAST MISSED|NO CRACK|NO PAGE|NO KIT|STILL WALL|NO LINK|NOT GOT| COLD|skipped ahead|THREW /;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  await page.setViewport({width: 1280, height: 720});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/index.html?debug', {waitUntil: 'load'});
  await page.addScriptTag({path: path.join(__dirname, 'testbot.js')});
  await page.addScriptTag({path: path.join(__dirname, 'walkthroughs.js')});
  const names = await page.evaluate(() => window.RR_LEVELS.map(l => (l.act||'?') + ' ' + (l.mode||'side') + ' ' + l.name));
  const want = ONLY.length ? ONLY : names.map((_, i) => i);
  const results = [];
  for (const i of want) {
    errors.length = 0;
    let text = '';
    try {
      text = await page.evaluate(async (i) => {
        const W = window.WALK, chunks = [];
        const side = (lv, o={}) => {
          let opt = Object.assign({maxMs: 180000}, o), all = '';
          for (let n = 0; n < 8; n++) {
            const s = W.composedSide(lv, true, opt);
            all += s + '\n';
            if (!/PAUSED/.test(s)) break;
            opt = {resume: true, maxMs: 180000, wind: o.wind};
          }
          return all;
        };
        const top = (lv) => {
          let from = 0, all = '';
          for (let n = 0; n < 12; n++) {
            const s = W.composed(lv, true, from, 1e9, 180000);
            all += s + '\n';
            const m = s.match(/NEXT (\d+)/);
            if (!m) break;
            from = +m[1];
          }
          return all;
        };
        const boss = (fn) => {
          let resume = false, all = '';
          for (let n = 0; n < 8; n++) {
            const s = fn(resume);
            all += s + '\n';
            if (!/time limit/.test(s) && /state win/.test(s)) break;
            if (!/time limit/.test(s) && !/state play/.test(s)) break;
            resume = true;
          }
          return all;
        };
        if (i === 0) chunks.push(W.kestrel());
        else if (i === 10) {
          chunks.push(W.quarryDescent());
          chunks.push(W.quarryTail(true));
          if (/PAUSED/.test(chunks[1])) chunks.push(side(10, {resume: true}));
        }
        else if (i === 12) { chunks.push(side(12)); chunks.push(W.pumpTail(true, true)); }
        else if (i === 14) chunks.push(boss(r => W.anchorBoss(14, {climbX: 30.5, dropX: 33, resume: r}, 180000)));
        else if (i === 19) chunks.push(boss(r => W.heartOfTheShip(180000, 19, r)));
        else if (i === 24) chunks.push(boss(r => W.anchorBoss(24, {climbX: 37.5, dropX: 40.5, resume: r}, 180000)));
        else if (i === 29) chunks.push(boss(r => W.heartOfTheShip(180000, 29, r)));
        else if (window.RR_LEVELS[i].mode === 'top') chunks.push(top(i));
        else chunks.push(side(i));
        return chunks.join('\n----\n')+'\nCLOCK '+document.getElementById('tim').textContent+' STATE '+window.__rr.info().state;
      }, i);
    } catch (e) {
      text = 'THREW ' + e.message;
    }
    const bad = BAD.test(text) || /THREW /.test(text);
    const won = /RESULT win|state win/.test(text);
    const clock = (text.match(/CLOCK (\d\d:\d\d\.\d)/) || [])[1] || '';
    const row = {i, name: names[i], ok: won && !bad, won, bad, clock, err: errors.slice()};
    results.push(row);
    console.log((row.ok ? 'PASS' : 'FAIL') + ' ' + i + ' ' + names[i] + ' ' + clock + (row.ok ? '' : '\n' + text.slice(-1500)));
  }
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
