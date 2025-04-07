const supabase = require('../config/supabase');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { uploadResumable, getPublicURL } = require('./fileUploader');

async function uploadCourseVideo(title, price, description, videoFile) {
  //Check for empty fields
  if (!videoFile || !title || !price || !description) {
    throw new Error(
      'Error: Title, price, description, or file upload fields are empty'
    );
  }

  const bucket = 'Videos';
  const filePath = `Course_videos/${title}`;
  await uploadResumable(bucket, filePath, videoFile, videoFile.mimetype);

  const publicUrl = await getPublicURL(bucket, filePath);
  return publicUrl;
}

async function trimVideo(video, title) {
  const inputPath = video.path;
  const startTime = '00:00:00';
  const duration = 30;
  const trimmedFilename = `trimmed-${uuidv4()}.mp4`;
  const trimmedPath = path.join('uploads', trimmedFilename);

  //Start trimming video using ffmpeg
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(trimmedPath)
      .on('end', async () => {
        try {
          //Upload trimmed video to bucket
          const fileContent = fs.readFileSync(trimmedPath);
          const bucket = 'videos-restricted';
          const filePath = `Course_videos/${title}`;
          await uploadResumable(bucket, filePath, fileContent, video.mimetype);

          const publicUrl = await getPublicURL(bucket, filePath);

          //Clean up by unlinking files after upload
          fs.unlinkSync(inputPath);
          fs.unlinkSync(trimmedPath);

          console.log('Trimmed video upload succeeded');
          resolve(publicUrl);
        } catch (err) {
          console.error('Error:', err);
          fs.unlinkSync(inputPath);
          fs.unlinkSync(trimmedPath);
          reject(new Error('Server error during upload.'));
        }
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        fs.unlinkSync(inputPath);
        reject(new Error('Failed to trim video.'));
      })
      .run();
  });
}

async function getUserInfo(userInfo) {
  const { email } = userInfo;
  console.log(email);

  //Get user ID from email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username, email, admin_access, firstname, lastname')
    .eq('email', email)
    .single();

  if (userError) {
    throw new Error(userError);
  }
  if (!user) {
    return null;
  }
  return user;
}

async function checkAdmin(req) {
  const user = await getUserInfo(req.user);
  if (user == null) {
    throw new Error('User not found');
  }
  return user.admin_access;
}

const courseController = {
  async courseUpload(req, res) {
    try {
      //Validate access permissions
      const admin = await checkAdmin(req);
      if (!admin) {
        return res
          .status(500)
          .json({ error: 'User does not have course upload permissions' });
      }

      //Get fields
      const { title, description } = req.body;
      let price = parseFloat(req.body.price);
      const video = req.file;
      const videoFile = fs.readFileSync(video.path);
      //Upload video to videos table
      const video_link = await uploadCourseVideo(
        title,
        price,
        description,
        videoFile
      );
      const restricted_video_link = await trimVideo(video, title);
      //Update course database
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .insert([
          {
            title: title,
            price: price,
            description: description,
            video_link: video_link,
            restricted_video_link: restricted_video_link,
          },
        ])
        .select()
        .single();

      console.log(courseData);
      if (courseError) {
        return res.status(500).json({
          message: 'Error inserting data',
          error: courseError.message,
        });
      }

      res.status(200).json({
        message: 'Course uploaded successfully',
      });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to upload course to server' });
    }
  },

  async getCourse(req, res) {
    try {
      const { courseId } = req.params;

      const user = getUserInfo(req.user);
      if (user == null) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = user.id;

      //Get courses
      const { data: courses, error: courseError } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (courseError) {
        return res.status(500).json({ error: courseError });
      }
      console.log(courses);
      if (courses.length === 0) {
        const { data: course_data, error: dataError } = await supabase
          .from('courses')
          .select('id, title, price, description, restricted_video_link')
          .eq('id', courseId)
          .single();

        if (dataError) {
          return res.status(500).json({ dataError: 'Failed to fetch course' });
        }
        return res.status(200).json(course_data);
      } else {
        const { data: course_data, error: dataError } = await supabase
          .from('courses')
          .select('id, title, price, description, video_link')
          .eq('id', courseId)
          .single();

        if (dataError) {
          return res.status(500).json({ error: dataError });
        }
        return res.status(200).json(course_data);
      }
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to get course' });
    }
  },

  async editCourse(req, res) {
    try {
      //Validate access permissions
      const admin = await checkAdmin(req);
      if (!admin) {
        return res
          .status(500)
          .json({ error: 'User does not have course upload permissions' });
      }
      //Get fields
      const courseId = req.params.courseId;
      const { title, description } = req.body;
      let price = parseFloat(req.body.price);
      const videoFile = req.file;
      //Upload video to videos table
      const video_link = await uploadCourseVideo(
        title,
        price,
        description,
        videoFile
      );

      //Update database
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .update({
          title: title,
          price: price,
          description: description,
          video_link: video_link,
          upload_date: new Date().toISOString(),
        })
        .eq('id', courseId)
        .select()
        .single();

      if (courseError) {
        return res
          .status(500)
          .json({ message: 'Error updating data', error: courseError.message });
      }

      res.status(200).json({
        message: 'Course updated successfully',
      });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to edit course' });
    }
  },
  async deleteCourse(req, res) {
    try {
      //Validate access permissions
      const admin = await checkAdmin(req);
      if (!admin) {
        return res
          .status(500)
          .json({ error: 'User does not have course upload permissions' });
      }
      const courseId = req.params.courseId;
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        return res
          .status(400)
          .json({ message: 'Invalid course id', error: error.message });
      }
      res.status(200).json({ message: 'Successfully Deleted Course' });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to delete course' });
    }
  },

  async purchaseCourse(req, res) {
    try {
      const { userId, courseId } = req.body;

      //Check for valid user and course id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (!userData) {
        return res.status(400).json({
          message: 'Invalid user id',
          error: userError.message,
        });
      }
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .maybeSingle();
      if (!courseData) {
        return res.status(400).json({
          message: 'Invalid course id',
          error: courseError.message,
        });
      }
      //Link user to course
      const { error } = await supabase
        .from('user_courses')
        .insert({ user_id: userId, course_id: courseId });

      if (error) {
        return res.status(400).json({
          message: 'Error occured while purchasing course',
          error: error.message,
        });
      }
      res.status(200).json({ message: 'Successfully purchased course' });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to purchase course' });
    }
  },
  async getUserCourses(req, res) {
    try {
      const { userId } = req.body;
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (!userData) {
        return res.status(400).json({
          message: 'Invalid user id',
          error: userError.message,
        });
      }
      const { data, error } = await supabase
        .from('user_courses')
        .select('courses (*)')
        .eq('user_id', userId);
      if (error) {
        return res.status(400).json({
          message: 'Error occured while getting user courses',
          error: error.message,
        });
      }
      res.status(200).json(data);
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to get user courses' });
    }
  },
  async getAllCourses(req, res) {
    try {
      const { data, error } = await supabase.from('courses').select('*');
      if (error) {
        return res.status(400).json({
          message: 'Error occured while getting courses',
          error: error.message,
        });
      }
      res.status(200).json(data);
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to get all courses' });
    }
  },
};

module.exports = courseController;
