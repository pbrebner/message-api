const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

// Function to generate random file name
const generateFileName = (bytes = 32) =>
    crypto.randomBytes(bytes).toString("hex");

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey,
    },
    region: bucketRegion,
});

// Put file to S3
async function uploadFileS3(file, fileBuffer) {
    // Configure the upload details to send to S3
    const fileName = generateFileName();
    const uploadParams = {
        Bucket: bucketName,
        Body: fileBuffer,
        Key: fileName,
        ContentType: file.mimetype,
    };

    // Send the upload to S3
    await s3Client.send(new PutObjectCommand(uploadParams));

    return fileName;
}

//Generate signed URL
async function getSignedURL(object) {
    const getObjectParams = {
        Bucket: bucketName,
        Key: object.fileName,
    };

    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return url;
}

// Delete file from S3
async function deleteFileS3(object) {
    const deleteParams = {
        Bucket: bucketName,
        Key: object.fileName,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
}

export { uploadFileS3, getSignedURL, deleteFileS3 };
