import { watchMyTasks, createTask, updateTaskStatus, deleteTask } from "../firebase/firestore.js";

let uid = null;
let unsubscribe = null;
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const STATUSES = ["Not Started", "In Progress", "Completed", "Submitted"];

function statusBadgeClass(status) {
  if (status === "Completed" || status === "Submitted") return "badge--success";
  if (status === "In Progress") return "badge--accent";
  return "badge--muted";
}

function taskRow(task) {
  return `
    <div class="card" style="margin-bottom: var(--space-3);" data-task-id="${task.id}">
      <div style="display:flex; justify-content:space-between; gap: var(--space-3); align-items:flex-start;">
        <div style="min-width:0;">
          <h4 style="margin-bottom:4px;">${task.title}</h4>
          <p style="margin:0 0 8px;">${task.description || ""}</p>
          <div style="display:flex; gap: var(--space-2); flex-wrap:wrap;">
            ${task.subject ? `<span class="badge badge--muted">${task.subject}</span>` : ""}
            <span class="badge badge--muted">${task.priority}</span>
            ${task.dueDate ? `<span class="badge badge--muted">Due ${task.dueDate}${task.dueTime ? " " + task.dueTime : ""}</span>` : ""}
          </div>
        </div>
        <button class="btn btn--icon btn--secondary" data-delete-task="${task.id}" aria-label="Delete task">✕</button>
      </div>
      <div style="margin-top: var(--space-3);">
        <select class="task-status-select" data-status-task="${task.id}">
          ${STATUSES.map((s) => `<option value="${s}" ${s === task.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <span class="badge ${statusBadgeClass(task.status)}" style="margin-left:8px;">${task.status}</span>
      </div>
    </div>
  `;
}

function renderList(tasks) {
  const listEl = document.getElementById("tasks-list");
  if (!listEl) return;
  if (tasks.length === 0) {
    listEl.innerHTML = `<div class="empty-state card"><h3>No tasks yet</h3><p>Add homework, projects, or quiz reminders to keep track of what's due.</p></div>`;
    return;
  }
  listEl.innerHTML = tasks.map(taskRow).join("");

  listEl.querySelectorAll("[data-delete-task]").forEach((btn) => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.deleteTask));
  });
  listEl.querySelectorAll("[data-status-task]").forEach((sel) => {
    sel.addEventListener("change", () => updateTaskStatus(sel.dataset.statusTask, sel.value));
  });
}

function modalShell(bodyHtml) {
  return `
    <div class="modal-overlay" id="task-modal-overlay">
      <div class="modal-panel card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-4);">
          <h3 style="margin:0;">Add a task</h3>
          <button class="btn btn--icon btn--secondary" id="task-modal-close">✕</button>
        </div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function openTaskModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell(`
    <div class="field"><label for="t-title">Title</label><input id="t-title" required /></div>
    <div class="field"><label for="t-desc">Description</label><textarea id="t-desc" rows="2"></textarea></div>
    <div class="field"><label for="t-subject">Subject</label><input id="t-subject" /></div>
    <div class="field"><label for="t-priority">Priority</label>
      <select id="t-priority">${PRIORITIES.map((p) => `<option>${p}</option>`).join("")}</select>
    </div>
    <div style="display:flex; gap: var(--space-3);">
      <div class="field" style="flex:1;"><label for="t-due-date">Due date</label><input id="t-due-date" type="date" /></div>
      <div class="field" style="flex:1;"><label for="t-due-time">Due time</label><input id="t-due-time" type="time" /></div>
    </div>
    <button class="btn btn--primary btn--full" id="t-submit">Add task</button>
  `));

  document.getElementById("task-modal-close").addEventListener("click", () => {
    document.getElementById("task-modal-overlay")?.remove();
  });

  document.getElementById("t-submit").addEventListener("click", async () => {
    const title = document.getElementById("t-title").value.trim();
    if (!title) return;
    const btn = document.getElementById("t-submit");
    btn.disabled = true;
    btn.textContent = "Adding...";
    try {
      await createTask(uid, {
        title,
        description: document.getElementById("t-desc").value.trim(),
        subject: document.getElementById("t-subject").value.trim(),
        priority: document.getElementById("t-priority").value,
        dueDate: document.getElementById("t-due-date").value,
        dueTime: document.getElementById("t-due-time").value,
      });
      document.getElementById("task-modal-overlay")?.remove();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Add task";
      alert("Couldn't add the task. Please try again.");
    }
  });
}

export function renderTasks(currentUid) {
  uid = currentUid;
  if (unsubscribe) unsubscribe();
  setTimeout(() => {
    unsubscribe = watchMyTasks(uid, renderList);
  }, 0);

  return `
    <div class="page-content">
      <div style="margin-bottom: var(--space-4);">
        <button class="btn btn--primary" id="tasks-open-add">+ Add task</button>
      </div>
      <div id="tasks-list">
        <div class="skeleton" style="height:80px; margin-bottom:8px;"></div>
        <div class="skeleton" style="height:80px;"></div>
      </div>
    </div>
  `;
}

export function wireTasksButtons() {
  document.getElementById("tasks-open-add")?.addEventListener("click", openTaskModal);
  document.querySelector('[data-fab="tasks"]')?.addEventListener("click", openTaskModal);
}
