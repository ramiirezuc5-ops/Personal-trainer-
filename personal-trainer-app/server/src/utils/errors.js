export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (message, code = 'BAD_REQUEST', details) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Necesitás iniciar sesión.', code = 'UNAUTHORIZED') => new AppError(401, code, message);
export const forbidden = (message = 'No tenés permisos para esta acción.', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (message = 'Recurso no encontrado.', code = 'NOT_FOUND') => new AppError(404, code, message);
export const conflict = (message, code = 'CONFLICT') => new AppError(409, code, message);
