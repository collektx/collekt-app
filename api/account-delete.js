const accountDeleteHandler = require('../netlify/functions/account-delete');

module.exports = async (req, res) => {
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: req.query,
    body: JSON.stringify(req.body)
  };

  const response = await accountDeleteHandler.handler(event);
  
  if (response.headers) {
    Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
  }

  res.status(response.statusCode).send(response.body);
};
