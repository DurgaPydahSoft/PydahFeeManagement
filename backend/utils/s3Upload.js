const { S3Client, PutObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const uploadToS3 = async (file) => {
  const fileKey = `concessions/${Date.now()}_${file.originalname}`;
  
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read' // Uncomment if you want the object to be public-read
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    // Construct the public URL manually for v3
    // Note: This assumes standard AWS S3 URL format
    const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    return url;
  } catch (error) {
    throw error;
  }
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
