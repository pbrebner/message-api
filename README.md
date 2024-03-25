# Message API

[Link to Client](https://github.com/pbrebner/message-client)

## About

REST API backend for a message app built as part of The ODIN Project curriculum. Routes and controllers were set up with RESTful organization in mind.

## Features

-   RESTful API.
-   Routes to get/post/edit/delete users, friends, channels and messages.
-   User authorization and permission management with jwt tokens.
-   Securing passwords with bcryptjs.
-   Schema validation using Mongoose.
-   Error handling with status codes passed to frontend.

## Technologies Used

-   NodeJS
-   ExpressJS
-   MongoDB
-   Mongoose
-   bcryptjs
-   Passport
-   AWS S3

## TODO

-   Create and implement refresh tokens.
-   Implement websocket to handle real time requests.
