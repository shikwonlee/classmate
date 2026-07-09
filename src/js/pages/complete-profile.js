import { completeProfile } from "../firebase/auth.js";

const STATUS_OPTIONS = ["Studying", "Working", "Busy", "Vacation", "Sleeping"];

function calcAge(birthday) {
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return "";
  const diff = Date.now() - dob.getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

export function renderCompleteProfile(root, user, onDone) {
  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card" style="max-width: 460px; text-align: left;">
        <div style="text-align:center;">
          <img class="auth-logo" src="${user.photoURL || "public/icons/icon-96.png"}" alt="" style="border-radius: 999px;" />
          <h2>Complete your profile</h2>
          <p>Just a few details before you jump in.</p>
        </div>

        <form id="profile-form">
          <div class="field">
            <label for="fullName">Full name</label>
            <input id="fullName" name="fullName" type="text" required value="${user.displayName || ""}" />
          </div>

          <div class="field">
            <label for="birthday">Birthday</label>
            <input id="birthday" name="birthday" type="date" required />
          </div>

          <div class="field">
            <label for="age">Age</label>
            <input id="age" name="age" type="number" min="10" max="100" required readonly />
          </div>

          <div class="field">
            <label for="status">Status</label>
            <select id="status" name="status" required>
              ${STATUS_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join("")}
            </select>
          </div>

          <button class="btn btn--primary btn--full" type="submit">Enter ClassMate+</button>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector("#profile-form");
  const birthdayInput = form.querySelector("#birthday");
  const ageInput = form.querySelector("#age");

  birthdayInput.addEventListener("change", () => {
    ageInput.value = calcAge(birthdayInput.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const savedFields = {
        fullName: data.fullName,
        birthday: data.birthday,
        age: Number(data.age),
        status: data.status,
      };
      await completeProfile(user.uid, savedFields);
      onDone({ ...savedFields, profileComplete: true, photoURL: user.photoURL });
    } catch (err) {
      console.error("Failed to save profile", err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Enter ClassMate+";
      alert("Couldn't save your profile. Please try again.");
    }
  });
}
