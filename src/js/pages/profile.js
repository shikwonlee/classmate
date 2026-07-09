import { updateProfileFields } from "../firebase/firestore.js";

const STATUS_OPTIONS = ["Studying", "Working", "Busy", "Vacation", "Sleeping"];

export function renderProfile(currentUid, profile) {
  setTimeout(() => {
    document.getElementById("profile-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        await updateProfileFields(currentUid, {
          fullName: document.getElementById("p-name").value.trim(),
          status: document.getElementById("p-status").value,
          bio: document.getElementById("p-bio").value.trim(),
        });
        btn.textContent = "Saved ✓";
        setTimeout(() => { btn.disabled = false; btn.textContent = "Save changes"; }, 1500);
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = "Save changes";
        alert("Couldn't save your profile. Please try again.");
      }
    });
  }, 0);

  return `
    <div class="page-content">
      <div class="card" style="max-width: 480px;">
        <div style="text-align:center; margin-bottom: var(--space-4);">
          <img class="avatar avatar--lg" src="${profile?.photoURL || "public/icons/icon-96.png"}" alt="" style="margin:0 auto;" />
        </div>
        <form id="profile-form">
          <div class="field"><label for="p-name">Full name</label><input id="p-name" value="${profile?.fullName || ""}" required /></div>
          <div class="field"><label for="p-status">Status</label>
            <select id="p-status">
              ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === profile?.status ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label for="p-bio">Bio</label><textarea id="p-bio" rows="3">${profile?.bio || ""}</textarea></div>
          <div class="field"><label>Email</label><input value="${profile?.email || ""}" disabled /></div>
          <button class="btn btn--primary btn--full" type="submit">Save changes</button>
        </form>
      </div>
    </div>
  `;
}
