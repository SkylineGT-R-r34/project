[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/GoatNcQr)
[![Open in Codespaces](https://classroom.github.com/assets/launch-codespace-2972f46106e565e64193e422d61a12cf1da4916b45550586e14ef0a7c637dd04.svg)](https://classroom.github.com/open-in-codespaces?assignment_repo_id=20074515)

## Express Boilerplate

This repository is a boilerplate for an Express web application.

It uses ES Modules rather than CommonJS, and has a directory structure that separates our responsibilities and concerns.

## Team Members:
- Dong Quan Huynh 22055873 123Qnn
- Dang Duc Long Nguyen 22102197 Lucas1382
- Tan Phat Truong 22048639 SkylineGT-R-r34
- Lok Mun Tan 22105511 goGtus
---

## How to start the project
### 1. Install Node.js dependencies


```sh
npm install
```

---

### 2. Start the database container (Optional)
Run this to initialize database (for the first time or after modification)
This will start PostgreSQL and automatically initialize it with SQL scripts from `./db/init/`:

```sh
docker-compose -f .devcontainer/docker-compose.yml up -d db
```

- Host: `localhost`
- Port: `5432`
- Username: `dev`
- Password: `dev`
- Database: `campusWell`

---

### 3. Start the app container

```sh
docker-compose -f .devcontainer/docker-compose.yml up -d app
```

---

### 4. Attach to the app container and start the development server

- Attach to the app container via the Devcontainer extension (VS Code) or run this script:
```sh
docker exec -it $(docker ps -qf "name=app") bash
```

- To start the project, run:
```sh
npm run dev
```

Your Express app will be running at [http://localhost:3000](http://localhost:3000).

---

### Notes

- The database is initialized only the first time the container is created, or if you remove the `pgdata` volume.
- To reset the database, stop the containers, remove the volume, and start again:

  ```sh
  docker-compose -f .devcontainer/docker-compose.yml down -v
  docker-compose -f .devcontainer/docker-compose.yml up -d db
  ```

### Authentication environment variables

Create a `.env` file in the project root (or update your existing file) and provide the following values so that JWT authentication can work:

```
PGHOST=localhost
PGUSER=dev
PGPASSWORD=dev
PGDATABASE=campusWell
PGPORT=5432
JWT_SECRET=change-me
# Optional:
# JWT_EXPIRES_IN=1h
```

`JWT_SECRET` must be a sufficiently random string; update it in production to keep issued tokens secure.

### Authentication workflow

CampusWell now ships with fully functional sign-in and sign-up pages powered by JWTs.

- Visit [`/auth/login`](http://localhost:3000/auth/login) to sign in with an existing account.
- Visit [`/auth/signup`](http://localhost:3000/auth/signup) to create a new account.

Successful form submissions issue a JWT, store it in an HTTP-only cookie, and redirect you back to the dashboard. The navigation menu displays the current user and exposes a **Log out** button that clears the cookie.

For API or mobile clients you can still interact with the JSON endpoints directly:

- `POST /auth/signup` – Provide `email`, `password`, and `fullName` (optional `role`) in the JSON body to create an account and receive a JWT in the response.
- `POST /auth/login` – Provide `email` and `password` in the JSON body to verify credentials and receive a JWT in the response.
- `POST /auth/logout` – Clears the authentication cookie. When using bearer tokens, simply discard the token client-side.

Include the JWT in an `Authorization: Bearer <token>` header to access protected routes programmatically.
