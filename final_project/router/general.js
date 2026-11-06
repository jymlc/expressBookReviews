const express = require('express')
const axios = require('axios')
const books = require('./booksdb')
const { register } = require('./auth_users')

const general = express.Router()
general.post('/register', register)
general.get('/', (req, res) => res.json(books))

general.param('isbn', (req, res, next, isbn) => {
  if (!Object.hasOwn(books, isbn)) {
    return res.status(404).json({ message: 'Book not found.' })
  }
  req.book = books[isbn]
  return next()
})

general.get('/isbn/:isbn', (req, res) => res.json(req.book))
general.get('/review/:isbn', (req, res) => res.json(req.book.reviews))

function searchBy(field) {
  return (req, res) => {
    const query = req.params[field].trim().toLowerCase()
    const matches = Object.fromEntries(Object.entries(books).filter(([, book]) =>
      book[field].toLowerCase() === query))
    return res.json(matches)
  }
}
general.get('/author/:author', searchBy('author'))
general.get('/title/:title', searchBy('title'))

// Axios clients for the four asynchronous retrieval tasks.
const client = axios.create({ baseURL: process.env.BOOK_API_URL || 'http://127.0.0.1:5000' })
const getAllBooks = () => client.get('/').then(({ data }) => data)
const getBooksByISBN = (isbn) => client.get(`/isbn/${encodeURIComponent(isbn)}`).then(({ data }) => data)
async function getBooksByAuthor(author) {
  const { data } = await client.get(`/author/${encodeURIComponent(author)}`)
  return data
}
async function getBooksByTitle(title) {
  const { data } = await client.get(`/title/${encodeURIComponent(title)}`)
  return data
}

module.exports = { general, getAllBooks, getBooksByISBN, getBooksByAuthor, getBooksByTitle }
