const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: s3GetSignedUrl } = require('@aws-sdk/s3-request-presigner');

const localUploadDirectory = path.join(__dirname, '..', '..', 'frontend', 'assets', 'uploads');
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_SIGNED_URL_TTL = Number(process.env.R2_SIGNED_URL_TTL || 3600);

function ensureLocalDirectory() {
  fs.mkdirSync(localUploadDirectory, { recursive: true });
}

function isR2Configured() {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_ENDPOINT);
}

function getR2Client() {
  if (!isR2Configured()) return null;
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    },
    forcePathStyle: false
  });
}

function normalizeObjectKey(fileName, prefix = 'gallery') {
  const safeName = String(fileName || 'upload').trim().replace(/\\/g, '/');
  const cleaned = safeName.replace(/[^a-zA-Z0-9._/-]+/g, '-');
  const extension = path.extname(cleaned) || '';
  const basename = path.basename(cleaned, extension).slice(0, 80) || 'upload';
  const date = new Date().toISOString().slice(0, 10);
  const unique = crypto.randomBytes(8).toString('hex');
  return `${prefix}/${date}/${basename}-${unique}${extension}`.replace(/\/+/g, '/');
}

async function uploadFile(file, options = {}) {
  const { objectKey, prefix = 'gallery', contentType, metadata = {} } = options;

  if (!file || !file.buffer) {
    throw new Error('A file buffer is required for upload.');
  }

  if (process.env.NODE_ENV === 'production' && !isR2Configured()) {
    throw new Error('Cloudflare R2 storage is not configured for production.');
  }

  if (isR2Configured()) {
    const client = getR2Client();
    if (!client) throw new Error('Cloudflare R2 credentials are incomplete.');
    const key = objectKey || normalizeObjectKey(file.originalname || file.name || 'upload', prefix);
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: contentType || file.mimetype || 'application/octet-stream',
      Metadata: {
        originalName: String(file.originalname || file.name || 'upload'),
        ...metadata
      }
    });
    await client.send(command);
    return {
      provider: 'cloudflare-r2',
      key,
      objectKey: key,
      url: `${R2_ENDPOINT.replace(/\/$/, '')}/${R2_BUCKET_NAME}/${key}`,
      signedUrl: await s3GetSignedUrl(client, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }), { expiresIn: R2_SIGNED_URL_TTL })
    };
  }

  ensureLocalDirectory();
  const key = objectKey || normalizeObjectKey(file.originalname || file.name || 'upload', prefix);
  const destination = path.join(localUploadDirectory, path.basename(key));
  fs.writeFileSync(destination, file.buffer);
  return {
    provider: 'local-development',
    key,
    objectKey: key,
    url: `/assets/uploads/${path.basename(key)}`
  };
}

async function deleteFile(objectKey) {
  if (!objectKey) return false;

  if (isR2Configured()) {
    const client = getR2Client();
    if (!client) return false;
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: objectKey }));
    return true;
  }

  const fallbackPath = path.join(localUploadDirectory, path.basename(objectKey));
  if (fs.existsSync(fallbackPath)) {
    fs.unlinkSync(fallbackPath);
    return true;
  }

  return false;
}

async function fileExists(objectKey) {
  if (!objectKey) return false;

  if (isR2Configured()) {
    const client = getR2Client();
    if (!client) return false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: objectKey }));
      return true;
    } catch (error) {
      return false;
    }
  }

  return fs.existsSync(path.join(localUploadDirectory, path.basename(objectKey)));
}

async function getSignedUrl(objectKey, expiresIn = R2_SIGNED_URL_TTL) {
  if (!objectKey) throw new Error('An object key is required to generate a signed URL.');

  if (!isR2Configured()) {
    return `/assets/uploads/${path.basename(objectKey)}`;
  }

  const client = getR2Client();
  if (!client) throw new Error('Cloudflare R2 credentials are not configured.');

  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: objectKey });
  return await s3GetSignedUrl(client, command, { expiresIn });
}

function storageReference(file, options = {}) {
  if (process.env.NODE_ENV === 'production' && !isR2Configured()) throw new Error('Cloudflare R2 storage is not configured for production.');
  const key = options.objectKey || normalizeObjectKey(file.originalname || file.name || 'upload', options.prefix || 'gallery');
  return { provider: isR2Configured() ? 'cloudflare-r2' : 'local-development', key, objectKey: key, url: isR2Configured() ? `${R2_ENDPOINT.replace(/\/$/, '')}/${R2_BUCKET_NAME}/${key}` : `/assets/uploads/${path.basename(key)}` };
}

function removeStorageReference(storageKey) {
  if (!storageKey) return false;
  if (isR2Configured()) return deleteFile(storageKey);
  const destination = path.join(localUploadDirectory, path.basename(storageKey));
  if (fs.existsSync(destination)) { fs.unlinkSync(destination); return true; }
  return false;
}

function getR2Diagnostics() {
  return {
    configured: isR2Configured(),
    bucket: R2_BUCKET_NAME || null,
    endpoint: R2_ENDPOINT || null,
    accountId: R2_ACCOUNT_ID || null,
    signedUrlTtl: R2_SIGNED_URL_TTL,
    usingLocalFallback: !isR2Configured()
  };
}

module.exports = {
  uploadFile,
  deleteFile,
  fileExists,
  getSignedUrl,
  storageReference,
  removeStorageReference,
  getR2Diagnostics,
  isR2Configured,
  getR2Client,
  normalizeObjectKey
};
