require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const salesRoutes = require('./routes/salesRoutes');
const { requestLogger, errorLogger } = require('./middleware/logger');
const { setupFileWatcher } = require('./services/fileWatcher');
const connectDB = require('./config/db');

const app = express();

// --- Middleware ---
app.use(express.json());
app.use(requestLogger);

connectDB();

app.use('/auth', authRoutes);
app.use('/sales', salesRoutes);

// --- File Processing ---
const uploadsFolder = path.join(__dirname, 'uploads');
if(!fs.existsSync(uploadsFolder)){
    fs.mkdirSync(uploadsFolder, {recursive: true});
}
setupFileWatcher(uploadsFolder);

// --- Error Logging Middleware ---
app.use(errorLogger);

const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
