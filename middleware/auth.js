import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const token = req.cookies?.token; //  JWT comes from cookie

  if (!token) return res.redirect('/auth/login');

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = { id: payload.id, name: payload.name,email: payload.email, role: payload.role };
    next();
  });
}
