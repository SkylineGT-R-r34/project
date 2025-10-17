import pool from '../db/db.js';

export const index = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.redirect('/auth/login');

    // Fetch only moods for this user
    const moodsResult = await pool.query(
      'SELECT * FROM mood_logs WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );

    res.render('moodTrackingUI', {
      title: 'Mood Tracking Page',
      user,
      moods: moodsResult.rows,
      currentPath: req.path,
      role: user.role  // pass role to EJS
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error loading mood tracking page');
  }
};
