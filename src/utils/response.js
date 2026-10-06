export const responseJson = (res, code, message, data, objName = 'data') =>
  res.status(code).json({
    [objName]: data,
    message,
  });
