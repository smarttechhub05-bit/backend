const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadDirectory = path.join(__dirname, '..', '..', 'frontend', 'assets', 'uploads');

function ensureUploadDirectory() {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

function storageReference(file) {
  ensureUploadDirectory();
  const extension = path.extname(file.originalname).toLowerCase();
  const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
  const destination = path.join(uploadDirectory, key);
  fs.writeFileSync(destination, file.buffer);
  return { provider: 'local-development', key, url: `/assets/uploads/${key}` };
}

function removeStorageReference(storageKey) {
  if (!storageKey) return;
  const destination = path.join(uploadDirectory, path.basename(storageKey));
  if (fs.existsSync(destination)) fs.unlinkSync(destination);
}

module.exports = { storageReference, removeStorageReference };
