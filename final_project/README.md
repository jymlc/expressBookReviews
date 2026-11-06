# Express Book Review

Bookstore API based on IBM's Express Book Reviews starter. It uses the starter catalog, Express, JWT authentication, and Axios for the asynchronous client tasks. Users and reviews are held in memory for the duration of the process.

## Run

From `final_project`, run `npm install` and `npm start`. The default port is 5000. The public routes are `GET /`, `GET /isbn/:isbn`, `GET /author/:author`, `GET /title/:title`, `GET /review/:isbn`, and `POST /register`. Use `POST /customer/login` to get a bearer token for `PUT` and `DELETE /customer/auth/review/:isbn`.

## Verify and capture evidence

Stop any server already listening on port 5000, then run `node evidence.js`. The script runs the API, checks its responses and the Axios clients, and writes the commands and outputs to `evidence/`. It captures fork metadata too when `GITHUB_REPOSITORY` is set. The GitHub Actions workflow packages these files as the `bookstore-curl-evidence` artifact.
