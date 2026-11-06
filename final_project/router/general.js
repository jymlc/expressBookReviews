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
    if (Object.keys(matches).length === 0) {
      return res.status(404).json({ message: `No books found for that ${field}.` })
    }
    return res.json(matches)
  }
}
general.get('/author/:author', searchBy('author'))
general.get('/title/:title', searchBy('title'))

// Axios clients for the four asynchronous retrieval tasks.
const client = axios.create({ baseURL: process.env.BOOK_API_URL || 'http://127.0.0.1:5000' })
async function fetchBooks(path, operation) {
  try {
    const { data } = await client.get(path)
    return data
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error
    const reason = error.response?.status === 404
      ? error.response.data.message
      : error.response ? `HTTP ${error.response.status}` : 'Bookstore API is unavailable.'
    throw new Error(`${operation}: ${reason}`, { cause: error })
  }
}

const getAllBooks = () => fetchBooks('/', 'List all books')
const getBooksByISBN = (isbn) => fetchBooks(`/isbn/${encodeURIComponent(isbn)}`, 'Find book by ISBN')
const getBooksByAuthor = (author) => fetchBooks(`/author/${encodeURIComponent(author)}`, 'Find books by author')
const getBooksByTitle = (title) => fetchBooks(`/title/${encodeURIComponent(title)}`, 'Find books by title')

module.exports = { general, getAllBooks, getBooksByISBN, getBooksByAuthor, getBooksByTitle }
