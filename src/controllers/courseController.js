const cloudinary = require('cloudinary').v2;
const supabase = require('../config/supabase');

const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');


const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
const stripe = require('stripe')(STRIPE_API_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL;


cloudinary.config({
  secure: true,
});

const { cloudflareUpload, cloudflareDelete } = require('./fileUploader');

//Secret to use stripe webhook
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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


async function trimVideo(videoBuffer, mimeType) {
  const startTime = '00:00:00';
  const duration = 15; // seconds
  const inputFormat = mimeType.split('/')[1];
  const outputFormat = 'mp4';

  return new Promise((resolve, reject) => {
    // Turn the Buffer into a one-chunk Readable
    const inputStream = Readable.from([videoBuffer]);

    // collect the output
    const chunks = [];
    const command = ffmpeg(inputStream)
      .inputFormat(inputFormat) // tell ffmpeg the incoming stream format
      .setStartTime(startTime) // where to start
      .setDuration(duration) // how long
      .outputOptions([
        '-movflags frag_keyframe+empty_moov', // allow streaming mp4
      ])
      .format(outputFormat) // output format
      .on('error', (err) => {
        console.error('FFmpeg failed:', err);
        reject(new Error('Video trimming failed.'));
      });

    // pipe stdout to our collector
    const ffStream = command.pipe();

    ffStream.on('data', (chunk) => chunks.push(chunk));
    ffStream.on('end', () => resolve(Buffer.concat(chunks)));
    ffStream.on('error', (err) => {
      console.error('Stream error:', err);
      reject(new Error('Error while streaming trimmed video.'));
    });
  });
}


async function deleteFiles(urls) {
  for (const url of urls) {
    if (url) {
      const fileName = url.split('/').pop();
      const result = await cloudflareDelete(fileName);
      if (result.error) {
        console.error(`Failed to delete file ${fileName}:`, result.error);
      }
    }
  }
}

const courseController = {
  async courseUpload(req, res) {
    const startTime = Date.now();
    const timings = {};

    try {
      // Validate access permissions
      const admin = await checkAdmin(req);
      if (!admin) {
        return res
          .status(403)
          .json({ error: 'User does not have course upload permissions' });
      }

      // Get fields
      const { title, description, formLink, courseType, language } = req.body;
      let price = parseFloat(req.body.price);
      console.log('Files: ', req.files);
      const video = req.files.videoFile?.[0];
      const image = req.files.imageFile?.[0];

      // Validate required fields
      if (
        !courseType ||
        !image ||
        !title ||
        !price ||
        !description ||
        !language ||
        (courseType === 'Online' && !video)
      ) {
        return res.status(400).json({
          error: 'Error: Required field is empty',
        });
      }

      // Upload files to R2
      let video_link = null;
      let restricted_video_link = null;
      if (video) {
        const videoStartTime = Date.now();
        const videoBuffer = video.buffer;
        console.log('Uploading video...');
        let videoFileName = `video-${title}-${Date.now()}`.replace(/\s+/g, '-');
        const videoResult = await cloudflareUpload(
          videoFileName,
          video.mimetype,
          videoBuffer
        );
        if (videoResult.error) throw new Error(videoResult.error);
        video_link = videoResult.data.url;
        timings.mainVideo = Date.now() - videoStartTime;
        console.log(`Main video upload took ${timings.mainVideo}ms`);

        const restrictedStartTime = Date.now();
        console.log('Uploading restricted video...');
        videoFileName = `restricted-${title}-${Date.now()}`.replace(
          /\s+/g,
          '-'
        );

        const trimmedVideoBuffer = await trimVideo(videoBuffer, video.mimetype);
        const restrictedResult = await cloudflareUpload(
          videoFileName,
          video.mimetype,
          trimmedVideoBuffer
        );
        if (restrictedResult.error) throw new Error(restrictedResult.error);
        restricted_video_link = restrictedResult.data.url;

        timings.restrictedVideo = Date.now() - restrictedStartTime;
        console.log(
          `Restricted video upload took ${timings.restrictedVideo}ms`
        );
      }

      const imageStartTime = Date.now();
      console.log('Uploading image...');
      const imageBuffer = image.buffer;
      let imageFileName = `image-${title}-${Date.now()}`.replace(/\s+/g, '-');
      const imageResult = await cloudflareUpload(
        imageFileName,
        image.mimetype,
        imageBuffer
      );
      if (imageResult.error) throw new Error(imageResult.error);
      const image_link = imageResult.data.url;
      timings.image = Date.now() - imageStartTime;
      console.log(`Image upload took ${timings.image}ms`);

      const dbStartTime = Date.now();
      // Update course database
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .insert([
          {
            title,
            price,
            description,
            video_link,
            restricted_video_link,
            cover_image_link: image_link,
            form_link: formLink,
            course_type: courseType,
            language,
          },
        ])
        .select()
        .single();

      console.log('Course data: ', courseData);

      if (courseError) {
        return res.status(500).json({
          message: 'Error inserting data',
          error: courseError.message,
        });
      }
      timings.database = Date.now() - dbStartTime;
      console.log(`Database update took ${timings.database}ms`);

      const totalTime = Date.now() - startTime;
      console.log('\nUpload Timing Summary:');
      console.log('------------------------');
      if (video) {
        console.log(`Main Video Upload: ${timings.mainVideo}ms`);
        console.log(`Restricted Video Upload: ${timings.restrictedVideo}ms`);
      }
      console.log(`Image Upload: ${timings.image}ms`);
      console.log(`Database Update: ${timings.database}ms`);
      console.log(`Total Time: ${totalTime}ms`);

      res.status(200).json({
        message: 'Course uploaded successfully',
      });
    } catch (error) {
      console.log('An error occurred:', error);
      res.status(500).json({ error: 'Failed to upload course to server' });
    }
  },

  async getCourse(req, res) {
    try {
      const { courseId } = req.params;

      const user = await getUserInfo(req.user);
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

      console.log('user: ', user);

      if (courseError) {
        return res.status(500).json({ error: courseError });
      }
      console.log('Courses: ', courses);
      if (courses.length === 0) {
        const { data: course_data, error: dataError } = await supabase
          .from('courses')
          .select(
            'id, title, price, description, restricted_video_link, upload_date, cover_image_link, form_link, course_type, language'
          )
          .eq('id', courseId)
          .single();

        if (dataError) {
          return res.status(500).json({ dataError: 'Failed to fetch course' });
        }
        course_data.owner = false;
        return res.status(200).json(course_data);
      } else {
        const { data: course_data, error: dataError } = await supabase
          .from('courses')
          .select(
            'id, title, price, description, video_link, upload_date, cover_image_link, form_link, course_type, language'
          )
          .eq('id', courseId)
          .single();

        if (dataError) {
          return res.status(500).json({ error: dataError });
        }
        course_data.owner = true;
        return res.status(200).json(course_data);
      }
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to get course' });
    }
  },

  async editCourse(req, res) {
    try {
      // Validate access permissions
      const admin = await checkAdmin(req);
      if (!admin) {
        return res
          .status(403)
          .json({ error: 'User does not have course upload permissions' });
      }

      const courseId = req.params.courseId;

      // Get current course data
      const { data: currentCourse, error: fetchError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (fetchError) {
        throw new Error('Failed to fetch current course data');
      }

      // Get fields
      const { title, description, formLink, courseType, language } = req.body;
      let price = parseFloat(req.body.price);
      const video = req.files.videoFile?.[0];
      const image = req.files.imageFile?.[0];

      // Initialize update object
      const updateObj = {
        title,
        price,
        description,
        form_link: formLink,
        course_type: courseType,
        language,
      };

      // Handle video upload if provided
      if (video) {
        const videoBuffer = video.buffer;
        console.log('Updating video...');
        let videoFileName = null;

        let restrictedFileName = null;


        if (!currentCourse.video_link) {
          // New Online course conversion
          videoFileName = `video-${title}-${Date.now()}`.replace(/\s+/g, '-');

        } else {
          // Existing Online course update
          videoFileName = currentCourse.video_link.split('/').pop();
        }

        // Update existing files
        const videoResult = await cloudflareUpload(
          videoFileName,
          video.mimetype,
          videoBuffer
        );
        if (videoResult.error) throw new Error(videoResult.error);
        updateObj.video_link = videoResult.data.url;


        updateObj.restricted_video_link = await cloudinaryVideoUpload(
          updateObj.video_link,
          true
        );
      }

      // Handle image upload if provided
      if (image) {
        console.log('Updating image...');
        const imageBuffer = image.buffer;
        const imageFileName = currentCourse.cover_image_link.split('/').pop();

        const imageResult = await cloudflareUpload(
          imageFileName,
          image.mimetype,
          imageBuffer
        );
        if (imageResult.error) throw new Error(imageResult.error);
        updateObj.cover_image_link = imageResult.data.url;
      }

      // Update database
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .update(updateObj)
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
        course: courseData,
      });
    } catch (error) {
      console.log('An error occurred:', error);
      res.status(500).json({ error: 'Failed to edit course' });
    }
  },
  async deleteCourse(req, res) {
    try {
      // Validate access permissions
      const admin = await checkAdmin(req);
      if (!admin) {
        return res
          .status(403)
          .json({ error: 'User does not have course upload permissions' });
      }

      console.log('Deleting course...');

      const courseId = req.params.courseId;

      // Get course data to find file URLs
      const { data: course, error: fetchError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (fetchError) {
        return res.status(404).json({
          message: 'Course not found',
          error: fetchError.message,
        });
      }

      // Delete files from R2
      await deleteFiles([
        course.video_link,
        course.restricted_video_link,
        course.cover_image_link,
      ]);

      // Delete course enrollments
      const { error: user_courses_error } = await supabase
        .from('user_courses')
        .delete()
        .eq('course_id', courseId);

      if (user_courses_error) {
        return res.status(500).json({
          message: 'Could not delete enrollments',
          error: user_courses_error.message,
        });
      }

      // Delete course record
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        return res
          .status(400)
          .json({ message: 'Invalid course id', error: error.message });
      }
      console.log('Course deleted successfully!');
      res
        .status(200)
        .json({ message: 'Successfully Deleted Course and Associated Files' });
    } catch (error) {
      console.log('An error occurred:', error);
      res.status(500).json({ error: 'Failed to delete course' });
    }
  },

  async purchaseCourse(req, res) {
    try {
      const user = await getUserInfo(req.user);
      if (user == null) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = user.id;
      const courseId = parseInt(req.params.courseId, 10);

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
        .select('*')
        .eq('id', courseId)
        .maybeSingle();
      if (!courseData) {
        return res.status(400).json({
          message: 'Invalid course id',
          error: courseError.message,
        });
      }
      console.log('purchasing course...');

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            // Use the Stripe Price ID from the course record.
            price_data: {
              currency: 'usd',
              product_data: {
                name: courseData.title,
                metadata: {
                  course_id: courseId,
                  course_type: courseData.course_type,
                },
              },
              unit_amount: courseData.price * 100,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${FRONTEND_URL}/courses/${courseId}/confirmation`,
        cancel_url: `${FRONTEND_URL}/`,
        // Attach userId and courseId as metadata so they can be retrieved in the webhook
        metadata: {
          userId: userId,
          courseId: courseId,
        },
      });
      res.status(200).json({ url: session.url });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to purchase course' });
    }
  },
  async stripeWebhook(req, res) {
    console.log('In stripe webhook');
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout session completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Retrieve the metadata we passed earlier
      const { userId, courseId } = session.metadata;

      // Link the user with the course in the database
      const { error } = await supabase
        .from('user_courses')
        .insert({ user_id: userId, course_id: courseId });

      if (error) {
        console.error('Error linking course purchase:', error.message);
        // Optionally, you might want to retry or log for further review.
      } else {
        console.log('Course purchase recorded successfully!');
      }
    }

    // Respond to acknowledge receipt of the event
    res.json({ received: true });
  },
  async getUserCourses(req, res) {
    try {
      const user = await getUserInfo(req.user);
      if (user == null) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = user.id;
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
      const user = await getUserInfo(req.user);
      if (user == null) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = user.id;
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
      const { data: userCourses, error } = await supabase
        .from('user_courses')
        .select('courses (*)')
        .eq('user_id', userId);
      if (error) {
        return res.status(400).json({
          message: 'Error occured while getting user courses',
          error: error.message,
        });
      }

      const ownedIds = userCourses.map((elem) => elem.courses.id);
      const userCoursesFiltered = userCourses.map((elem) => elem.courses);
      const { data: allCourses, error: allCoursesError } = await supabase
        .from('courses')
        .select(
          'id, title, price, description, upload_date, cover_image_link, form_link, course_type, language'
        );
      if (allCoursesError) {
        return res.status(400).json({
          message: 'Error occured while getting non user courses',
          error: allCoursesError.message,
        });
      }
      const nonUserCourses = allCourses.filter((c) => !ownedIds.includes(c.id));
      res.status(200).json({
        userCourses: userCoursesFiltered,
        nonUserCourses: nonUserCourses,
      });
    } catch (error) {
      console.log('An error occured:', error);
      res.status(500).json({ error: 'Failed to get all courses' });
    }
  },
};

module.exports = courseController;
