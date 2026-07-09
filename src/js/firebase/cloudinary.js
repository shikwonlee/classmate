// ClassMate+ — Cloudinary upload helper
// Per spec: Cloudinary stores the actual file bytes; Firestore/RTDB only
// ever store the resulting URL. Uses an UNSIGNED upload preset so this can
// run entirely client-side with no backend/API secret exposed.
//
// SETUP REQUIRED: create an unsigned upload preset in your Cloudinary
// dashboard (Settings → Upload → Upload presets → Add upload preset →
// Signing Mode: Unsigned) and put its name below.

const CLOUD_NAME = "rabnzafj"; // ⚠️ double-check this against your Cloudinary Dashboard's "Cloud name" field
const UPLOAD_PRESET = "classmate+"; // matches the unsigned preset shown in your dashboard

export async function uploadToCloudinary(file, onProgress) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          resourceType: data.resource_type,
          format: data.format,
          bytes: data.bytes,
        });
      } else {
        reject(new Error("Upload failed. Check that the Cloudinary upload preset is configured."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.send(formData);
  });
}
