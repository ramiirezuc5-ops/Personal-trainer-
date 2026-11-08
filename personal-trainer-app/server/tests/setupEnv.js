// Variables mínimas para cargar la app en pruebas. No hay secretos reales.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/cafe-del-rio-test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
