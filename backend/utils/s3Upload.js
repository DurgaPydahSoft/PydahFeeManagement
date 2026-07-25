const { S3Client, PutObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const uploadToS3 = async (file) => {
  const bucketName = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'team-pydah';
  const fileKey = `concessions/${Date.now()}_${file.originalname}`;
  
  const params = {
    Bucket: bucketName,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read' // Uncomment if you want the object to be public-read
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    // Construct the public URL manually for v3
    const region = process.env.AWS_REGION || 'ap-south-1';
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;
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
