const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Order = require("./models/Order");
const app = express();
app.use(express.static("public"));
// Middleware
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connect
mongoose.connect("mongodb://127.0.0.1:27017/agroEJS")
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

// Routes
const Product = require("./models/Product");

const session = require("express-session");

app.use(session({
  secret: "secretkey",
  resave: false,
  saveUninitialized: true
}));
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  req.session.success = null;
  next();
});
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});
//admin middleware
function isAdmin(req, res, next) {

  if (!req.session.user || req.session.user.role !== "admin") {
    return res.send("Admin Access Only");
  }

  next();
}
const multer = require("multer");

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage: storage });
// Home (show products)
app.get("/", async (req, res) => {

  let search = req.query.search || "";

  const products = await Product.find({
    name: { $regex: search, $options: "i" }
  });

  res.render("index", { 
    products,
    search
  });
});

// Add product page
app.get("/add", isLoggedIn, (req, res) => {
  if (req.session.user.role !== "farmer") {
    return res.send("Only farmers can add products");
  }
  res.render("addProduct");
});

// Add product (form submit)
app.post("/add",upload.single("image"), async (req, res) => {
  const { name, price, quantity } = req.body;
  const product = new Product({ name, price, quantity ,image: req.file.filename,farmerId: req.session.user._id ,farmerName: req.session.user.username});
  req.session.success = "Product Added Successfully!"; 
  await product.save();
  
  res.redirect("/dashboard");
});
app.get("/buy/:id", isLoggedIn, async (req, res) => {

  if (req.session.user.role !== "user") {
    return res.send("Only users can buy products");
  }

  const product = await Product.findById(req.params.id);

  // 👉 checkout page open karo
  res.render("checkout", { product });

});

// app.post("/place-order/:id", isLoggedIn, async (req, res) => {
//   if (req.session.user.role !== "user") {
//     return res.send("Only users can place orders");
//   }

//   const product = await Product.findById(req.params.id);
//   const buyQuantity = Number(req.body.quantity);

//   if (buyQuantity < 1) {
//     return res.send("Invalid quantity");
//   }

//   if (buyQuantity > product.quantity) {
//     return res.send("Not enough stock available");
//   }
//   if (product.quantity <= 0) {
//   return res.send("Product is out of stock");
//   }
//   const order = new Order({
//     productName: product.name,
//     price: product.price * buyQuantity,
//     quantity: buyQuantity,

//     userId: req.session.user._id,
//     username: req.session.user.username,

//     farmerId: product.farmerId,
//     farmerName: product.farmerName,

//     deliveryAddress: req.body.deliveryAddress,
//     mobileNumber: req.body.mobileNumber,

//     paymentMethod: req.body.paymentMethod,
//     paymentStatus: req.body.paymentMethod === "UPI Payment" ? "Paid" : "Pending",

//     latitude: req.body.latitude,
//     longitude: req.body.longitude,
//   });

//   await order.save();

//   product.quantity = product.quantity - buyQuantity;
//   await product.save();

//   req.session.success = "Order Placed Successfully!";
//   res.redirect("/orders");
// });

app.post("/place-order/:id", isLoggedIn, async (req, res) => {
  if (req.session.user.role !== "user") {
    return res.send("Only users can place orders");
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.send("Product not found");
  }

  const buyQuantity = Number(req.body.quantity);

  if (buyQuantity < 1) {
    return res.send("Invalid quantity");
  }

  if (buyQuantity > product.quantity) {
    return res.send("Not enough stock available");
  }

  const mobile = req.body.mobileNumber;

  if (!/^[6-9][0-9]{9}$/.test(mobile)) {
    return res.send("Enter valid Indian mobile number");
  }

  if (
    req.body.paymentMethod === "UPI Payment" &&
    !req.body.transactionId
  ) {
    return res.send("Transaction ID is required for UPI payment");
  }

  const order = new Order({
    productName: product.name,
    price: product.price * buyQuantity,
    quantity: buyQuantity,

    userId: req.session.user._id,
    username: req.session.user.username,

    farmerId: product.farmerId,
    farmerName: product.farmerName,

    deliveryAddress: req.body.deliveryAddress,
    mobileNumber: req.body.mobileNumber,
    latitude: req.body.latitude,
    longitude: req.body.longitude,

    paymentMethod: req.body.paymentMethod,
    paymentStatus: req.body.paymentMethod === "UPI Payment" ? "Paid" : "Pending",
    transactionId: req.body.transactionId || ""
  });

  await order.save();

  product.quantity = product.quantity - buyQuantity;
  await product.save();

  req.session.success = "Order Placed Successfully!";
  res.redirect("/orders");
});
app.get("/orders", isLoggedIn, async (req, res) => {
  let orders;

  if (req.session.user.role === "user") {
    orders = await Order.find({
      userId: req.session.user._id
    });
  } else if (req.session.user.role === "farmer") {
    orders = await Order.find({
      farmerId: req.session.user._id
    });
  }

  res.render("orders", { orders });
});
// app.get("/delete/:id", isLoggedIn, async (req, res) => {
//   if (req.session.user.role !== "farmer") {
//     return res.send("Only farmers can delete");
//   }

//   await Product.findByIdAndDelete(req.params.id);
//   res.redirect("/");
// });
app.get("/delete/:id", isLoggedIn, async (req, res) => {

  // only farmer allowed
  if (req.session.user.role !== "farmer") {
    return res.send("Access Denied");
  }

  // find product
  const product = await Product.findById(req.params.id);

  // product exists or not
  if (!product) {
    return res.send("Product not found");
  }

  // check ownership
  if (product.farmerId != req.session.user._id) {
    return res.send("You can delete only your own products");
  }

  // delete product
  await Product.findByIdAndDelete(req.params.id);

  req.session.success = "Product Deleted Successfully!";

  res.redirect("/dashboard");
});
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  const product = await Product.findById(req.params.id);

  // 🔒 Security: only owner farmer can edit
  if (!product || product.farmerId != req.session.user._id) {
    return res.send("Access Denied");
  }

  res.render("editProduct", { product });
});

app.post("/edit/:id", isLoggedIn, upload.single("image"), async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || product.farmerId != req.session.user._id) {
    return res.send("Access Denied");
  }

  const { name, price, quantity } = req.body;

  let updatedImage = product.image;

  if (req.file) {
    updatedImage = req.file.filename; // new image
  }

  await Product.findByIdAndUpdate(req.params.id, {
    name,
    price,
    quantity,
    image: updatedImage
  });

  req.session.success = "Product Updated!";
  res.redirect("/dashboard");
});
const bcrypt = require("bcrypt");
const User = require("./models/User");

app.get("/dashboard", isLoggedIn, async (req, res) => {

  if (req.session.user.role !== "farmer") {
    return res.send("Access Denied");
  }

  const products = await Product.find({
    farmerId: req.session.user._id   // 👈 only own products
  });

  res.render("dashboard", { products });
});
//manage product status
app.get("/manage-orders", isLoggedIn, async (req, res) => {
  if (req.session.user.role !== "farmer") {
    return res.send("Access Denied");
  }

  const orders = await Order.find({
    farmerId: req.session.user._id
  });

  res.render("manageOrders", { orders });
});

app.get("/status/:id/:value", isLoggedIn, async (req, res) => {
  if (req.session.user.role !== "farmer") {
    return res.send("Access Denied");
  }

  const order = await Order.findById(req.params.id);

  if (!order || order.farmerId != req.session.user._id) {
    return res.send("Access Denied");
  }

  await Order.findByIdAndUpdate(req.params.id, {
    status: req.params.value
  });

  res.redirect("/manage-orders");
});

//cancel order

app.get("/cancel-order/:id", isLoggedIn, async (req, res) => {
  if (req.session.user.role !== "user") {
    return res.send("Access Denied");
  }

  const order = await Order.findById(req.params.id);

  if (!order || order.userId != req.session.user._id) {
    return res.send("Access Denied");
  }

  if (order.status !== "Pending") {
    return res.send("Only pending orders can be cancelled");
  }

  await Order.findByIdAndUpdate(req.params.id, {
    status: "Cancelled"
  });

  req.session.success = "Order Cancelled!";
 res.redirect("/orders");
});

// Register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Register
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = new User({
    username,
    password: hashed,
    role
  });

  await user.save();
  res.redirect("/login");
});

// Login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) return res.send("User not found");

  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.send("Wrong password");

  req.session.user = user;

  res.redirect("/");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Error logging out");
    }
    res.redirect("/");
  });
});

app.post("/review/:id", isLoggedIn, async (req, res) => {
  if (req.session.user.role !== "user") {
    return res.send("Only users can review products");
  }

  const product = await Product.findById(req.params.id);

  const rating = Number(req.body.rating);
  const comment = req.body.comment;

  product.reviews.push({
    userId: req.session.user._id,
    username: req.session.user.username,
    rating,
    comment
  });

  const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
  product.averageRating = totalRating / product.reviews.length;

  await product.save();

  req.session.success = "Review added successfully!";
  res.redirect("/");
});

app.get("/track-order/:id", isLoggedIn, async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order || order.farmerId != req.session.user._id) {
    return res.send("Access Denied");
  }

  res.render("trackOrder", { order });
});


app.get("/admin", isLoggedIn, isAdmin, async (req, res) => {

  const users = await User.find();
  const products = await Product.find();
  const orders = await Order.find();

  res.render("admin", {
    users,
    products,
    orders
  });

});
app.listen(5000, () => console.log("Server running on 5000"));