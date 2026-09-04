const { S3Client, PutObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

/**
 * Upload a multer memory file to S3.
 * @param {object} file - multer file ({ buffer, originalname, mimetype })
 * @param {string} [folder='concessions'] - key prefix folder
 * @returns {Promise<string>} public object URL
 */
const uploadToS3 = async (file, folder = 'concessions') => {
  const bucketName = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'team-pydah';
  const safeName = String(file.originalname || 'file')
    .replace(/[^\w.\-()+ ]+/g, '_')
    .replace(/\s+/g, '_');
  const prefix = String(folder || 'uploads').replace(/^\/+|\/+$/g, '');
  const fileKey = `${prefix}/${Date.now()}_${safeName}`;

  const params = {
    Bucket: bucketName,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3Client.send(new PutObjectCommand(params));
  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;
};

const verifyS3Connection = async () => {
  try {
    await s3Client.send(new ListBucketsCommand({}));
    console.log('S3 Connected: Credentials Valid (SDK v3)');
  } catch (error) {
    console.error('S3 Connection Failed:', error.message);
  }
};

module.exports = { uploadToS3, verifyS3Connection };
