import { watchMyFiles, createFileRecord, deleteFileRecord } from "../firebase/firestore.js";
import { uploadToCloudinary } from "../firebase/cloudinary.js";

let uid = null;
let unsubscribe = null;

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

function fileRow(file) {
  return `
    <div class="card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--space-3);">
      <div style="min-width:0;">
        <a href="${file.url}" target="_blank" rel="noopener" style="font-weight:600;">${file.name}</a>
        <p style="margin:0; font-size: var(--fs-sm);">${file.format?.toUpperCase() || file.resourceType} · ${formatBytes(file.bytes)}</p>
      </div>
      <button class="btn btn--icon btn--secondary" data-delete-file="${file.id}" aria-label="Delete">✕</button>
    </div>
  `;
}

function renderList(files) {
  const listEl = document.getElementById("files-list");
  if (!listEl) return;
  if (files.length === 0) {
    listEl.innerHTML = `<div class="empty-state card"><h3>No files yet</h3><p>Drag and drop a file above, or click to browse.</p></div>`;
    return;
  }
  listEl.innerHTML = files.map(fileRow).join("");
  listEl.querySelectorAll("[data-delete-file]").forEach((btn) => {
    btn.addEventListener("click", () => deleteFileRecord(btn.dataset.deleteFile));
  });
}

async function handleFiles(fileList) {
  const progressEl = document.getElementById("files-upload-progress");
  for (const file of fileList) {
    progressEl.textContent = `Uploading ${file.name}… 0%`;
    progressEl.style.display = "block";
    try {
      const result = await uploadToCloudinary(file, (pct) => {
        progressEl.textContent = `Uploading ${file.name}… ${pct}%`;
      });
      await createFileRecord(uid, {
        name: file.name,
        url: result.url,
        resourceType: result.resourceType,
        format: result.format,
        bytes: result.bytes,
      });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }
  progressEl.style.display = "none";
}

export function renderFiles(currentUid) {
  uid = currentUid;
  if (unsubscribe) unsubscribe();
  setTimeout(() => {
    unsubscribe = watchMyFiles(uid, renderList);

    const dropzone = document.getElementById("files-dropzone");
    const input = document.getElementById("files-input");

    dropzone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => handleFiles(input.files));

    ["dragover", "dragleave", "drop"].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => e.preventDefault());
    });
    dropzone.addEventListener("dragover", () => dropzone.style.borderColor = "var(--color-primary)");
    dropzone.addEventListener("dragleave", () => dropzone.style.borderColor = "var(--color-border)");
    dropzone.addEventListener("drop", (e) => {
      dropzone.style.borderColor = "var(--color-border)";
      handleFiles(e.dataTransfer.files);
    });
  }, 0);

  return `
    <div class="page-content">
      <div id="files-dropzone" class="card" style="border: 2px dashed var(--color-border); text-align:center; cursor:pointer; margin-bottom: var(--space-4); padding: var(--space-6);">
        <p style="margin:0;">Drag & drop a file here, or click to browse</p>
        <input id="files-input" type="file" multiple style="display:none;" />
      </div>
      <div id="files-upload-progress" style="display:none; margin-bottom: var(--space-3); font-size: var(--fs-sm); color: var(--color-text-muted);"></div>
      <div id="files-list">
        <div class="skeleton" style="height:56px; margin-bottom:8px;"></div>
        <div class="skeleton" style="height:56px;"></div>
      </div>
    </div>
  `;
}
