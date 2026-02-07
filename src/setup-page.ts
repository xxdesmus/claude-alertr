export function getSetupPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>claude-alertr — Setup</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:#fafafa;color:#111827;line-height:1.5}
.container{max-width:640px;margin:0 auto;padding:0 20px}
header{padding:32px 0 24px}
header h1{font-size:24px;font-weight:700}
header p{color:#6b7280;font-size:16px}
.progress{display:flex;align-items:center;padding:16px 0 32px}
.progress-step{display:flex;align-items:center;gap:8px}
.progress-step .circle{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid #d1d5db;color:#9ca3af;flex-shrink:0}
.progress-step.active .circle{background:#4f46e5;border-color:#4f46e5;color:#fff}
.progress-step.completed .circle{background:#059669;border-color:#059669;color:#fff}
.progress-step .label{font-size:13px;color:#9ca3af;white-space:nowrap}
.progress-step.active .label{color:#111827;font-weight:600}
.progress-step.completed .label{color:#059669}
.progress-line{flex:1;height:2px;background:#e5e7eb;margin:0 8px}
.progress-line.completed{background:#059669}
.step{background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:24px;margin-bottom:16px;display:none}
.step.active{display:block}
.step h2{font-size:20px;font-weight:600;margin-bottom:16px}
label{display:block;font-size:14px;font-weight:500;margin-bottom:6px}
.input-group{margin-bottom:20px}
.input-wrapper{position:relative}
input[type="text"],input[type="password"],input[type="number"]{width:100%;height:40px;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:inherit}
input:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.helper{font-size:13px;color:#6b7280;margin-top:4px}
.helper code{background:#f3f4f6;padding:2px 5px;border-radius:3px;font-size:12px}
.toggle-vis{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:#9ca3af;font-size:18px;line-height:1}
.toggle-vis:hover{color:#6b7280}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;border:none;transition:background 150ms}
.btn-primary{background:#4f46e5;color:#fff}
.btn-primary:hover{background:#4338ca}
.btn-primary:disabled{background:#9ca3af;cursor:not-allowed}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.status{border-radius:6px;padding:12px 16px;margin-top:16px;border-left:4px solid;font-size:14px;display:none}
.status.visible{display:block}
.status.success{border-color:#059669;background:#ecfdf5}
.status.warning{border-color:#d97706;background:#fffbeb}
.status.error{border-color:#dc2626;background:#fef2f2}
.status strong{display:block;margin-bottom:4px}
.status code{background:rgba(0,0,0,.06);padding:2px 5px;border-radius:3px;font-size:12px}
.code-block{position:relative;background:#1e1e2e;border-radius:8px;padding:16px;margin:16px 0;overflow-x:auto}
.code-block pre{margin:0;color:#e2e8f0;font-size:13px;line-height:1.6;font-family:"SF Mono",SFMono-Regular,ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;white-space:pre;overflow-x:auto}
.copy-btn{position:absolute;top:8px;right:8px;background:rgba(255,255,255,.1);color:#e2e8f0;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit}
.copy-btn:hover{background:rgba(255,255,255,.2)}
.tabs{border-bottom:1px solid #e5e7eb;margin-bottom:16px;display:flex;gap:0}
.tab{padding:8px 16px;background:none;border:none;font-size:14px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.tab.active{color:#4f46e5;border-bottom-color:#4f46e5}
.tab-panel{display:none}
.tab-panel.active{display:block}
.slider-group{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.slider-group input[type="range"]{flex:1;accent-color:#4f46e5}
.slider-group input[type="number"]{width:72px;text-align:center}
.summary{margin:16px 0;font-size:14px}
.summary dt{color:#6b7280;font-weight:500}
.summary dd{margin:0 0 8px;font-family:"SF Mono",SFMono-Regular,ui-monospace,Menlo,Consolas,monospace;font-size:13px}
.completion{background:#ecfdf5;border:1px solid #059669;border-radius:8px;padding:20px;text-align:center;margin-top:16px}
.completion h3{color:#059669;font-size:18px;margin-bottom:8px}
details{margin-top:12px;font-size:14px;color:#6b7280}
details summary{cursor:pointer;font-weight:500}
details ul{margin-top:8px;padding-left:20px}
details li{margin-bottom:4px}
footer{padding:32px 0 48px;border-top:1px solid #e5e7eb;margin-top:32px;font-size:12px;color:#9ca3af;display:flex;gap:16px}
footer a{color:#6b7280;text-decoration:none}
footer a:hover{color:#4f46e5}
noscript .noscript-msg{max-width:640px;margin:40px auto;padding:20px;background:#fffbeb;border:1px solid #d97706;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
@media(max-width:480px){
  header h1{font-size:20px}
  .step{padding:16px}
  .step h2{font-size:18px}
  .progress-step .label{display:none}
  .slider-group{flex-direction:column;align-items:stretch}
  .slider-group input[type="number"]{width:100%}
  .copy-btn{position:static;display:block;width:100%;margin-top:8px;padding:8px;text-align:center;background:rgba(255,255,255,.15)}
}
@media(prefers-reduced-motion:reduce){
  .spinner{animation:none}
  *{transition:none!important}
}
</style>
</head>
<body>
<noscript><div class="noscript-msg"><strong>JavaScript Required</strong><p>This setup wizard requires JavaScript. Alternatively, follow the CLI instructions in the <a href="https://github.com/xxdesmus/claude-alertr#quick-start">README</a>.</p></div></noscript>
<div class="container">
<header>
  <h1>claude-alertr</h1>
  <p>Get notified when Claude Code is waiting for you.</p>
</header>

<nav class="progress" aria-label="Setup progress">
  <div class="progress-step active" data-step="1"><div class="circle">1</div><span class="label">Connect</span></div>
  <div class="progress-line" data-line="1"></div>
  <div class="progress-step" data-step="2"><div class="circle">2</div><span class="label">Configure</span></div>
  <div class="progress-line" data-line="2"></div>
  <div class="progress-step" data-step="3"><div class="circle">3</div><span class="label">Install</span></div>
  <div class="progress-line" data-line="3"></div>
  <div class="progress-step" data-step="4"><div class="circle">4</div><span class="label">Verify</span></div>
</nav>

<main>
  <section class="step active" id="step-1" aria-labelledby="s1h">
    <h2 id="s1h">Connect to Your Worker</h2>
    <div class="input-group">
      <label for="worker-url">Worker URL</label>
      <input type="text" id="worker-url" placeholder="https://claude-alertr.you.workers.dev">
      <p class="helper">The URL of your deployed Cloudflare Worker.</p>
    </div>
    <div class="input-group">
      <label for="auth-token">Auth Token</label>
      <div class="input-wrapper">
        <input type="password" id="auth-token" placeholder="Your AUTH_TOKEN secret">
        <button class="toggle-vis" type="button" aria-label="Show token" onclick="toggleVis()">&#x1f441;</button>
      </div>
      <p class="helper">The token you set via <code>wrangler secret put AUTH_TOKEN</code></p>
    </div>
    <button class="btn btn-primary" id="test-btn" onclick="testConn()" disabled>Test Connection</button>
    <div class="status" id="conn-status" role="status" aria-live="polite"></div>
    <button class="btn btn-primary" id="s1-next" style="display:none;margin-top:12px" onclick="goTo(2)">Continue</button>
  </section>

  <section class="step" id="step-2" aria-labelledby="s2h">
    <h2 id="s2h">Configure Alert Timing</h2>
    <p style="margin-bottom:16px;color:#6b7280">How long should Claude wait before alerting you?</p>
    <div class="slider-group">
      <input type="range" id="delay-range" min="15" max="300" step="15" value="60" oninput="syncDelay(this.value)">
      <input type="number" id="delay-input" min="15" max="300" step="15" value="60" oninput="syncDelay(this.value)">
      <span>seconds</span>
    </div>
    <p class="helper">60 seconds is recommended. Shorter delays may fire while you're still reading output.</p>
    <button class="btn btn-primary" style="margin-top:20px" onclick="goTo(3)">Continue</button>
  </section>

  <section class="step" id="step-3" aria-labelledby="s3h">
    <h2 id="s3h">Install Hooks</h2>
    <p style="margin-bottom:16px;color:#6b7280">Run this in your terminal to install Claude Code hooks.</p>
    <div class="tabs" role="tablist">
      <button class="tab active" role="tab" aria-selected="true" onclick="switchTab('quick')">Quick Setup</button>
      <button class="tab" role="tab" aria-selected="false" onclick="switchTab('clone')">Clone &amp; Install</button>
    </div>
    <div class="tab-panel active" id="tab-quick" role="tabpanel">
      <div class="code-block"><pre id="quick-cmd"></pre><button class="copy-btn" onclick="copyCmd('quick-cmd')">Copy</button></div>
    </div>
    <div class="tab-panel" id="tab-clone" role="tabpanel">
      <div class="code-block"><pre id="clone-cmd"></pre><button class="copy-btn" onclick="copyCmd('clone-cmd')">Copy</button></div>
      <p class="helper" style="margin-top:8px">When prompted, enter these values:</p>
      <dl class="summary" id="install-summary"></dl>
    </div>
    <details>
      <summary>What this does</summary>
      <ul>
        <li>Writes hook scripts to <code>~/.claude-alertr/hooks/</code></li>
        <li>Creates a config file at <code>~/.claude-alertr/config</code></li>
        <li>Registers hooks in <code>~/.claude/settings.json</code></li>
      </ul>
    </details>
    <button class="btn btn-primary" style="margin-top:20px" onclick="goTo(4)">Continue</button>
  </section>

  <section class="step" id="step-4" aria-labelledby="s4h">
    <h2 id="s4h">Verify Installation</h2>
    <p style="margin-bottom:16px;color:#6b7280">Send a test alert to confirm everything works end to end.</p>
    <button class="btn btn-primary" id="verify-btn" onclick="verify()">Send Test Alert</button>
    <div class="status" id="verify-status" role="status" aria-live="polite"></div>
    <div class="completion" id="done" style="display:none">
      <h3>All Set!</h3>
      <p>Claude Code will alert you when it has been waiting for more than <strong id="done-delay">60</strong> seconds.</p>
      <p style="margin-top:12px;font-size:13px;color:#6b7280">To uninstall later, run <code>./uninstall.sh</code> from the repo.</p>
    </div>
  </section>
</main>

<footer>
  <a href="https://github.com/xxdesmus/claude-alertr" target="_blank" rel="noopener">GitHub</a>
  <span>v1.0.0</span>
</footer>
</div>

<script>
// NOTE: All user-controlled values are escaped via esc() before DOM insertion.
// The innerHTML usage below only renders static HTML templates with pre-escaped dynamic values.
var S={step:1,url:location.origin,token:'',delay:60};
var g=function(id){return document.getElementById(id)};

g('worker-url').value=S.url;
g('worker-url').addEventListener('input',updBtn);
g('auth-token').addEventListener('input',updBtn);

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function updBtn(){
  S.url=g('worker-url').value.trim().replace(/\\/$/,'');
  S.token=g('auth-token').value.trim();
  g('test-btn').disabled=!S.url||!S.token;
}

function toggleVis(){
  var i=g('auth-token'),b=i.parentElement.querySelector('.toggle-vis');
  i.type=i.type==='password'?'text':'password';
  b.setAttribute('aria-label',i.type==='password'?'Show token':'Hide token');
}

function syncDelay(v){
  v=Math.min(300,Math.max(15,parseInt(v)||60));
  g('delay-range').value=v;g('delay-input').value=v;S.delay=v;
}

function showSt(id,type,content){var e=g(id);e.className='status visible '+type;e.textContent='';e.insertAdjacentHTML('afterbegin',content)}
function hideSt(id){g(id).className='status';g(id).textContent=''}

function fmtChannels(body){
  var c='';
  if(body.results){for(var k in body.results){
    var safe=esc(k);
    c+='<br>'+safe+': '+(body.results[k]?'<span style="color:#059669">delivered</span>':'<span style="color:#d97706">failed to deliver</span>');
  }}
  return c;
}

async function testConn(){
  var b=g('test-btn');b.disabled=true;b.textContent='';b.insertAdjacentHTML('afterbegin','<span class="spinner"></span> Testing\\u2026');
  hideSt('conn-status');g('s1-next').style.display='none';
  try{
    var ac=new AbortController();setTimeout(function(){ac.abort()},10000);
    var r=await fetch(S.url+'/test',{method:'POST',headers:{'Authorization':'Bearer '+S.token},signal:ac.signal});
    var d=await r.json();
    if(r.status===200&&d.ok){
      showSt('conn-status','success','<strong>Connected successfully.</strong>'+fmtChannels(d));
      g('s1-next').style.display='';
    }else if(r.status===401){
      showSt('conn-status','error','<strong>Authentication failed.</strong> The token does not match the AUTH_TOKEN on your Worker.');
    }else if(r.status===503){
      showSt('conn-status','error','<strong>AUTH_TOKEN not configured on the Worker.</strong><br>Run: <code>wrangler secret put AUTH_TOKEN</code>');
    }else if(r.status===500){
      showSt('conn-status','warning','<strong>Connected, but no notification channels configured.</strong><br>Set at least one via <code>wrangler secret put WEBHOOK_URL</code> or <code>wrangler secret put RESEND_API_KEY</code>');
    }else if(r.status===429){
      showSt('conn-status','error','<strong>Rate limited.</strong> Wait a minute and try again.');
    }else{
      showSt('conn-status','error','<strong>Unexpected response (HTTP '+r.status+')</strong><br><code>'+esc(JSON.stringify(d))+'</code>');
    }
  }catch(e){
    showSt('conn-status','error',e.name==='AbortError'?'<strong>Request timed out.</strong> Check your network and Worker URL.':'<strong>Could not reach the Worker.</strong> Check the URL and ensure it is deployed.');
  }
  b.disabled=false;b.textContent='Test Connection';
}

function goTo(step){
  var prev=document.querySelector('.progress-step[data-step="'+S.step+'"]');
  prev.classList.remove('active');prev.classList.add('completed');
  prev.querySelector('.circle').textContent='\\u2713';
  for(var i=S.step;i<step;i++){var ln=document.querySelector('.progress-line[data-line="'+i+'"]');if(ln)ln.classList.add('completed')}
  document.querySelector('.progress-step[data-step="'+step+'"]').classList.add('active');
  g('step-'+S.step).classList.remove('active');g('step-'+step).classList.add('active');
  S.step=step;
  if(step===3)genCmds();
  if(step===4)g('done-delay').textContent=S.delay;
  g('step-'+step).scrollIntoView({behavior:'smooth',block:'start'});
}

function genCmds(){
  var u=S.url,t=S.token,d=S.delay;
  g('quick-cmd').textContent=
'# Install claude-alertr hooks\\n'+
'set -e\\n'+
'mkdir -p ~/.claude-alertr/hooks\\n'+
'\\n'+
'# Write config\\n'+
"cat > ~/.claude-alertr/config << 'CONF'\\n"+
'CLAUDE_ALERTR_URL="'+u+'"\\n'+
'CLAUDE_ALERTR_TOKEN="'+t+'"\\n'+
'CLAUDE_ALERTR_DELAY="'+d+'"\\n'+
'CONF\\n'+
'chmod 600 ~/.claude-alertr/config\\n'+
'\\n'+
'# Download hooks\\n'+
'curl -fsSL https://raw.githubusercontent.com/xxdesmus/claude-alertr/main/hooks/idle-alert.sh \\\\\\n'+
'  -o ~/.claude-alertr/hooks/idle-alert.sh\\n'+
'curl -fsSL https://raw.githubusercontent.com/xxdesmus/claude-alertr/main/hooks/dismiss-alert.sh \\\\\\n'+
'  -o ~/.claude-alertr/hooks/dismiss-alert.sh\\n'+
'chmod +x ~/.claude-alertr/hooks/*.sh\\n'+
'\\n'+
'# Register with Claude Code (requires jq)\\n'+
'mkdir -p ~/.claude\\n'+
'[ -f ~/.claude/settings.json ] || echo \\'{}\\' > ~/.claude/settings.json\\n'+
'UPDATED=$(jq \\\\\\n'+
'  --arg idle "$HOME/.claude-alertr/hooks/idle-alert.sh" \\\\\\n'+
'  --arg dismiss "$HOME/.claude-alertr/hooks/dismiss-alert.sh" \\\\\\n'+
"  '.hooks //= {} | .hooks.Notification //= [] | .hooks.UserPromptSubmit //= [] |\\n"+
'   .hooks.Notification = [.hooks.Notification[] | select((.hooks[0].command // "") | test("claude-alertr") | not)] +\\n'+
'   [{"matcher":"","hooks":[{"type":"command","command":$idle,"timeout":5}]}] |\\n'+
'   .hooks.UserPromptSubmit = [.hooks.UserPromptSubmit[] | select((.hooks[0].command // "") | test("claude-alertr") | not)] +\\n'+
"   [{\"matcher\":\"\",\"hooks\":[{\"type\":\"command\",\"command\":$dismiss,\"timeout\":5}]}]' \\\\\\n"+
'  ~/.claude/settings.json)\\n'+
'echo "$UPDATED" | jq . > ~/.claude/settings.json\\n'+
'\\n'+
'echo "claude-alertr installed successfully!"';

  g('clone-cmd').textContent=
'git clone https://github.com/xxdesmus/claude-alertr.git /tmp/claude-alertr && \\\\\\n'+
'  /tmp/claude-alertr/install.sh';

  var m=t.length>8?t.slice(0,4)+'\\u2026'+t.slice(-4):'****';
  var summaryEl=g('install-summary');
  summaryEl.textContent='';
  summaryEl.insertAdjacentHTML('afterbegin',
    '<dt>Worker URL</dt><dd>'+esc(u)+'</dd>'+
    '<dt>Auth Token</dt><dd>'+esc(m)+'</dd>'+
    '<dt>Alert Delay</dt><dd>'+d+'s</dd>');
}

function switchTab(t){
  document.querySelectorAll('.tab').forEach(function(e){e.classList.remove('active');e.setAttribute('aria-selected','false')});
  document.querySelectorAll('.tab-panel').forEach(function(e){e.classList.remove('active')});
  if(t==='quick'){document.querySelectorAll('.tab')[0].classList.add('active');document.querySelectorAll('.tab')[0].setAttribute('aria-selected','true');g('tab-quick').classList.add('active')}
  else{document.querySelectorAll('.tab')[1].classList.add('active');document.querySelectorAll('.tab')[1].setAttribute('aria-selected','true');g('tab-clone').classList.add('active')}
}

async function copyCmd(id){
  var text=g(id).textContent,btn=g(id).parentElement.querySelector('.copy-btn');
  try{await navigator.clipboard.writeText(text);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},2000)}
  catch(e){var r=document.createRange();r.selectNodeContents(g(id));window.getSelection().removeAllRanges();window.getSelection().addRange(r);btn.textContent='Press Ctrl+C';setTimeout(function(){btn.textContent='Copy'},3000)}
}

async function verify(){
  var b=g('verify-btn');b.disabled=true;b.textContent='';b.insertAdjacentHTML('afterbegin','<span class="spinner"></span> Sending\\u2026');
  hideSt('verify-status');
  try{
    var ac=new AbortController();setTimeout(function(){ac.abort()},10000);
    var r=await fetch(S.url+'/test',{method:'POST',headers:{'Authorization':'Bearer '+S.token},signal:ac.signal});
    var d=await r.json();
    if(r.status===200&&d.ok){
      showSt('verify-status','success','<strong>Test alert sent!</strong> Check your notification channels.'+fmtChannels(d));
      g('done').style.display='';
    }else{
      showSt('verify-status','error','<strong>Failed (HTTP '+r.status+')</strong><br><code>'+esc(JSON.stringify(d))+'</code>');
    }
  }catch(e){
    showSt('verify-status','error','<strong>Could not reach the Worker.</strong> Check your connection.');
  }
  b.disabled=false;b.textContent='Send Test Alert';
}
</script>
</body>
</html>`;
}
