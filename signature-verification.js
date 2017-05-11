const crypto = require('crypto')

// CONST SECRETKEY = BUFFER.FROM(, 'UTF8')

module.exports = {
  getHash: (data) => {
    return crypto.createHmac('sha256', process.env.WEBHOOKS_SECRET_KEY)
      .update(data)
      .digest('hex');
  }
}