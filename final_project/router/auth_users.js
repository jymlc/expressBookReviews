const express = require('express')
const jwt = require('jsonwebtoken')
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto')
const books = require('./booksdb')

const authenticated = express.Router()
const users = new Map()
const secret = process.env.JWT_SECRET || randomBytes(32)
const isValid = (username) => typeof username === 'string' && /^[\w.-]{1,64}$/.test(username)
const validPassword = (password) => typeof password === 'string' && password.length > 0 && password.length <= 256

function register(req, res) {
  const { username, password } = req.body || {}
  if (!isValid(username) || !validPassword(password)) {
    return res.status(400).json({ message: 'A valid username and password are required.' })
  }
  if (users.has(username)) {
    return res.status(409).json({ message: 'Username already registered.' })
  }
  const salt = randomBytes(16)
  users.set(username, { salt, hash: scryptSync(password, salt, 64) })
  return res.status(201).json({ message: 'User successfully registered.' })
}

authenticated.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = users.get(username)
  if (!user || !validPassword(password) || !timingSafeEqual(user.hash, scryptSync(password, user.salt, 64))) {
    return res.status(401).json({ message: 'Invalid username or password.' })
  }
  const token = jwt.sign({ sub: username }, secret, { algorithm: 'HS256', expiresIn: '1h' })
  return res.json({ message: 'Login successful.', token })
})

authenticated.use('/auth', (req, res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.get('authorization') || '')
  try {
    req.username = jwt.verify(match?.[1], secret, { algorithms: ['HS256'] }).sub
  } catch {
    return res.status(401).json({ message: 'A valid bearer token is required.' })
  }
  return next()
})

authenticated.param('isbn', (req, res, next, isbn) => {
  if (!Object.hasOwn(books, isbn)) {
    return res.status(404).json({ message: 'Book not found.' })
  }
  req.book = books[isbn]
  return next()
})

authenticated.put('/auth/review/:isbn', (req, res) => {
  const review = req.body?.review ?? req.query.review
  if (typeof review !== 'string' || !review.trim() || review.length > 2000) {
    return res.status(400).json({ message: 'A review of 1–2000 characters is required.' })
  }
  const reviews = req.book.reviews
  const existed = Object.hasOwn(reviews, req.username)
  Object.defineProperty(reviews, req.username, {
    value: review.trim(), enumerable: true, writable: true, configurable: true,
  })
  return res.json({ message: existed ? 'Review updated.' : 'Review added.', reviews })
})

authenticated.delete('/auth/review/:isbn', (req, res) => {
  const reviews = req.book.reviews
  if (!Object.hasOwn(reviews, req.username)) {
    return res.status(404).json({ message: 'You do not have a review for this book.' })
  }
  delete reviews[req.username]
  return res.json({ message: 'Review deleted.', reviews })
})

module.exports = { authenticated, register }
