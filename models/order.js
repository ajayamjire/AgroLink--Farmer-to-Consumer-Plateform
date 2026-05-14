const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  productName: String,
  price: Number,
  quantity: Number,

  userId: String,
  username: String,

  farmerId: String,
  farmerName: String,
  
  deliveryAddress: String,
  mobileNumber: String,

  paymentMethod: {
    type: String,
    default: "Cash on Delivery"
  },
  paymentStatus: {
    type: String,
    default: "Pending"
  },
  transactionId: String,
  status: {
    type: String,
    default: "Pending"
  },
  latitude: String,
  longitude: String
});

module.exports = mongoose.model("Order", orderSchema);