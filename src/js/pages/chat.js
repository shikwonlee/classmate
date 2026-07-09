import { createChat, joinChatByCode, listMyChats } from "../firebase/firestore.js";
import { sendMessage, watchMessages, setTyping, watchTyping } from "../firebase/realtime.js";

let uid = null;
let displayName = "";
let messagesUnsub = null;
let typingUnsub = null;

function chatRow(chat) {
  return `
    <a href="#/chat/${chat.id}" class="card" style="display:flex; align-items:center; gap: var(--space-3); margin-bottom: var(--space-3);">
      <div class="avatar" style="background:${chat.themeColor || "#5B4FE8"}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700;">
        ${chat.name?.[0]?.toUpperCase() || "?"}
      </div>
      <div style="flex:1; min-width:0;">
        <h4 style="margin-bottom:2px;">${chat.name}</h4>
        <p style="margin:0; font-size: var(--fs-sm);">${chat.memberCount || 1} member${(chat.memberCount || 1) === 1 ? "" : "s"}</p>
      </div>
      <span class="badge badge--muted">${chat.privacy}</span>
    </a>
  `;
}

async function refreshChatList() {
  const listEl = document.getElementById("chat-list");
  if (!listEl) return;
  let chats = [];
  try {
    chats = await listMyChats(uid);
  } catch (err) {
    console.error("Couldn't load chats:", err);
    listEl.innerHTML = `<div class="empty-state card"><h3>Couldn't load your chats</h3><p>Please try again.</p></div>`;
    return;
  }
  if (chats.length === 0) {
    listEl.innerHTML = `<div class="empty-state card"><h3>No chats yet</h3><p>Create a chat, or join one with an invite code.</p></div>`;
    return;
  }
  listEl.innerHTML = chats.map(chatRow).join("");
}

function modalShell(title, bodyHtml, idPrefix) {
  return `
    <div class="modal-overlay" id="${idPrefix}-modal-overlay">
      <div class="modal-panel card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-4);">
          <h3 style="margin:0;">${title}</h3>
          <button class="btn btn--icon btn--secondary" id="${idPrefix}-modal-close">✕</button>
        </div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function openCreateChatModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell("Create a chat", `
    <div class="field"><label for="c-name">Chat name</label><input id="c-name" required /></div>
    <div class="field"><label for="c-desc">Description</label><textarea id="c-desc" rows="2"></textarea></div>
    <div class="field"><label for="c-privacy">Privacy</label>
      <select id="c-privacy"><option value="private">Private</option><option value="public">Public</option></select>
    </div>
    <div class="field"><label for="c-max">Maximum members</label><input id="c-max" type="number" value="100" min="2" /></div>
    <button class="btn btn--primary btn--full" id="c-submit">Create</button>
  `, "chat-create"));

  document.getElementById("chat-create-modal-close").addEventListener("click", () => {
    document.getElementById("chat-create-modal-overlay")?.remove();
  });

  document.getElementById("c-submit").addEventListener("click", async () => {
    const name = document.getElementById("c-name").value.trim();
    if (!name) return;
    const btn = document.getElementById("c-submit");
    btn.disabled = true;
    btn.textContent = "Creating...";
    try {
      const { inviteCode } = await createChat(uid, {
        name,
        description: document.getElementById("c-desc").value.trim(),
        privacy: document.getElementById("c-privacy").value,
        maxMembers: Number(document.getElementById("c-max").value) || 100,
      });
      document.getElementById("chat-create-modal-overlay")?.remove();
      await refreshChatList();
      alert(`Created! Invite code: ${inviteCode}`);
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Create";
      alert("Couldn't create the chat. Please try again.");
    }
  });
}

export function openJoinChatModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell("Join a chat", `
    <div class="field"><label for="jc-code">Invite code</label><input id="jc-code" style="text-transform:uppercase;" required /></div>
    <button class="btn btn--primary btn--full" id="jc-submit">Join</button>
  `, "chat-join"));

  document.getElementById("chat-join-modal-close").addEventListener("click", () => {
    document.getElementById("chat-join-modal-overlay")?.remove();
  });

  document.getElementById("jc-submit").addEventListener("click", async () => {
    const code = document.getElementById("jc-code").value.trim();
    if (!code) return;
    const btn = document.getElementById("jc-submit");
    btn.disabled = true;
    btn.textContent = "Joining...";
    try {
      await joinChatByCode(uid, code);
      document.getElementById("chat-join-modal-overlay")?.remove();
      await refreshChatList();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Join";
      alert(err.message || "Couldn't join. Check the code and try again.");
    }
  });
}

export function renderChatList(currentUid) {
  uid = currentUid;
  setTimeout(refreshChatList, 0);
  return `
    <div class="page-content">
      <div style="display:flex; gap: var(--space-3); margin-bottom: var(--space-4);">
        <button class="btn btn--primary" id="chat-open-create">+ Create Chat</button>
        <button class="btn btn--outline" id="chat-open-join">Join Chat</button>
      </div>
      <div id="chat-list">
        <div class="skeleton" style="height:64px; margin-bottom:8px;"></div>
        <div class="skeleton" style="height:64px;"></div>
      </div>
    </div>
  `;
}

export function wireChatListButtons() {
  document.getElementById("chat-open-create")?.addEventListener("click", openCreateChatModal);
  document.getElementById("chat-open-join")?.addEventListener("click", openJoinChatModal);
  document.querySelector('[data-fab="chat"]')?.addEventListener("click", openCreateChatModal);
}

/* --------------------------- Message thread view --------------------------- */

function messageBubble(msg, myUid) {
  const mine = msg.senderId === myUid;
  return `
    <div style="display:flex; justify-content:${mine ? "flex-end" : "flex-start"}; margin-bottom: var(--space-2);">
      <div style="max-width:70%; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
        background:${mine ? "var(--color-primary)" : "var(--color-surface-alt)"};
        color:${mine ? "#fff" : "var(--color-text)"};">
        ${msg.text}
      </div>
    </div>
  `;
}

export function renderChatThread(currentUid, chatId) {
  uid = currentUid;

  setTimeout(() => {
    if (messagesUnsub) messagesUnsub();
    if (typingUnsub) typingUnsub();

    messagesUnsub = watchMessages(chatId, (messages) => {
      const el = document.getElementById("chat-messages");
      if (!el) return;
      el.innerHTML = messages.map((m) => messageBubble(m, uid)).join("") || `<p style="text-align:center;">Say hello 👋</p>`;
      el.scrollTop = el.scrollHeight;
    });

    typingUnsub = watchTyping(chatId, uid, (others) => {
      const el = document.getElementById("chat-typing");
      if (el) el.textContent = others.length > 0 ? "Someone is typing…" : "";
    });

    const input = document.getElementById("chat-input");
    const form = document.getElementById("chat-input-form");
    let typingTimeout;

    input?.addEventListener("input", () => {
      setTyping(chatId, uid, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTyping(chatId, uid, false), 2000);
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      sendMessage(chatId, uid, text);
      input.value = "";
      setTyping(chatId, uid, false);
    });
  }, 0);

  return `
    <div class="page-content" style="display:flex; flex-direction:column; height: calc(100vh - var(--topbar-height) - var(--space-6) * 2);">
      <div id="chat-messages" style="flex:1; overflow-y:auto; padding: var(--space-3); background: var(--color-surface); border-radius: var(--radius-lg); border: 1px solid var(--color-border);"></div>
      <div id="chat-typing" style="font-size: var(--fs-xs); color: var(--color-text-muted); padding: 4px 0;"></div>
      <form id="chat-input-form" style="display:flex; gap: var(--space-2);">
        <input id="chat-input" placeholder="Type a message…" style="flex:1; padding: var(--space-3); border-radius: var(--radius-md); border: 1.5px solid var(--color-border);" autocomplete="off" />
        <button class="btn btn--primary" type="submit">Send</button>
      </form>
    </div>
  `;
}
