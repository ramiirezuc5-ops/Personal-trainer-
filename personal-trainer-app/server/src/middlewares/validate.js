export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error); // lo traduce errorHandler
  req[source] = result.data;
  return next();
};
