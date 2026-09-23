const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const { connectDatabase, getDatabaseState } = require('./config/database');
const databaseRoutes = require('./routes/database');
const serviceRoutes = require('./routes/services');
const packageRoutes = require('./routes/packages');
const bookingRoutes = require('./routes/bookings');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const staffRoutes = require('./routes/staff');
const projectRoutes = require('./routes/projects');
const clientRoutes = require('./routes/clients');
const galleryRoutes = require('./routes/galleries');
const galleryAccessRoutes = require('./routes/galleryAccess');
const galleryWorkflowRoutes = require('./routes/galleryWorkflow');
const revisionRoutes = require('./routes/revisions');
const websiteRoutes = require('./routes/website');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const app = express();
const port = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, '..', 'frontend');
const adminPath = path.join(frontendPath, 'admin');
const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (frontendOrigin) app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontendPath));
app.use('/api', databaseRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/galleries', galleryRoutes);
app.use('/api/gallery-access', galleryAccessRoutes);
app.use('/api/gallery-workflow', galleryWorkflowRoutes);
app.use('/api/revisions', revisionRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/api/health', (req, res) => {
  const database = getDatabaseState();
  const healthy = database.status === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'Rap Eugene Studio API',
    message: 'Backend foundation is running.',
    database
  });
});

app.get('/api/public-contact', (req, res) => {
  res.json({
    success: true,
    data: {
      phone: process.env.STUDIO_PHONE || '',
      whatsapp: process.env.STUDIO_WHATSAPP || process.env.STUDIO_PHONE || ''
    }
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminPath, 'login.html'));
});

app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(adminPath, 'login.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
  res.sendFile(path.join(adminPath, 'dashboard.html'));
});

app.use('/admin', express.static(adminPath));

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (error.message?.startsWith('Unsupported media type') || error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: error.message || 'Uploaded media is too large.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: Object.values(error.errors)[0].message });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'One or more IDs or values are invalid.' });
  }
  console.error(error.message);
  return res.status(error.status || 500).json({ success: false, message: 'The server could not complete the request.' });
});

async function startServer() {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Rap Eugene Studio server running at http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exitCode = 1;
});
