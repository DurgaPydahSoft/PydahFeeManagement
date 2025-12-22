@echo off
echo Creating project folder structure...

:: Create main folders
mkdir backend 2>nul
mkdir frontend 2>nul

:: Create backend subfolders
mkdir backend\controllers 2>nul
mkdir backend\models 2>nul
mkdir backend\routes 2>nul
mkdir backend\middleware 2>nul
mkdir backend\config 2>nul
mkdir backend\utils 2>nul
mkdir backend\public 2>nul

:: Create .env file in backend
echo Creating .env file...
echo # Database configuration > backend\.env
echo DB_HOST=localhost >> backend\.env
echo DB_USER=root >> backend\.env
echo DB_PASS=password >> backend\.env
echo DB_NAME=mydatabase >> backend\.env
echo. >> backend\.env
echo # Server configuration >> backend\.env
echo PORT=3000 >> backend\.env
echo NODE_ENV=development >> backend\.env
echo. >> backend\.env
echo # JWT Secret >> backend\.env
echo JWT_SECRET=your_jwt_secret_key_here >> backend\.env

:: Create a basic package.json for backend (optional)
echo Creating basic package.json...
echo { > backend\package.json
echo   "name": "backend", >> backend\package.json
echo   "version": "1.0.0", >> backend\package.json
echo   "description": "Backend API", >> backend\package.json
echo   "main": "server.js", >> backend\package.json
echo   "scripts": { >> backend\package.json
echo     "start": "node server.js", >> backend\package.json
echo     "dev": "nodemon server.js" >> backend\package.json
echo   } >> backend\package.json
echo } >> backend\package.json

:: Create a basic server.js file (optional)
echo Creating basic server.js...
echo const express = require('express'); > backend\server.js
echo const app = express(); >> backend\server.js
echo require('dotenv').config(); >> backend\server.js
echo. >> backend\server.js
echo // Middleware >> backend\server.js
echo app.use(express.json()); >> backend\server.js
echo app.use(express.urlencoded({ extended: true })); >> backend\server.js
echo. >> backend\server.js
echo // Routes >> backend\server.js
echo app.get('/', (req, res) => { >> backend\server.js
echo   res.json({ message: 'API is running' }); >> backend\server.js
echo }); >> backend\server.js
echo. >> backend\server.js
echo const PORT = process.env.PORT \|\| 3000; >> backend\server.js
echo app.listen(PORT, () => { >> backend\server.js
echo   console.log(`Server running on port \${PORT}`); >> backend\server.js
echo }); >> backend\server.js

:: Create frontend basic structure
mkdir frontend\src 2>nul
mkdir frontend\public 2>nul

echo.
echo Folder structure created successfully!
echo.
echo Backend contains:
echo   - controllers/
echo   - models/
echo   - routes/
echo   - .env file (with template configuration)
echo   - package.json (basic template)
echo   - server.js (basic template)
echo.
echo Frontend contains:
echo   - src/
echo   - public/
echo.
echo Note: The .env file contains sensitive configuration.
echo Remember to update the values (especially JWT_SECRET and database credentials)!
pause