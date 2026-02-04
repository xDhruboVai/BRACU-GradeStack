const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;


app.use(helmet());

const isDev = (process.env.NODE_ENV || 'development') !== 'production';
if (isDev) {
  app.use(cors({ origin: true }));
} else {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim());
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
    })
  );
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const routes = require('./routes');


app.use('/api', routes);


app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'GradeStack API is running' });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
