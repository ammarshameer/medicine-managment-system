-- Update admin password to admin123
USE mms_db;

UPDATE Users SET PasswordHash = '$2a$10$0Qgc0x1b5NOoFvZ0Co7.NeNRjh2I.MtkQn2n.8yvT8I/jWbWkqedK' WHERE Email = 'admin@mms.com';
