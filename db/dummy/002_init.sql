-- Users
INSERT INTO users (email, password, full_name, role)
VALUES 
('student1@university.edu', 'password123', 'Alice Nguyen', 'student'),
('student2@university.edu', 'password123', 'Bob Tran', 'student');

-- Events
INSERT INTO events (title, description, event_date, event_time, location, type, capacity)
VALUES
('Orientation Week', 'Welcome event for new students', '2025-09-20', '10:00', 'Main Hall', 'Orientation', 100),
('Study Skills Workshop', 'Improve your study habits', '2025-09-22', '14:00', 'Library Room 101', 'Workshop', 30);

-- Bookings
INSERT INTO bookings (user_id, event_id, status)
VALUES
(1, 1, 'booked'),
(2, 2, 'booked');

-- Connections 
INSERT INTO connections (user1_id, user2_id, requester_id, status)
VALUES
(1, 2, 1, 'pending');

-- Notifications
INSERT INTO notifications (user_id, message, type)
VALUES
(1, 'Welcome to the university mood tracking system!', 'welcome'),
(2, 'Your booking for Study Skills Workshop is confirmed.', 'booking');

-- UserProgress
INSERT INTO user_progress (user_id, points, streak_days, badges)
VALUES
(1, 10, 2, 'Newbie'),
(2, 5, 1, 'Newbie');

-- Posts (student posts)
INSERT INTO posts (user_id, content)
VALUES
(1, 'Excited to start Orientation Week!'),
(2, 'Looking forward to the Study Skills Workshop.');

-- MoodLogs
INSERT INTO mood_logs (user_id, score, notes)
VALUES
(1, 7, 'Feeling motivated after Orientation Week'),
(2, 6, 'A bit stressed about upcoming exams');

