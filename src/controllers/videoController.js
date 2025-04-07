const supabase = require('../config/supabase');

const { uploadResumable } = require('./fileUploader');

async function uploadCourseVideo(title, description, videoFile) {
  console.log(title, description);
  console.log(videoFile);
  //Check for empty fields
  if (!videoFile || !title || !description) {
    throw new Error(
      'Error: Title, description, or file upload fields are empty'
    );
  }

  const fileBuffer = videoFile.buffer;
  const filePath = `Course_videos/${title}`;
  await uploadResumable('Videos', filePath, fileBuffer, videoFile.mimetype);

  const urlInfo = await supabase.storage.from('Videos').getPublicUrl(filePath);

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

const videoController = {
  async videoUpload(req, res) {
    try {
      console.log(req.file);
      console.log(req.body);
      const { title, description } = req.body;
      const videoFile = req.file;
      //Upload video to videos table
      const video_link = await uploadCourseVideo(title, description, videoFile);
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert([
          {
            title,
            description,
            video_link,
          },
        ])
        .select()
        .single();

      console.log(videoData);
      if (videoError) {
        return res
          .status(500)
          .json({ message: 'Error inserting data', error: videoError.message });
      }

      res.status(200).json({
        message: 'Video uploaded successfully',
      });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to upload video to server' });
    }
  },

  async getVideo(req, res) {
    try {
      const videoId = req.params.videoId;

      const { data, error } = await supabase
        .from('videos')
        .select('title, description, video_link')
        .eq('id', videoId)
        .single();

      if (error) {
        return res
          .status(400)
          .json({ message: 'Invalid video id', error: error.message });
      }
      console.log(data);
      res.status(200).json(data);
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to get video' });
    }
  },

  async editVideo(req, res) {
    try {
      const videoId = req.params.videoId;

      const { title, description } = req.body;
      console.log(req.body);
      const videoFile = req.file;
      console.log(title, description, videoFile);
      //Upload video to videos table
      const video_link = await uploadCourseVideo(title, description, videoFile);

      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .update({
          title: title,
          description: description,
          video_link: video_link,
          upload_date: new Date().toISOString(),
        })
        .eq('id', videoId)
        .select()
        .single();

      console.log(videoData);
      if (videoError) {
        return res
          .status(500)
          .json({ message: 'Error updating data', error: videoError.message });
      }

      res.status(200).json({
        message: 'Video updated successfully',
      });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to edit video' });
    }
  },
  async deleteVideo(req, res) {
    try {
      const videoId = req.params.videoId;
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) {
        return res
          .status(400)
          .json({ message: 'Invalid video id', error: error.message });
      }
      res.status(200).json({ message: 'Successfully Deleted Video' });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  },
};

module.exports = videoController;
