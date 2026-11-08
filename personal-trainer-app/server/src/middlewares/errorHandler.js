import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } });
};

// Formato único de error: { error: { code, message, details?, requestId } }
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Ocurrió un error inesperado. Intentá nuevamente.';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Revisá los datos ingresados.';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err?.name === 'ValidationError' && err.errors) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Revisá los datos ingresados.';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err?.name === 'CastError') {
    status = 400; code = 'INVALID_ID'; message = 'Identificador inválido.';
  } else if (err?.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = 'Ya existe un registro con esos datos.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'El cuerpo de la petición no es un JSON válido.';
  } else if (err?.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'La petición es demasiado grande.';
  }

  if (status >= 500) logger.error({ err, reqId: req.id }, 'Error no controlado');
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}), requestId: req.id } });
}
