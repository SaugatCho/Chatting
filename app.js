/* Chatting — app logic
   Static/local-only edition: localStorage is scoped to this browser and device.
   Do not treat these client-side accounts as secure server authentication.
*/
const USERS_KEY = "chat_users";
    const CURRENT_USER_KEY = "chat_current_user";
    const MESSAGES_KEY = "chat_messages";
    const SETTINGS_KEY = "chat_settings";
    const THEME_KEY = "chat_theme";

    function readJSON(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (error) {
        console.warn("Could not read local data:", key, error);
        return fallback;
      }
    }

    let users = readJSON(USERS_KEY, {});
    let currentUser = localStorage.getItem(CURRENT_USER_KEY);
    let settings = Object.assign(
      { showTimestamps: true, soundNotifications: true },
      readJSON(SETTINGS_KEY, {})
    );
    let isDarkMode = localStorage.getItem(THEME_KEY) !== "light";

    function saveUsers() {
      try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return true;
      } catch (error) {
        alert("Could not save accounts. Browser storage may be full or unavailable.");
        return false;
      }
    }

    function getMessages() {
      const value = readJSON(MESSAGES_KEY, []);
      return Array.isArray(value) ? value : [];
    }

    function saveMessages(msgs) {
      try {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
        return true;
      } catch (error) {
        alert("Browser storage is full. Export a backup and remove some attachments.");
        return false;
      }
    }

    function saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
      } catch (error) {
        alert("Could not save settings in this browser.");
        return false;
      }
    }

    const PASSWORD_HASH_ITERATIONS = 210000;

    function toBase64(bytes) {
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }

    async function hashPassword(password) {
      if (!window.crypto || !window.crypto.subtle) throw new Error("Password hashing needs the HTTPS GitHub Pages site.");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
      );
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: PASSWORD_HASH_ITERATIONS, hash: "SHA-256" },
        key, 256
      );
      return { algorithm: "PBKDF2-SHA-256", iterations: PASSWORD_HASH_ITERATIONS,
        salt: toBase64(salt), hash: toBase64(new Uint8Array(bits)) };
    }

    async function verifyPassword(password, record) {
      // Old accounts used plaintext local passwords; upgrade them after a successful login.
      if (typeof record === "string") return password === record;
      if (!record || record.algorithm !== "PBKDF2-SHA-256" ||
          !Number.isInteger(record.iterations) || record.iterations < 10000 || record.iterations > 1000000 ||
          typeof record.salt !== "string" || typeof record.hash !== "string" ||
          !window.crypto || !window.crypto.subtle) return false;
      try {
        const salt = Uint8Array.from(atob(record.salt), c => c.charCodeAt(0));
        const expected = Uint8Array.from(atob(record.hash), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey(
          "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
        );
        const bits = new Uint8Array(await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt, iterations: record.iterations, hash: "SHA-256" },
          key, expected.length * 8
        ));
        if (bits.length !== expected.length) return false;
        let different = 0;
        for (let i = 0; i < bits.length; i++) different |= bits[i] ^ expected[i];
        return different === 0;
      } catch (_) {
        return false;
      }
    }

    function updateTime() {
      const now = new Date();
      let h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      document.getElementById("timeDisplay").textContent = `${h}:${m}:${s} ${ampm}`;
    }

    setInterval(updateTime, 1000);
    updateTime();

    function toggleTheme() {
      isDarkMode = !isDarkMode;
      localStorage.setItem(THEME_KEY, isDarkMode ? "dark" : "light");
      document.body.classList.toggle("light-mode", !isDarkMode);
      document.getElementById("themeIcon").textContent = isDarkMode ? "🌙" : "☀️";
    }

    function applyTheme() {
      if (!isDarkMode) {
        document.body.classList.add("light-mode");
        document.getElementById("themeIcon").textContent = "☀️";
      } else {
        document.getElementById("themeIcon").textContent = "🌙";
      }
    }

    function showError(msg) {
      const box = document.getElementById("authError");
      box.textContent = msg;
      box.classList.add("show");
      setTimeout(() => box.classList.remove("show"), 4000);
    }

    function showSettingsError(msg) {
      const box = document.getElementById("settingsError");
      box.textContent = msg;
      box.classList.add("show");
      setTimeout(() => box.classList.remove("show"), 4000);
    }

    function showSettingsSuccess(msg) {
      const box = document.getElementById("settingsSuccess");
      box.textContent = msg;
      box.classList.add("show");
      setTimeout(() => box.classList.remove("show"), 3000);
    }

    function toggleForm(form) {
      document.getElementById("signupForm").classList.toggle("hidden", form !== "signup");
      document.getElementById("loginForm").classList.toggle("hidden", form !== "login");
      document.getElementById("authError").classList.remove("show");
    }

    async function signup() {
      const username = document.getElementById("signupUsername").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirm = document.getElementById("signupConfirm").value;

      if (!username || !password || !confirm) return showError("All fields required");
      if (username.length > 32) return showError("Username must be 32 characters or fewer");
      if (password.length < 8) return showError("Use a password of at least 8 characters");
      if (password !== confirm) return showError("Passwords don't match");
      if (Object.prototype.hasOwnProperty.call(users, username)) return showError("Username already exists on this browser");

      try {
        users[username] = await hashPassword(password);
        if (!saveUsers()) { delete users[username]; return; }
        currentUser = username;
        localStorage.setItem(CURRENT_USER_KEY, currentUser);
        document.getElementById("signupPassword").value = "";
        document.getElementById("signupConfirm").value = "";
        showChat();
      } catch (error) {
        showError(error.message || "Could not create a local account");
      }
    }

    async function login() {
      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;
      if (!username || !password) return showError("Username and password required");

      const record = users[username];
      if (!record || !(await verifyPassword(password, record))) return showError("Invalid local credentials");

      // Upgrade an older plaintext account after the owner proves the password.
      if (typeof record === "string" && window.crypto && window.crypto.subtle) {
        try {
          users[username] = await hashPassword(password);
          saveUsers();
        } catch (error) {
          console.warn("Could not upgrade old local password record:", error);
        }
      }

      currentUser = username;
      localStorage.setItem(CURRENT_USER_KEY, currentUser);
      document.getElementById("loginPassword").value = "";
      showChat();
    }

    function logout() {
      if (!confirm("Log out?")) return;
      currentUser = null;
      localStorage.removeItem(CURRENT_USER_KEY);
      document.getElementById("authScreen").style.display = "flex";
      document.getElementById("chatScreen").style.display = "none";
      document.getElementById("signupForm").classList.remove("hidden");
      document.getElementById("loginForm").classList.add("hidden");
    }

    function showChat() {
      document.getElementById("authScreen").style.display = "none";
      document.getElementById("chatScreen").style.display = "flex";
      document.getElementById("userBadge").textContent = currentUser;
      renderMessages();
      updateOnlineCount();
    }

    function escapeHTML(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[character]);
    }

    function renderMessages() {
      const msgs = getMessages();
      const container = document.getElementById("messagesContainer");
      if (!msgs.length) {
        container.innerHTML = '<div class="empty-state">Start a conversation</div>';
        return;
      }

      container.innerHTML = msgs.map(msg => {
        const isOwn = msg.user === currentUser;
        const time = settings.showTimestamps ? formatTime(msg.time) : "";
        const user = escapeHTML(msg.user || "Unknown");
        const text = escapeHTML(msg.text || "");
        let content = '<div class="message-info">' + user +
          (time ? " • " + escapeHTML(time) : "") +
          '</div><div class="message-text">' + text + '</div>';

        if (msg.type === "image" && typeof msg.content === "string" && msg.content.startsWith("data:image/")) {
          content += '<img src="' + escapeHTML(msg.content) + '" class="message-image" alt="Shared image">';
        } else if (msg.type === "video" && typeof msg.content === "string" && msg.content.startsWith("data:video/")) {
          content += '<video controls class="message-video"><source src="' + escapeHTML(msg.content) + '"></video>';
        } else if (msg.type === "file" && typeof msg.content === "string" && msg.content.startsWith("data:")) {
          const filename = escapeHTML(msg.fileName || "download");
          content += '<a href="' + escapeHTML(msg.content) + '" download="' + filename +
            '" class="message-file">📁 ' + filename + '</a>';
        }

        return '<div class="message-group ' + (isOwn ? "sent" : "") +
          '"><div class="message-bubble">' + content + '</div></div>';
      }).join("");

      container.querySelectorAll(".message-image").forEach(image => {
        image.addEventListener("click", () => viewImage(image.src));
      });
      container.scrollTop = container.scrollHeight;
    }

    function formatTime(iso) {
      const d = new Date(iso);
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m}:${s} ${ampm}`;
    }

    function sendMessage() {
      const input = document.getElementById("messageInput");
      const text = input.value.trim();
      if (!text || !currentUser) return;
      const msgs = getMessages();
      msgs.push({ user: currentUser, text: text.slice(0, 4000), type: "text", time: new Date().toISOString() });
      if (!saveMessages(msgs)) return;
      renderMessages();
      input.value = "";
      if (settings.soundNotifications) playSound();
    }

    document.getElementById("fileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Base64 data URLs use extra space and localStorage is limited—keep local attachments small.
      if (file.size > 1024 * 1024) {
        alert("Local-only mode supports attachments up to 1 MB. Larger files can fill browser storage.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => { alert("Could not read that file."); e.target.value = ""; };
      reader.onload = (event) => {
        const msgs = getMessages();
        let type = "file";
        if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("video/")) type = "video";
        msgs.push({
          user: currentUser, text: "Shared a " + type, type,
          content: event.target.result, fileName: file.name.slice(0, 180),
          time: new Date().toISOString()
        });
        if (saveMessages(msgs)) {
          renderMessages();
          if (settings.soundNotifications) playSound();
        }
        e.target.value = "";
      };
      reader.readAsDataURL(file);
    });

    async function exportBackup() {
      try {
        const backup = {
          format: "chatting-local-backup", version: 1, exportedAt: new Date().toISOString(),
          users, messages: getMessages(), settings,
          theme: isDarkMode ? "dark" : "light"
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "chatting-backup-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showSettingsSuccess("Backup exported. Keep the file private.");
      } catch (error) {
        showSettingsError("Could not export a backup.");
      }
    }

    document.getElementById("backupFileInput").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error("Backup is too large (10 MB maximum).");
        const backup = JSON.parse(await file.text());
        if (!backup || backup.format !== "chatting-local-backup" || backup.version !== 1 ||
            !backup.users || typeof backup.users !== "object" || Array.isArray(backup.users) ||
            !Array.isArray(backup.messages) || backup.messages.length > 10000 ||
            !backup.settings || typeof backup.settings !== "object" ||
            !["dark", "light"].includes(backup.theme)) throw new Error("This is not a valid Chatting backup.");

        if (!confirm("Import this backup and REPLACE the data in this browser? Export a backup of current data first if you want to keep it.")) return;

        const importedUsers = {};
        for (const [name, record] of Object.entries(backup.users)) {
          if (!name.trim() || name.length > 32) continue;
          if (typeof record === "string") {
            // Old backup records stored passwords as plain strings: hash them on import.
            importedUsers[name] = await hashPassword(record);
          } else if (record && record.algorithm === "PBKDF2-SHA-256" &&
                     typeof record.salt === "string" && typeof record.hash === "string" &&
                     Number.isInteger(record.iterations) && record.iterations >= 10000 && record.iterations <= 1000000) {
            importedUsers[name] = record;
          }
        }
        const importedMessages = backup.messages.filter(m => m && typeof m === "object" &&
          typeof m.user === "string" && typeof m.text === "string" && typeof m.time === "string" &&
          ["text", "image", "video", "file"].includes(m.type)).map(m => ({
            user: m.user.slice(0, 32), text: m.text.slice(0, 4000), type: m.type,
            time: m.time,
            ...(typeof m.content === "string" ? { content: m.content } : {}),
            ...(typeof m.fileName === "string" ? { fileName: m.fileName.slice(0, 180) } : {})
          }));

        const keys = [USERS_KEY, MESSAGES_KEY, SETTINGS_KEY, THEME_KEY, CURRENT_USER_KEY];
        const previous = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
        try {
          localStorage.setItem(USERS_KEY, JSON.stringify(importedUsers));
          localStorage.setItem(MESSAGES_KEY, JSON.stringify(importedMessages));
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            showTimestamps: Boolean(backup.settings.showTimestamps),
            soundNotifications: Boolean(backup.settings.soundNotifications)
          }));
          localStorage.setItem(THEME_KEY, backup.theme);
          localStorage.removeItem(CURRENT_USER_KEY);
        } catch (storageError) {
          for (const key of keys) {
            if (previous[key] === null) localStorage.removeItem(key);
            else localStorage.setItem(key, previous[key]);
          }
          throw new Error("Backup exceeds browser storage limit. Previous data was restored.");
        }
        alert("Backup imported. The page will reload; sign in with an account from the backup.");
        location.reload();
      } catch (error) {
        alert(error.message || "Could not import this backup.");
      } finally {
        event.target.value = "";
      }
    });

        function viewImage(src) {
      document.getElementById("viewerImg").src = src;
      document.getElementById("imageViewer").classList.add("show");
    }

    function closeImageViewer() {
      document.getElementById("imageViewer").classList.remove("show");
    }

    function playSound() {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }

    document.getElementById("messageInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    function updateOnlineCount() {
      const count = Object.keys(users).length;
      document.getElementById("onlineCount").textContent = count;
    }

    function openOnlineUsers() {
      const list = document.getElementById("onlineUsersList");
      const names = Object.keys(users);

      if (!names.length) {
        list.innerHTML = "<div class='user-item'>No saved accounts on this browser</div>";
      } else {
        list.innerHTML = names.map(name => `
          <div class="user-item">
            <div class="online-dot"></div>
            <span class="username">${escapeHTML(name)}</span>
            ${name === currentUser ? '<span class="badge">You</span>' : ""}
          </div>
        `).join("");
      }

      document.getElementById("onlineUsersModal").classList.add("show");
    }

    function closeOnlineUsers() {
      document.getElementById("onlineUsersModal").classList.remove("show");
    }

    function openSettings() {
      document.getElementById("settingsModal").classList.add("show");
    }

    function closeSettings() {
      document.getElementById("settingsModal").classList.remove("show");
    }

    async function changeUsername() {
      const pass = document.getElementById("passForUsername").value;
      const newUname = document.getElementById("newUsername").value.trim();
      if (!pass || !newUname) return showSettingsError("Fill all fields");
      if (newUname.length > 32) return showSettingsError("Username must be 32 characters or fewer");
      if (!(await verifyPassword(pass, users[currentUser]))) return showSettingsError("Wrong password");
      if (Object.prototype.hasOwnProperty.call(users, newUname)) return showSettingsError("Username already exists on this browser");

      const oldUname = currentUser;
      users[newUname] = users[oldUname];
      delete users[oldUname];
      const msgs = getMessages();
      msgs.forEach(m => { if (m.user === oldUname) m.user = newUname; });
      const oldUsers = localStorage.getItem(USERS_KEY);
      const oldMessages = localStorage.getItem(MESSAGES_KEY);
      try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
      } catch (error) {
        if (oldUsers === null) localStorage.removeItem(USERS_KEY); else localStorage.setItem(USERS_KEY, oldUsers);
        if (oldMessages === null) localStorage.removeItem(MESSAGES_KEY); else localStorage.setItem(MESSAGES_KEY, oldMessages);
        users = readJSON(USERS_KEY, {});
        return showSettingsError("Could not save the username change. No change was made.");
      }

      currentUser = newUname;
      localStorage.setItem(CURRENT_USER_KEY, currentUser);
      document.getElementById("userBadge").textContent = currentUser;
      showSettingsSuccess("Username updated on this browser!");
      document.getElementById("passForUsername").value = "";
      document.getElementById("newUsername").value = "";
      renderMessages();
      updateOnlineCount();
    }

    async function changePassword() {
      const old = document.getElementById("oldPass").value;
      const newp = document.getElementById("newPass").value;
      const conf = document.getElementById("confirmPass").value;
      if (!old || !newp || !conf) return showSettingsError("Fill all fields");
      if (!(await verifyPassword(old, users[currentUser]))) return showSettingsError("Wrong password");
      if (newp.length < 8) return showSettingsError("Password must be at least 8 characters");
      if (newp !== conf) return showSettingsError("Passwords don't match");

      try {
        users[currentUser] = await hashPassword(newp);
        if (!saveUsers()) return;
        showSettingsSuccess("Local password updated!");
        document.getElementById("oldPass").value = "";
        document.getElementById("newPass").value = "";
        document.getElementById("confirmPass").value = "";
      } catch (error) {
        showSettingsError(error.message || "Could not update the password");
      }
    }

    function toggleTimestamps() {
      settings.showTimestamps = !settings.showTimestamps;
      saveSettings();
      renderMessages();
      document.querySelector('[onclick="toggleTimestamps()"]').classList.toggle("active");
    }

    function toggleNotifications() {
      settings.soundNotifications = !settings.soundNotifications;
      saveSettings();
      document.querySelector('[onclick="toggleNotifications()"]').classList.toggle("active");
    }

    function deleteAccount() {
      if (!confirm('Delete local account "' + currentUser + '" and its messages in this browser? This cannot be undone.')) return;
      const deletedUser = currentUser;
      const nextUsers = Object.assign({}, users);
      delete nextUsers[deletedUser];
      const nextMessages = getMessages().filter(m => m.user !== deletedUser);
      const previousUsers = localStorage.getItem(USERS_KEY);
      const previousMessages = localStorage.getItem(MESSAGES_KEY);
      try {
        localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(nextMessages));
      } catch (error) {
        if (previousUsers === null) localStorage.removeItem(USERS_KEY); else localStorage.setItem(USERS_KEY, previousUsers);
        if (previousMessages === null) localStorage.removeItem(MESSAGES_KEY); else localStorage.setItem(MESSAGES_KEY, previousMessages);
        return alert("Could not delete the account because browser storage failed.");
      }
      users = nextUsers;
      currentUser = null;
      localStorage.removeItem(CURRENT_USER_KEY);
      closeSettings();
      document.getElementById("authScreen").style.display = "flex";
      document.getElementById("chatScreen").style.display = "none";
      document.getElementById("signupForm").classList.remove("hidden");
      document.getElementById("loginForm").classList.add("hidden");
      updateOnlineCount();
    }

    // Initialize once after the document has been parsed.
    applyTheme();
    if (currentUser && users[currentUser]) {
      showChat();
    } else {
      document.getElementById("authScreen").style.display = "flex";
      document.getElementById("chatScreen").style.display = "none";
    }
