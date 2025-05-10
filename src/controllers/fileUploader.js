const supabase = require('../config/supabase');
const tus = require('tus-js-client');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  secure: true,
});
const projectId = process.env.SUPABASE_PROJECT_ID;

async function uploadStandard(bucketName, filePath, fileBuffer, fileType) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      cacheControl: '3600', // Optional: sets cache control headers
      contentType: fileType,
      upsert: false, // Optional: if true, will overwrite existing file
    });

  return {
    data: data,
    error: error,
  };
}

async function uploadResumable(bucketName, filePath, fileBuffer, fileType) {
  console.log('Resumable function uploading...');
  const token = process.env.SUPBASE_SERVICE_ROLE;
  return new Promise((resolve, reject) => {
    var upload = new tus.Upload(fileBuffer, {
      endpoint: `https://${projectId}.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'true', // optionally set upsert to true to overwrite existing files
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true, // Important if you want to allow re-uploading the same file https://github.com/tus/tus-js-client/blob/main/docs/api.md#removefingerprintonsuccess
      metadata: {
        bucketName: bucketName,
        objectName: filePath,
        contentType: fileType,
        cacheControl: 3600,
      },
      chunkSize: 6 * 1024 * 1024, // NOTE: it must be set to 6MB (for now) do not change it
      onError: function (error) {
        console.log('Failed because: ' + error);
        reject(error);
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        var percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(bytesUploaded, bytesTotal, percentage + '%');
      },
      onSuccess: function () {
        console.log('Download %s from %s', upload.file.name, upload.url);
        resolve(upload.url);
      },
    });

    // Check if there are any previous uploads to continue.
    return upload.findPreviousUploads().then(function (previousUploads) {
      // Found previous uploads so we select the first one.
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      // Start the upload
      upload.start();
    });
  });
}

async function getPublicURL(bucket, filePath) {
  const urlInfo = await supabase.storage.from(bucket).getPublicUrl(filePath);

  const url_data = urlInfo.data;
  const url_error = urlInfo.error;
  if (url_error) {
    throw new Error('Error: Failed to create url for video upload');
  } else {
    console.log(url_data);
    console.log('Signed URL:', url_data.publicUrl);
  }

  return url_data.publicUrl;
}

function uploadLargePromise(filePath, opts) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(filePath, opts, (err, res) =>
      err ? reject(err) : resolve(res)
    );
  });
}

async function cloudinaryVideoUpload(filePath, trim = false) {
  const opts = {
    resource_type: 'video',
    chunk_size: 50 * 1024 * 1024,
    eager_async: true,
    eager: [
      {
        width: 640,
        height: 360,
        crop: 'pad',
        format: 'mp4',
        quality: 'auto',
        bit_rate: trim ? '400k' : '600k',
        video_codec: 'h264',
        audio_codec: 'aac',
        compression: {
          quality: 'auto',
          level: trim ? 'best' : 'better',
        },
      },
    ],
  };
  if (trim) {
    opts.transformation = [{ duration: 120 }];
  }

  const result = await uploadLargePromise(filePath, opts);
  const url = result.secure_url;
  return { url, publicId: result.public_id };
}

async function cloudinaryImageUpload(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: 'image',
    chunk_size: 100000000,
    eager: [
      {
        width: 640,
        height: 360,
        crop: 'pad',
        format: 'jpg',
      },
    ],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

module.exports = {
  uploadStandard,
  uploadResumable,
  getPublicURL,
  cloudinaryVideoUpload,
  cloudinaryImageUpload,
};
