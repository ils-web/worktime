import app from './app';

const PORT = parseInt(process.env['PORT'] || '4000', 10);

app.listen(PORT, () => {
  console.log(`🚀 TimeTracker v2 API Server running at http://localhost:${PORT}`);
});
