# Medicine Management System - Setup Guide

This guide will help you set up the complete Medicine Management System on your local machine.

## System Requirements

- **Node.js**: v14.0.0 or higher
- **npm**: v6.0.0 or higher
- **MySQL**: v5.7 or higher (or MariaDB v10.2+)
- **React Native CLI** (for mobile development)
- **Android Studio** (for Android development)
- **Xcode** (for iOS development - macOS only)

## Step-by-Step Setup

### 1. Database Setup

#### Install MySQL/MariaDB
```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# On macOS (using Homebrew)
brew install mysql

# On Windows
# Download and install from https://dev.mysql.com/downloads/mysql/
```

#### Create Database
```sql
-- Log in to MySQL
mysql -u root -p

-- Create database
CREATE DATABASE mms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (optional, for security)
CREATE USER 'mms_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON mms_db.* TO 'mms_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

#### Import Schema and Data
```bash
# Navigate to project directory
cd /path/to/mms/database

# Import schema
mysql -u root -p mms_db < schema.sql

# Import sample data (optional but recommended)
mysql -u root -p mms_db < seed_data.sql
```

### 2. Backend API Setup

```bash
# Navigate to backend directory
cd mms/backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit environment file
nano .env
```

#### Environment Configuration
Edit `.env` file with your settings:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root                    # or your MySQL user
DB_PASSWORD=your_mysql_password  # your MySQL password
DB_NAME=mms_db
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

#### Start Backend Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

### 3. Admin Web Panel Setup

```bash
# Navigate to admin web directory
cd mms/admin-web

# Install dependencies
npm install

# Start development server
npm start
```

The admin panel will be available at `http://localhost:3001`

### 4. Mobile App Setup

#### Install React Native CLI
```bash
npm install -g @react-native-community/cli
```

#### Setup for Android Development

1. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - Install Android SDK (API level 30 or higher)
   - Set up Android Virtual Device (AVD)

2. **Configure Environment Variables**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

3. **Start Mobile App**
   ```bash
   cd mms/mobile-app
   
   # Install dependencies
   npm install
   
   # Run on Android
   npm run android
   ```

#### Setup for iOS Development (macOS only)

1. **Install Xcode**
   - Install from App Store
   - Install Xcode Command Line Tools: `xcode-select --install`

2. **Install CocoaPods**
   ```bash
   sudo gem install cocoapods
   ```

3. **Install iOS Dependencies**
   ```bash
   cd mms/mobile-app/ios
   pod install
   cd ..
   ```

4. **Start Mobile App**
   ```bash
   npm run ios
   ```

## Verification

### Test Backend API
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"OK","message":"Medicine Management System API is running","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Test Admin Web Panel
1. Open browser to `http://localhost:3001`
2. Login with admin credentials:
   - Email: admin@mms.com
   - Password: admin123

### Test Mobile App
1. Open the app in emulator/device
2. Register a new account or login with demo credentials:
   - Email: john.doe@email.com
   - Password: password

## Common Issues and Solutions

### Backend Issues

#### Database Connection Error
```bash
# Check if MySQL is running
sudo systemctl status mysql

# Start MySQL if not running
sudo systemctl start mysql

# Check database exists
mysql -u root -p -e "SHOW DATABASES;"
```

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env file
PORT=3001
```

### Frontend Issues

#### Tailwind CSS Not Working
```bash
# Reinstall dependencies
cd mms/admin-web
rm -rf node_modules package-lock.json
npm install

# Check PostCSS configuration
cat postcss.config.js
```

#### React Native Build Issues

**Android:**
```bash
# Clean build
cd mms/mobile-app/android
./gradlew clean

# Reset Metro cache
npx react-native start --reset-cache

# Rebuild
npm run android
```

**iOS:**
```bash
# Clean build
cd mms/mobile-app/ios
xcodebuild clean

# Reset cache
npx react-native start --reset-cache

# Rebuild
npm run ios
```

## Development Workflow

### Backend Development
```bash
# Install nodemon for auto-restart
npm install --save-dev nodemon

# Start with nodemon
npx nodemon server.js
```

### Frontend Development
```bash
# Admin web development
cd mms/admin-web
npm start

# Mobile app development
cd mms/mobile-app
npx react-native start
```

## Production Deployment

### Backend Production Setup
1. **Environment Variables**
   ```env
   NODE_ENV=production
   JWT_SECRET=your_production_secret
   DB_PASSWORD=your_production_db_password
   ```

2. **Install Production Dependencies**
   ```bash
   npm ci --production
   ```

3. **Use Process Manager (PM2)**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "mms-api"
   ```

### Frontend Production Build
```bash
# Admin web build
cd mms/admin-web
npm run build

# Mobile app build
cd mms/mobile-app
# Android
npx react-native build-android --mode=release
# iOS
npx react-native build-ios --mode=Release
```

## Security Considerations

1. **Change Default Passwords**: Update all default credentials
2. **Environment Variables**: Never commit `.env` files to version control
3. **Database Security**: Use strong passwords and limit database user permissions
4. **HTTPS**: Use SSL certificates in production
5. **Firewall**: Configure firewall to restrict access to necessary ports

## Support

If you encounter any issues during setup:

1. Check the console logs for error messages
2. Verify all prerequisites are installed
3. Ensure all services are running (MySQL, Node.js)
4. Check network connectivity and port availability
5. Review environment variable configurations

For additional support, refer to the main README.md file or create an issue in the project repository.
