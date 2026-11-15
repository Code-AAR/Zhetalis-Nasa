// Command window for the team. Press ` (backtick) or F2 to open. Type "help".
// Lets you trigger events on demand so nobody waits for a storm to roll in.
export function devConsole(cmds) {
  const css = document.createElement('style');
  css.textContent = `#dev-con{position:fixed;left:0;right:0;top:0;z-index:4000;background:rgba(6,10,14,.94);border-bottom:1px solid #5fe3ff55;font:13px/1.45 ui-monospace,Consolas,monospace;color:#cfe;display:none;padding:8px 12px}
#dev-con.on{display:block}#dev-con .out{max-height:34vh;overflow:auto;white-space:pre-wrap}#dev-con .out .e{color:#ff8a7a}#dev-con .out .k{color:#7dffb0}
#dev-con .row{display:flex;gap:8px;margin-top:6px}#dev-con .row b{color:#5fe3ff}#dev-con input{flex:1;background:transparent;border:0;outline:0;color:#fff;font:inherit}`;
  document.head.append(css);
  const el = document.createElement('div'); el.id = 'dev-con';
  el.innerHTML = '<div class="out"></div><div class="row"><b>&gt;</b><input spellcheck="false" autocomplete="off" placeholder="type help"></div>';
  document.body.append(el);
  const out = el.querySelector('.out'), inp = el.querySelector('input');
  const say = (t, c = '') => { const d = document.createElement('div'); d.className = c; d.textContent = t; out.append(d); out.scrollTop = 1e9; };
  const hist = []; let hi = 0;
  const list = () => Object.entries(cmds).map(([k, v]) => `  ${k.padEnd(12)} ${v.help}`).join('\n');
  const run = async line => {
    const [name, ...args] = line.trim().split(/\s+/); if (!name) return;
    if (name === 'help') return say('Commands:\n' + list() + '\n  help         this list\n  clear        wipe this window\n  close        hide (or press ` / Esc)');
    if (name === 'clear') return void (out.textContent = '');
    if (name === 'close') return toggle(false);
    const c = cmds[name]; if (!c) return say(`Unknown command "${name}". Type help.`, 'e');
    try { const r = await c.run(...args); say(r || 'ok', 'k'); } catch (e) { say(String(e.message || e), 'e'); }
  };
  const toggle = on => { el.classList.toggle('on', on); if (el.classList.contains('on')) { document.exitPointerLock?.(); inp.focus(); if (!out.children.length) say('Dev console. Type help.'); } else inp.blur(); };
  addEventListener('keydown', e => {
    const typing = e.target === inp;
    if ((e.key === '`' || e.key === 'F2') && !(typing && e.key === '`' && inp.value)) { e.preventDefault(); toggle(!el.classList.contains('on')); return; }
    if (!typing) return;
    e.stopPropagation();
    if (e.key === 'Escape') toggle(false);
    else if (e.key === 'Enter') { const v = inp.value; inp.value = ''; if (v.trim()) { hist.push(v); hi = hist.length; say('> ' + v); run(v); } }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); inp.value = hist[hi] || ''; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; e.preventDefault(); }
  }, true);
  return { toggle };
}
