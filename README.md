## GraphQL Chat — Full‑Stack (Client + Server)

Real‑time chat application built with React + Apollo Client on the client and Node.js + Apollo Server on the server. It uses GraphQL over HTTP for queries/mutations and WebSockets (graphql‑ws) for subscriptions to deliver live updates when new messages arrive.

### Overview
- **Client**: React 19, Vite, Apollo Client, Bulma CSS. Auth via JWT stored in `localStorage`. HTTP link for queries/mutations and WS link for subscriptions.
- **Server**: Express 4 + Apollo Server 4, GraphQL schema/resolvers, JWT auth, Knex + better-sqlite3 for persistence, `graphql-ws` + `ws` for WebSocket transport, `graphql-subscriptions` for in‑process PubSub.

### Why WebSockets 
Chat is inherently real‑time. WebSockets enable the server to push new messages instantly to connected clients, avoiding inefficient polling. Here we use GraphQL Subscriptions over WebSockets (`graphql-ws`) so the client automatically receives `messageAdded` events as they happen.

## Technology Stack

- **Client**
  - React 19, Vite
  - Apollo Client (`@apollo/client`)
  - GraphQL (`graphql`), GraphQL‑WS (`graphql-ws`)
  - Bulma CSS (`bulma`)
  - JWT decode (`jwt-decode`)

- **Server**
  - Node.js, Express 4
  - Apollo Server 4 (`@apollo/server`), `@graphql-tools/schema`
  - GraphQL (`graphql`), Subscriptions (`graphql-subscriptions`)
  - WebSockets: `graphql-ws` + `ws`
  - Auth: `express-jwt`, `jsonwebtoken`
  - DB: Knex (`knex`) + SQLite via `better-sqlite3`

## Application Structure

```
chat/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx
│   │   │   ├── LoginForm.jsx
│   │   │   ├── MessageInput.jsx
│   │   │   ├── MessageList.jsx
│   │   │   └── NavBar.jsx
│   │   ├── lib/
│   │   │   ├── auth.js
│   │   │   └── graphql/
│   │   │       ├── client.js
│   │   │       ├── hooks.js
│   │   │       └── queries.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── auth.js
│   ├── data/
│   │   └── db.sqlite3
│   ├── db/
│   │   ├── connection.js
│   │   ├── ids.js
│   │   ├── messages.js
│   │   └── users.js
│   ├── package-lock.json
│   ├── package.json
│   ├── resolvers.js
│   ├── schema.graphql
│   ├── scripts/
│   │   └── create-db.js
│   └── server.js
├── LICENSE.txt
└── README.md
```

## How the Application Works

### Authentication
1. Client presents a login form. On submit it POSTs to `POST /login` with `{ username, password }`.
2. Server validates against the `user` table and returns a signed JWT.
3. Client stores the token in `localStorage` and:
   - Adds `Authorization: Bearer <token>` to HTTP requests.
   - Sends `connectionParams: { accessToken: <token> }` when establishing the WebSocket connection.

Key server code:

```js
// server/auth.js (excerpt)
export const authMiddleware = expressjwt({ algorithms: ["HS256"], credentialsRequired: false, secret });
export async function handleLogin(req, res) {
  const { username, password } = req.body;
  const user = await getUser(username);
  if (!user || user.password !== password) return res.sendStatus(401);
  const token = jwt.sign({ sub: username }, secret);
  res.json({ token });
}
```

### Data Flow (Messages)
- Query existing messages: `Query.messages` (auth required)
- Add a message: `Mutation.addMessage(text)` (auth required)
- Receive live updates: `Subscription.messageAdded` pushed over WebSockets when a new message is created

GraphQL schema:

```graphql
type Query { messages: [Message!] }
type Mutation { addMessage(text: String!): Message }
type Subscription { messageAdded: Message }
type Message { id: ID!, user: String!, text: String! }
```

Resolvers (high level):

```js
// server/resolvers.js (excerpt)
const pubSub = new PubSub();
export const resolvers = {
  Query: { messages: (_r, _a, { user }) => { if (!user) throw unauthorizedError(); return getMessages(); } },
  Mutation: { addMessage: async (_r, { text }, { user }) => { if (!user) throw unauthorizedError(); const m = await createMessage(user, text); pubSub.publish("MESSAGE_ADDED", { messageAdded: m }); return m; } },
  Subscription: { messageAdded: { subscribe: (_r, _a, { user }) => { if (!user) throw unauthorizedError(); return pubSub.asyncIterableIterator("MESSAGE_ADDED"); } } },
};
```

WebSocket setup:

```js
// server/server.js (excerpt)
const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
useWsServer({ schema, context: getWsContext }, wsServer);
```

Client transport split (HTTP vs WS):

```js
// client/src/lib/graphql/client.js (excerpt)
const httpLink = concat(authLink, createHttpLink({ uri: "http://localhost:9000/graphql" }));
const wsLink = new GraphQLWsLink(createWsClient({ url: "ws://localhost:9000/graphql", connectionParams: () => ({ accessToken: getAccessToken() }) }));
export const apolloClient = new ApolloClient({ link: split(isSubscription, wsLink, httpLink), cache: new InMemoryCache() });
```

### Database
- SQLite file at `server/data/db.sqlite3` via `better-sqlite3`.
- Knex manages schema. Seed script recreates tables and inserts sample data.

```bash
node server/scripts/create-db.js
```

## Getting Started (Local Development)

### Prerequisites
- Node.js 18+ recommended
- pnpm/npm/yarn (examples below use npm)

### Log in and chat
- Default users (from seed):
  - alice / alice123
  - bob / bob123
  - charlie / charlie123
- Open two browser windows, log in with different users, and send messages. New messages should appear instantly via the subscription.

## Using the GraphQL API

Sample operations you can run in GraphQL IDEs (e.g., Apollo Studio, Insomnia, Postman with GraphQL), or directly through the client:

```graphql
# Query: fetch messages
query MessagesQuery { messages { id user text } }

# Mutation: add a message
mutation AddMessage($text: String!) { message: addMessage(text: $text) { id user text } }

# Subscription: live messages
subscription MessageAdded { message: messageAdded { id user text } }
```
 HTTP requests must include `Authorization: Bearer <JWT>`. The subscription connection must send `{ accessToken: <JWT> }` as connection params.

