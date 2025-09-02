const socket = io();
let currentUser;

document.getElementById("register-form").onsubmit = async e => {
    e.preventDefault();
    const res = await fetch("/register", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
            username: document.getElementById("reg-username").value,
            password: document.getElementById("reg-password").value
        })
    });
    const data = await res.json();
    alert(data.message || "Registered successfully!");
};

document.getElementById("login-form").onsubmit = async e => {
    e.preventDefault();
    const res = await fetch("/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
            username: document.getElementById("login-username").value,
            password: document.getElementById("login-password").value
        })
    });
    const data = await res.json();
    if (data.success) {
        currentUser = data.username;
        document.getElementById("auth-container").style.display="none";
        document.getElementById("chat-container").style.display="block";
        socket.emit("join", currentUser);
    } else alert(data.message);
};

// Theme switcher
document.getElementById("theme-select").onchange = e => {
    document.body.className = e.target.value;
};

// Chat form
document.getElementById("chat-form").onsubmit = async e => {
    e.preventDefault();
    const message = document.getElementById("chat-input").value;
    const to = document.getElementById("chat-to").value;
    const fileInput = document.getElementById("chat-image");

    let fileUrl = null;
    if(fileInput.files.length>0){
        const formData = new FormData();
        formData.append("image", fileInput.files[0]);
        const res = await fetch("/upload", { method:"POST", body: formData });
        const data = await res.json();
        if(data.success) fileUrl = data.file;
    }

    socket.emit("chat", { from: currentUser, to: to || null, message, image: fileUrl });
    document.getElementById("chat-input").value = "";
    fileInput.value = "";
};

socket.on("chat", data => {
    const msgDiv = document.createElement("div");
    let text = `[${data.from}${data.to ? " → " + data.to : ""}]: ${data.message || ""}`;
    if(data.image) text += ` <img src="${data.image}" width="100">`;
    msgDiv.innerHTML = text;
    document.getElementById("messages").appendChild(msgDiv);
});

socket.on("userlist", users => {
    document.getElementById("users").innerText = "Online: " + users.join(", ");
});
