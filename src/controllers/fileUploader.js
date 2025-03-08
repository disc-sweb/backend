const supabase = require('../config/supabase');
const tus = require('tus-js-client');
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

  //const token = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IjNrSmdKR3ZMaFBnTnMwTm4iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3JjemhzdXFyd3Bzb2dnaGxxYmd2LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJjZGJhMDVkNS0wYWM0LTRjMGEtOTQxMy01ZTE4Zjg1MjM5MWYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQxNDU5NDg2LCJpYXQiOjE3NDE0NTU4ODYsImVtYWlsIjoiaGFyZXNoZ3dAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdvb2dsZSJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSjlVWjRhbHQtYjBDREJ4WEQtdUo4a1VzbFdkZXZvemotdDNOeWhPRnNpZEhwcVExRWc9czk2LWMiLCJlbWFpbCI6ImhhcmVzaGd3QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJIYXJlc2ggV2VkYW5heWFrZSIsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsIm5hbWUiOiJIYXJlc2ggV2VkYW5heWFrZSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0o5VVo0YWx0LWIwQ0RCeFhELXVKOGtVc2xXZGV2b3pqLXQzTnloT0ZzaWRIcHFRMUVnPXM5Ni1jIiwicHJvdmlkZXJfaWQiOiIxMDY3Njg1NTEwODYyNDIwOTEzNzYiLCJzdWIiOiIxMDY3Njg1NTEwODYyNDIwOTEzNzYifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc0MTQ1NTg4Nn1dLCJzZXNzaW9uX2lkIjoiOTYwMmNmYjItNTE3ZS00OGNlLTg0YWQtOTM4NDcyZWM0ZjU4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.VOqJDm1nkHHHTuCr4fmnViPC_eb3ovIzutbq0CreUvY';
  const token = process.env.SUPBASE_SERVICE_ROLE;
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

module.exports = { uploadStandard, uploadResumable };
