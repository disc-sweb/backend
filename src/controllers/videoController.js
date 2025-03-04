const supabase = require('../config/supabase');

const {uploadStandard} = require('./fileUploader');

const videoController = {
    async videoUpload(req, res){
      try{
        //Get form fields
        const {title, description} = req.body;
        const videoFile = req.file;
      
        //Check for empty fields
        if (!videoFile || !title || !description) {
            return res.status(400).json({ error: 'Error: Title, description, or file upload fields are empty' });
        }
      
        const fileBuffer = videoFile.buffer;
        const filePath = `Course_videos/${title}`;
        const {data, error} = await uploadStandard('Videos', filePath, fileBuffer, videoFile.mimetype);
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        console.log(data);
        const urlInfo = await supabase.storage.from('Videos')
        .getPublicUrl(data.path);
        
        const url_data = urlInfo.data;
        const url_error = urlInfo.error;
        if (url_error) {
          return res.status(400).json({ error: 'Error: Failed to create url for video upload' });
        } else {
          console.log(url_data);
          console.log('Signed URL:', url_data.publicUrl);
        }

        //Upload video to videos table
        const video_link = url_data.publicUrl;
        const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert([
          {
            title,
            description,
            video_link
          },
        ])
        .select()
        .single();

  if (error) {
    return res.status(500).json({ message: 'Error inserting data', error: error.message });
  }

      res.status(200).json({
        message: 'Video uploaded successfully'
      });
      }
      catch(error){
        console.log("An error occured:", error);
        res
        .status(500)
        .json({ error: 'Failed to upload video to server' });
      }
    },

    async getVideo(req, res){
        try{
          const videoId = req.params.videoId;
          
          const {data, error} = await supabase
          .from('videos')
          .select('title, description, video_link')
          .eq('id', videoId)
          .single();
          
          if (error) {
            return res.status(400).json({ message: 'Invalid video id', error: error.message });
          }
          console.log(data);
          res.status(200).json(data);
        }
        catch(error){
          console.log("An error occured:", error);
        res
        .status(500)
        .json({ error: 'Failed to get video'});
      }
    },

    async editVideo(req, res){
      const videoId = req.params.videoId;

       //Get form fields
       const {id, title, description} = req.body;
       const videoFile = req.file;
     
       //Check for empty fields
       if (!videoFile || !title || !description) {
           return res.status(400).json({ error: 'Error: Title, description, or file upload fields are empty' });
       }
     
       const fileBuffer = videoFile.buffer;
       const filePath = `Course_videos/${title}`;

       

      const { data, error } = await supabase
    .from('videos')
    .update({ title, description, video_link })
    .eq('id', videoId)
    .single();
    
  
    }
  };

  module.exports = videoController;