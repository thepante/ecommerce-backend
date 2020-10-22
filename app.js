const express = require('express');
const cors = require('cors');
const db = require('diskdb');
const customId = require("custom-id");

db.connect('./db', ['categories', 'products', 'comments', 'users']);

const app = express();

const allowedOrigins = [
  'https://thepante.github.io',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:8080',
];

app.use(cors({
  origin: function(origin, callback) {
    allowedOrigins.indexOf(origin) !== -1 || !origin ? callback(null, true) : callback('Not allowed by CORS');
  }
}));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json());

app.get('/ping', function (req, res) {
  console.log(req.headers.host);
  res.sendStatus(200);
});

// Redirect to my profile
app.get('/', function (req, res) {
  res.redirect('https://github.com/thepante');
});

/**
 * Get comments for a given product
 * @return {array} - Products
 */
function getComments(productID) {
  const comments = db.comments.find();
  let collected = [];

  for (let i = 0; i < comments.length; i++) {
    if (comments[i].product_id === productID) {
      delete comments[i].product_id;
      comments[i].score = Number(comments[i].score);
      collected.push(comments[i]);
    }
  }
  // console.log(collected.length);
  return collected;
}

/**
 * Get info for an specific product
 * @return {object} - Product info
 */
function getProductInfo(productID) {
  const info = db.products.findOne({ id: productID });
  const category = db.categories.findOne({ id: info.category });
  delete info._id; // remove internal db id
  info.category = category.name; // replace category id with its name
  return info;
}

/**
 * Get products. Can be between a range and/or in a category
 * @param category  - Product category
 * @param min - Price: at least cost this amount
 * @param max - Price: at most cost this amount
 * @return {array} - Products
 */
function getProducts(category, min, max) {
  const minPrice = min ? Number(min) : 0;
  const maxPrice = max ? Number(max) : Infinity;

  const products = db.products.find();
  let collected = [];

  // category filter
  if (category) collected = collected.filter(product => product.category === Number(category));

  // price filter
  if (min || max) {
    collected = products.filter(product => {
      if (product.cost >= minPrice && product.cost <= maxPrice) {
        delete product._id;
        delete product.description;
        return true;
      }
      return false;
    });
  }

  // limit filter
  if (collected.length > 14) {
    // console.log("abre filtro de cantidad")
    for (let i = collected.length - 1; i > 13; i--) {
      collected.pop();
    }
  }

  return collected;
}

/**
 * Retrieve releated products for that price and category
 * @return {array} - Array of products
 */
function getReleatedProducts(product) {
  // TODO
}

// Get a product info/comments
app.get('/product/:request/:product_id', function (req, res) {
  const requested = req.params.request;
  const productID = req.params.product_id;
  // console.log(requested, productID)
  try {
    let response;
    if (requested === 'comments') {
      response = getComments(productID);
    } else if (requested === 'info') {
      response = getProductInfo(productID);
    }

    response ? res.send(response) : res.sendStatus(404);
  }
  catch { res.sendStatus(404) };
});

// Retrieve products - can be between a given range. limit to 15 per request
app.get('/products', function (req, res) {
  if (!req.query.cat) return res.sendStatus(400);
  try {
    const products = getProducts(req.query.cat, req.query.min, req.query.max);
    products ? res.send(products) : res.sendStatus(404);
  }
  catch { res.sendStatus(500) };
});

// Add new comments
app.post('/comments', function (req, res) {
  const comment = {}

  // validate
  try {
    const productExists = db.products.findOne({ id: req.body.product_id });
    if (!productExists) return sendStatus(400);

    comment.product_id = String(req.body.product_id);
    comment.user = String(req.body.user);
    comment.description = String(req.body.description);
    comment.dateTime = String(req.body.dateTime);
    comment.score = Number(req.body.score);
  } catch {
    console.log("failed comment validation")
    return res.sendStatus(400);
  }

  // save comment
  try {
    const added = db.comments.save(comment);
    // console.log(comment.product_id, added._id);
    res.send({ added: (added._id) ? added._id : false });
  }
  catch { res.sendStatus(400) }
});

// Remove comments
app.post('/removecomment', function (req, res) {
  try {
    const remove = db.comments.remove({ id: req.body._id }, false);
    const check = db.comments.findOne({ id: req.body._id });
    // console.log(remove);
    res.send({ removed: check === undefined });
  }
  catch { res.sendStatus(400) }
});

// Add new products
app.post('/product', function (req, res) {
  const product = {};

  // validate
  try {
    const category = db.categories.findOne({ id: Number(req.body.category) });
    if (!category) return sendStatus(400);

    product.id = customId({});
    product.category = Number(req.body.category);
    product.name = String(req.body.name);
    product.summary = String(req.body.summary);
    product.description = String(req.body.description);
    product.cost = Number(req.body.cost);
    product.currency = String(req.body.currency);
    product.soldCount = 0;
    product.images = Array(req.body.images);
    product.releated = getReleatedProducts({ cat: product.category, cost: product.cost });

  } catch {
    // console.log("failed product validation")
    return res.sendStatus(400);
  }

  // save product
  try {
    const added = db.products.save(product);
    res.send({ added: added.id ? added.id : false });
  }
  catch { res.sendStatus(400) }
});

// Remove products
app.post('/removeproduct', function (req, res) {
  try {
    db.products.remove({ id: req.body.id }, false);
    const check = db.products.findOne({ id: req.body.id });
    res.send({ removed: check === undefined });
  }
  catch { res.sendStatus(400) }
});


app.listen(process.env.PORT || 3000, () => console.log("Server is running..."));