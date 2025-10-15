
/**
 * Renders the index page with the specified title.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>} - A promise that resolves when the rendering is complete.
 */
export async function index(req, res, next) {
    res.render('home', { title: 'CampusWell' });
}

