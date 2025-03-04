const supabase = require('../config/supabase');

async function uploadStandard(bucketName, filePath, fileBuffer, fileType){
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        cacheControl: '3600', // Optional: sets cache control headers
        contentType: fileType,
        upsert: false, // Optional: if true, will overwrite existing file
      });

      return {
        data: data,
        error: error
      }
}

async function uploadResumable() {
    console.log("Resumable function unimplemented");   
}

module.exports = {uploadStandard};