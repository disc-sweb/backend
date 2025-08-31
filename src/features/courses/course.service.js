const supabase = require('../../config/supabase');


const createCourse = async (req, res, next) => {
  const { title, price, description, video } = req.body;

  if (!title || price === undefined || !description || !video) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const { error } = await supabase
      .from('courses')
      .insert([{ title, price, description, video }]);

    if (error) throw error;

    return res.status(200).end();
  } catch (err) {
    next(err);
  }
};


// GET /courses/:id
const getCourseById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('title, price, description, video')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(400).json({ error: 'Course not found' });
    }

    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};


// PUT /courses/:id
const updateCourse = async (req, res, next) => {
  const { id } = req.params;
  const { title, price, description, video } = req.body;

  if (!title || price === undefined || !description || !video) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const { error } = await supabase
      .from('courses')
      .update({ title, price, description, video })
      .eq('id', id);

    if (error) throw error;

    res.status(200).end();
  } catch (err) {
    next(err);
  }
};


// DELETE /courses/:id
const deleteCourse = async (req, res, next) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('courses').delete().eq('id', id);

    if (error) throw error;

    res.status(200).end();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
};
