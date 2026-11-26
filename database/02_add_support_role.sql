-- Adds the hidden SUPPORT role and its platform-level account. Safe to re-run.
-- SUPPORT has full cross-tenant admin access but is never listed to business
-- owners and cannot be assigned from the admin UI.
USE mms_db;

ALTER TABLE Users
  MODIFY COLUMN Role ENUM('SUPER_ADMIN', 'SUPPORT', 'BUSINESS_OWNER', 'CUSTOMER', 'STAFF')
  NOT NULL DEFAULT 'CUSTOMER';

INSERT INTO Users (Name, Email, Phone, PasswordHash, Role, IsActive)
SELECT 'Platform Support', 'support@mms.com', '+923001234599',
       '$2a$10$RZBbComDFnmGJBwQ/ea8kekW.440330COHZIp14W5lOuOL988/Fni',
       'SUPPORT', TRUE
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'support@mms.com');
