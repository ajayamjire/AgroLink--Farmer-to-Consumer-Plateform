const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number,
  image: String ,
  farmerId: String,
  farmerName: String,
  reviews: [
  {
    userId: String,
    username: String,
    rating: Number,
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }
],
averageRating: {
  type: Number,
  default: 0
}
});

module.exports = mongoose.model("Product", productSchema);