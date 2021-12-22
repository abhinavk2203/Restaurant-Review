const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config()

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

// declare the express app
const app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

// body parser middleware
app.use(express.json());
app.use(express.urlencoded({extended: false}))

// start the database connection
const mongo_url = "mongodb://localhost:27017/hotel";
mongoose.connect(mongo_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, () => console.log("Initiated database connection."));

// get the default connection
const db = mongoose.connection;

//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// define schemas
const RestaurantSchema = new Schema({
    title: mongoose.Schema.Types.String,
    description: mongoose.Schema.Types.String,
    image_url: mongoose.Schema.Types.String,
    rating: mongoose.Schema.Types.Decimal128
});

const ReviewSchema = new Schema({
    restaurant_id: mongoose.Schema.Types.ObjectId,
    title: mongoose.Schema.Types.String,
    content: mongoose.Schema.Types.String,
    rating: mongoose.Schema.Types.Number,
    author_name: mongoose.Schema.Types.String,
    date_posted: mongoose.Schema.Types.Date
});

const ContactFormSchema = new Schema({
    name: mongoose.Schema.Types.String,
    email: mongoose.Schema.Types.String,
    phone: mongoose.Schema.Types.String,
    message: mongoose.Schema.Types.String
})

// compile model from schema
const Restaurant = mongoose.model('Restaurant', RestaurantSchema);
const Review = mongoose.model('Review', ReviewSchema);
const Contact = mongoose.model('ContactUs', ContactFormSchema);

// static file server
app.use(express.static(path.join(__dirname, 'static')))

/* -------------  TEMPLATING ROUTES ------------------ */

// home page
app.get("/", async (req, res) => {
    const restaurants = await Restaurant.find();
    console.log(restaurants.length)
    res.render('index', {
        title: 'Home Page',
        restaurants: restaurants
    })
});

// handle contact us request

app.post("/", async (req, res) => {
    const contact = new Contact({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        message: req.body.message
    });
    await contact.save();
    res.redirect("/")
});

// get list of all restaurants
app.get("/restaurants", async (req, res) => {
    const restaurants = await Restaurant.find();
    res.render('list', {
        title: 'List of Restaurants',
        restaurants: restaurants.slice(0, 6)

    })
});

// get reviews for a particular restaurant
app.get("/restaurants/:id/reviews", async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({_id: req.params.id})
        const reviews = await Review.find({restaurant_id: restaurant._id})

        res.render('reviews', {
            current: restaurant,
            title: restaurant.title + " Reviews",
            reviews: reviews
        })
    } catch {
        res.status(404)
        res.render("error.ejs", {"error": "Restaurant doesn't exist"})
    }
});

// write a review for a particular restaurant
app.get("/restaurants/:id/reviews/create", async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({_id: req.params.id})
        res.render('post-review', {
            current: restaurant,
            title: restaurant.title + " Review"
        })
    } catch {
        res.status(404)
        res.render("error.ejs", {"error": "Restaurant doesn't exist"})
    }
});

// handler to write new review
app.post("/restaurants/:id/reviews/create", async (req, res) => {
    try {
        const verification_token = req.body['g-recaptcha-response'];
        // console.log(RECAPTCHA_SECRET_KEY)
        const params = new URLSearchParams();
        params.append('secret', RECAPTCHA_SECRET_KEY);
        // console.log(RECAPTCHA_SECRET_KEY);
        params.append('response', verification_token);
        // console.log(params);
        // res.render('error', {"error": "Failed to verify recaptcha. Please try again."})
        // return;
        let response = await axios.post("https://www.google.com/recaptcha/api/siteverify", params);
        console.log(response.data);
        if (!response.data.success) {
            res.render('error', {"error": "Failed to verify recaptcha. Please try again."})
        }

        const review = new Review({
            restaurant_id: req.params.id,
            title: req.body.title,
            content: req.body.content,
            rating: 5,
            author_name: req.body.author,
            date_posted: Date.now()
        });

        try {
            await review.save();
        } catch {
            res.render("error", {error: "Failed to post review"})
        }
        res.redirect(`/restaurants/${req.params.id}/reviews`)


    } catch {
        res.status(404)
        res.render("error.ejs", {"error": "Failed to verify recaptcha. Please try again."})
    }
});

/* -------------  JSON ROUTES ------------------ */

// get all restaurants
app.get("/api/restaurants", async (req, res) => {
    const restaurants = await Restaurant.find()
    res.send(restaurants)
});

// create a restaurant
app.post("/api/restaurants", async (req, res) => {
    const restaurant = new Restaurant({
        title: req.body.title,
        description: req.body.description,
        image_url: req.body.image_url,
        rating: req.body.rating
    });

    await restaurant.save();
    res.send(restaurant)
});

// get a restaurant
app.get("/api/restaurants/:id", async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({_id: req.params.id})
        res.send(restaurant)
    } catch {
        res.status(404)
        res.send({error: "Restaurant doesn't exist!"})
    }
})

// delete a restaurant
app.delete("/api/restaurants/:id", async (req, res) => {
    try {
        await Restaurant.deleteOne({_id: req.params.id})
        res.send({status: "success"})
    } catch {
        res.status(404)
        res.send({error: "Restaurant doesn't exist!"})
    }
})

// start listening
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));


