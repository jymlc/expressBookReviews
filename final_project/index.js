const express = require('express')
const { authenticated } = require('./router/auth_users')
const { general } = require('./router/general')

const app = express()
app.use(express.json())
app.use('/customer', authenticated)
app.use('/', general)

if (require.main === module) {
  const port = process.env.PORT || 5000
  app.listen(port, () => console.log(`Bookstore API listening on port ${port}`))
}

module.exports = app
