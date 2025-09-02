const socket = io();
let currentUser = null;

// Dom helpers
// const $ = (id) => document.getElementById(id);
const $ = new Proxy({}, { get: (_, key) => (typeof key === 'string' ? document.getElementById(key) : undefined) });

async function register(){
    const username = $.username?.value.trim();
    const password = $.password?.value.trim();
    if (!username || !password) {
        $.authMsg.textContent = 'Username and password required';
        return;
    }
    try {
        const res = await fetch('/register', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username, password})
        });
        const data = await res.json();
        $.authMsg.textContent = data.success ? 'Registered!' : 'Failed: ' + (data.message || 'Error');
    } catch {
        $.authMsg.textContent = 'Failed: network error';
    }
}

// Expose for inline onclick
window.register = register;

async function login(){
    const username = $.username?.value.trim();
    const password = $.password?.value.trim();
    if (!username || !password) {
        $.authMsg.textContent = 'Username and password required';
        return;
    }
    try {
        const res = await fetch('/login', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username, password})
        });
        const data = await res.json();
        if(data.success){
            currentUser = data.username;
            $.auth.style.display='none';
            $.chatUI.style.display='block';
            socket.emit('join', currentUser);
        } else {
            $.authMsg.textContent = data.message || 'Login failed';
        }
    } catch {
        $.authMsg.textContent = 'Login failed: network error';
    }
}

// Expose for inline onclick
window.login = login;

const msgEl = $.msg;
if (msgEl) {
    msgEl.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendMsg(); } });
}

function sendMsg(){
    const input = $.msg;
    const msg = input.value.trim();
    if(!msg) return;
    socket.emit('chatMessage',{text:msg});
    input.value='';
}

const imgInput = $.imgUpload;
if (imgInput) {
    imgInput.addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(!file) return;
        if (!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)) {
            alert('Unsupported image type');
            e.target.value = '';
            return;
        }
        if (file.size > 5*1024*1024) {
            alert('Image too large (max 5MB)');
            e.target.value = '';
            return;
        }
        const formData = new FormData();
        formData.append('image',file);
        try {
            const res = await fetch('/upload',{method:'POST',body:formData});
            const data = await res.json();
            if(data.success){
                socket.emit('chatMessage',{text:'[Image]',image:data.path});
            } else {
                alert(data.message || 'Upload failed');
            }
        } catch {
            alert('Upload failed: network error');
        } finally {
            e.target.value = '';
        }
    });
}

socket.on('connect', () => {
    if (currentUser) socket.emit('join', currentUser);
});

socket.on('loadMessages', (msgs)=>{
    const chat = $.chat;
    chat.innerHTML = ''; // clear on (re)join to avoid duplicates
    msgs.forEach((m,i)=>displayMessage(m,i));
});

socket.on('message',(msg,index)=>displayMessage(msg,index));

function displayMessage(msg,index){
    const chat=$.chat;
    const div=document.createElement('div');
    div.classList.add('message');
    div.dataset.index=index;

    const textSpan=document.createElement('span');
    textSpan.textContent=msg.to?`[PM] ${msg.user} → ${msg.to}: ${msg.text}`:`${msg.user}: ${msg.text}`;
    div.appendChild(textSpan);

    if(msg.image){
        const img=document.createElement('img');
        img.src=msg.image;
        img.alt = 'uploaded image';
        div.appendChild(img);
    }

    if(currentUser==='Serpentine'){
        const editBtn=document.createElement('button');
        editBtn.textContent='Edit';
        editBtn.onclick=()=>{
            textSpan.contentEditable=true;
            textSpan.focus();
            textSpan.style.backgroundColor='#444';

            const save=(e)=>{
                if(e.type==='keydown'&&e.key!=='Enter') return;
                e.preventDefault();
                textSpan.contentEditable=false;
                textSpan.style.backgroundColor='';
                fetch('/edit',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({index,newText:textSpan.textContent.trim()})
                }).catch(()=>{});
                textSpan.removeEventListener('keydown',save);
                textSpan.removeEventListener('blur',save);
            };
            textSpan.addEventListener('keydown',save);
            textSpan.addEventListener('blur',save);
        };

        const delBtn=document.createElement('button');
        delBtn.textContent='Delete';
        delBtn.onclick=()=>fetch('/delete',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({index})
        }).catch(()=>{});
        div.appendChild(editBtn);
        div.appendChild(delBtn);
    }

    chat.appendChild(div);
    chat.scrollTop=chat.scrollHeight;
}

socket.on('updateMessage',({index,newText})=>{
    const span=document.querySelector(`.message[data-index="${index}"] span`);
    if(span) span.textContent=newText;
});

socket.on('deleteMessage',({index})=>{
    const msgDiv=document.querySelector(`.message[data-index="${index}"]`);
    if(msgDiv) msgDiv.remove();
});

socket.on('onlineUsers',(users)=>{
    $.onlineUsers.textContent="Online: "+users.join(', ');
});

function setTheme(theme){
    document.body.className=theme;
    try { localStorage.setItem('theme', theme); } catch {}
}

// Auto login if session exists + restore theme
window.onload=async()=>{
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setTheme(savedTheme);
            const sel = document.getElementById('themeSelect');
            if (sel) sel.value = savedTheme;
        }
    } catch {}
    try {
        const res = await fetch('/session');
        const data = await res.json();
        if (data.loggedIn) {
            currentUser = data.username;
            $.auth.style.display = 'none';
            $.chatUI.style.display = 'block';
            socket.emit('join', currentUser);
        }
    } catch { /* ignore */ }
};
