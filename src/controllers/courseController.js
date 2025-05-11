const cloudinary = require('cloudinary').v2;
const supabase = require('../config/supabase');
require('uuid');

const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
const stripe = require('stripe')(STRIPE_API_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL;

cloudinary.config({
  secure: true,
});

const {
  cloudinaryVideoUpload,
  cloudinaryImageUpload,
} = require('./fileUploader');
//Secret to use stripe webhook
const endpointSecret =
  'whsec_8ec46d91b5b89b89a97c76c57159951383b93bbd3630dc89326b1a927262be90';

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
          .status(403)
          .json({ error: 'User does not have course upload permissions' });
      }

      //Get fields
      const { title, description, formLink, courseType } = req.body;
      let price = parseFloat(req.body.price);
      console.log('Files: ', req.files);
      const video = req.files.videoFile?.[0]; // { filename, path, mimetype, ... }
      const image = req.files.imageFile?.[0];

      if (!video || !image || !title || !price || !description) {
        return res.status(400).json({
          error:
            'Error: Title, price, description, form_link, course_type, or file upload fields are empty',
        });
      }
      console.log('Uploading video...');
      const { url: video_link } = await cloudinaryVideoUpload(video.path);
      console.log('Uploading restricted video...');
      const { url: restricted_video_link } = await cloudinaryVideoUpload(
        video.path,
        true
      );
      console.log('Uploading image...');
      const { url: image_link } = await cloudinaryImageUpload(image.path);

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
            cover_image_link: image_link,
            form_link: formLink,
            course_type: courseType,
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
            'id, title, price, description, restricted_video_link, upload_date, cover_image_link, form_link, course_type'
          )
          .eq('id', courseId)
          .single();

        if (dataError) {
          return res.status(500).json({ dataError: 'Failed to fetch course' });
        }
        return res.status(200).json(course_data);
      } else {
        const { data: course_data, error: dataError } = await supabase
          .from('courses')
          .select(
            'id, title, price, description, video_link, upload_date, cover_image_link, form_link, course_type'
          )
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
          .status(403)
          .json({ error: 'User does not have course upload permissions' });
      }

      //Get fields
      const { title, description, formLink, courseType } = req.body;
      let price = parseFloat(req.body.price);
      const video = req.files.videoFile?.[0]; // { filename, path, mimetype, ... }
      const image = req.files.imageFile?.[0];
      const updateObj = {
        title: title,
        price: price,
        description: description,
        form_link: formLink,
        course_type: courseType,
      };
      const courseId = req.params.courseId;
      if (video) {
        const { url: video_link } = await cloudinaryVideoUpload(video.path);
        const { url: restricted_video_link } = await cloudinaryVideoUpload(
          video.path,
          true
        );
        updateObj.video_link = video_link;
        updateObj.restricted_video_link = restricted_video_link;
      }
      if (image) {
        const { url: image_link } = await cloudinaryImageUpload(image.path);
        updateObj.cover_image_link = image_link;
      }

      //Update database
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .update({
          ...updateObj,
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
        course: courseData,
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
          .status(403)
          .json({ error: 'User does not have course upload permissions' });
      }
      const courseId = req.params.courseId;

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
          'id, title, price, description, upload_date, cover_image_link, form_link, course_type'
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
